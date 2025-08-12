import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// List posts by workspace or create a new post
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  // Admin client for bypassing RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // 認証チェック（Cookie + Authorization両対応）
    let user;
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    if (cookieError || !cookieUser) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user: tokenUser }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
        if (tokenError || !tokenUser) {
          return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
        }
        user = tokenUser
      } else {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
      }
    } else {
      user = cookieUser
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const status = searchParams.get('status') as
      | 'draft'
      | 'scheduled'
      | 'published'
      | 'failed'
      | null
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id が必要です' }, { status: 400 })
    }

    // membership check (Adminクライアント使用)
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('投稿一覧取得エラー:', error)
      return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ posts: posts || [] })
  } catch (e) {
    console.error('投稿一覧API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  // Admin client for bypassing RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // 認証チェック（Cookie + Authorization両対応）
    let user;
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    if (cookieError || !cookieUser) {
      console.log('Cookie認証失敗、Authorizationヘッダーをチェック:', cookieError?.message)
      
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user: tokenUser }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
        if (tokenError || !tokenUser) {
          console.log('Token認証も失敗:', tokenError?.message)
          return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
        }
        user = tokenUser
        console.log('Token認証成功:', user.id)
      } else {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
      }
    } else {
      user = cookieUser
      console.log('Cookie認証成功:', user.id)
    }

    const body = await request.json()
    const {
      workspace_id,
      threads_account_id,
      content,
      scheduled_at,
      parent_post_id,
    } = body || {}

    console.log('投稿作成リクエスト:', { workspace_id, threads_account_id, content: content?.length + '文字', scheduled_at, parent_post_id })

    if (!workspace_id || !threads_account_id || !content || typeof content !== 'string') {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // membership check (Adminクライアント使用)
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()
      
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // ツリー投稿の場合：親投稿の検証とツリー情報の取得
    let threadRootId = null
    let threadPosition = 0
    
    if (parent_post_id) {
      console.log('ツリー投稿として処理中。親投稿ID:', parent_post_id)
      
      // 親投稿が同じワークスペース内に存在するか確認
      const { data: parentPost, error: parentError } = await supabaseAdmin
        .from('posts')
        .select('id, thread_root_id, thread_position, workspace_id')
        .eq('id', parent_post_id)
        .eq('workspace_id', workspace_id)
        .single()
      
      if (parentError || !parentPost) {
        return NextResponse.json({ error: '指定された親投稿が見つかりません' }, { status: 400 })
      }
      
      // ツリーのルートIDを設定（親がルートの場合は親のID、そうでなければ親のthread_root_id）
      threadRootId = parentPost.thread_root_id || parent_post_id
      
      // 現在のツリーでの最大position + 1を取得
      const { data: maxPositionPost } = await supabaseAdmin
        .from('posts')
        .select('thread_position')
        .eq('thread_root_id', threadRootId)
        .order('thread_position', { ascending: false })
        .limit(1)
        .single()
      
      threadPosition = (maxPositionPost?.thread_position || 0) + 1
      
      console.log(`ツリー情報: root=${threadRootId}, position=${threadPosition}`)
    }

    const isImmediatePost = !scheduled_at
    const status: 'draft' | 'scheduled' | 'published' | 'failed' = scheduled_at ? 'scheduled' : 'published'

    console.log('投稿タイプ:', isImmediatePost ? '即時投稿' : '予約投稿')

    // データベースに投稿を保存（Adminクライアント使用）
    // parent_post_id関連のフィールドは一時的に除外
    const insertData: any = {
      workspace_id,
      threads_account_id,
      content: content.trim(),
      status,
      scheduled_at: scheduled_at || null,
      published_at: isImmediatePost ? new Date().toISOString() : null,
    }
    
    // parent_post_idが指定されている場合のみツリー関連フィールドを追加
    // TODO: スキーマキャッシュの問題が解決したら元に戻す
    /*
    if (parent_post_id) {
      insertData.parent_post_id = parent_post_id
      insertData.thread_root_id = threadRootId
      insertData.thread_position = threadPosition
    }
    */
    
    const { data: inserted, error } = await supabaseAdmin
      .from('posts')
      .insert(insertData)
      .select('*')
      .single()

    if (error) {
      console.error('投稿作成エラー:', error)
      console.error('エラー詳細:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      })
      return NextResponse.json({ 
        error: '作成に失敗しました',
        details: error.message 
      }, { status: 500 })
    }

    console.log('データベース保存完了:', inserted.id)

    // 即時投稿の場合、Threads APIに投稿
    if (isImmediatePost) {
      console.log('即時投稿開始...')
      try {
        // Threadsアカウント情報を取得（Adminクライアント使用）
        const { data: threadsAccount, error: accountError } = await supabaseAdmin
          .from('threads_accounts')
          .select('access_token, threads_user_id, username')
          .eq('id', threads_account_id)
          .single()

        if (accountError || !threadsAccount) {
          throw new Error('Threadsアカウント情報の取得に失敗しました')
        }

        console.log('Threadsアカウント取得完了:', threadsAccount.username)

        // ツリー投稿の場合：親投稿のThreads投稿IDを取得
        let replyToPostId = null
        if (parent_post_id) {
          // parent_post_idがThreads投稿IDの場合（フロントエンドから直接指定）
          if (parent_post_id.match(/^\d+$/)) {
            // 数字のみの場合はThreads投稿IDとして扱う
            replyToPostId = parent_post_id
            console.log('返信先Threads投稿ID (直接指定):', replyToPostId)
          } else {
            // UUIDの場合はデータベースから取得
            const { data: parentPost, error: parentError } = await supabaseAdmin
              .from('posts')
              .select('threads_post_id')
              .eq('id', parent_post_id)
              .single()
            
            if (parentError || !parentPost?.threads_post_id) {
              throw new Error('親投稿のThreads投稿IDが見つかりません')
            }
            
            replyToPostId = parentPost.threads_post_id
            console.log('返信先Threads投稿ID (DB取得):', replyToPostId)
          }
        }

        // Threads API で投稿（ツリー投稿の場合はreply_to指定）
        const requestBody: any = {
          media_type: 'TEXT',
          text: content.trim(),
        }
        
        if (replyToPostId) {
          requestBody.reply_to = replyToPostId
        }

        console.log('Threads API リクエスト:', requestBody)

        // ステップ1: 投稿を作成
        const threadsResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${threadsAccount.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        const threadsData = await threadsResponse.json()
        console.log('Threads API 作成レスポンス:', threadsData)

        if (threadsResponse.ok && threadsData.id) {
          // ステップ2: 投稿を公開
          console.log('投稿を公開中... Creation ID:', threadsData.id)
          
          const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${threadsAccount.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              creation_id: threadsData.id
            }),
          })
          
          const publishData = await publishResponse.json()
          console.log('Threads API 公開レスポンス:', publishData)
          
          if (publishResponse.ok && publishData.id) {
            // 成功：投稿IDを更新（公開後のIDを使用）
            const { error: updateError } = await supabaseAdmin
              .from('posts')
              .update({
                threads_post_id: publishData.id,  // 公開後のIDを保存
                status: 'published',
                published_at: new Date().toISOString(),
              })
              .eq('id', inserted.id)

            if (updateError) {
              console.error('投稿ID更新エラー:', updateError)
            } else {
              console.log('✅ Threads投稿成功:', publishData.id)
              // レスポンス用に更新
              inserted.threads_post_id = publishData.id
            }
          } else {
            // 公開失敗
            const errorMessage = publishData.error?.message || 'Threads投稿の公開に失敗しました'
            console.error('❌ Threads公開失敗:', errorMessage)
            
            await supabaseAdmin
              .from('posts')
              .update({
                status: 'failed',
                error_message: errorMessage,
              })
              .eq('id', inserted.id)

            return NextResponse.json({ 
              error: `投稿の作成は成功しましたが、公開に失敗しました: ${errorMessage}` 
            }, { status: 500 })
          }
        } else {
          // エラー：失敗ステータスに更新
          const errorMessage = threadsData.error?.message || 'Threads投稿に失敗しました'
          console.error('❌ Threads投稿失敗:', errorMessage)
          
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', inserted.id)

          return NextResponse.json({ 
            error: `投稿の作成は成功しましたが、Threads投稿に失敗しました: ${errorMessage}` 
          }, { status: 500 })
        }
      } catch (threadsError) {
        console.error('❌ Threads投稿処理エラー:', threadsError)
        
        // エラー：失敗ステータスに更新
        await supabaseAdmin
          .from('posts')
          .update({
            status: 'failed',
            error_message: threadsError instanceof Error ? threadsError.message : 'Threads投稿エラー',
          })
          .eq('id', inserted.id)

        return NextResponse.json({ 
          error: `投稿の作成は成功しましたが、Threads投稿でエラーが発生しました: ${threadsError instanceof Error ? threadsError.message : '不明なエラー'}` 
        }, { status: 500 })
      }
    }

    console.log('✅ 投稿処理完了')
    return NextResponse.json({ post: inserted })
  } catch (e) {
    console.error('❌ 投稿作成API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
