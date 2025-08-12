import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Create thread post (multiple sequential posts)
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
      thread_posts,
      scheduled_at,
    } = body || {}

    console.log('ツリー投稿作成リクエスト:', { workspace_id, threads_account_id, posts_count: thread_posts?.length, scheduled_at })

    if (!workspace_id || !threads_account_id || !Array.isArray(thread_posts) || thread_posts.length === 0) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 空の投稿を除外
    const validPosts = thread_posts.filter(post => post && post.trim().length > 0)
    if (validPosts.length === 0) {
      return NextResponse.json({ error: '投稿内容が空です' }, { status: 400 })
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

    const isImmediatePost = !scheduled_at
    const status: 'draft' | 'scheduled' | 'published' | 'failed' = scheduled_at ? 'scheduled' : 'published'

    console.log('投稿タイプ:', isImmediatePost ? '即時ツリー投稿' : '予約ツリー投稿')
    console.log('有効な投稿数:', validPosts.length)

    const createdPosts = []
    let parentPostId: string | null = null
    let threadRootId: string | null = null

    // 各投稿を順番に作成
    for (let i = 0; i < validPosts.length; i++) {
      const postContent = validPosts[i].trim()
      
      console.log(`投稿 ${i + 1}/${validPosts.length} を作成中...`)

      // データベースに投稿を保存
      // TODO: parent_post_id関連フィールドのスキーマキャッシュ問題が解決したら元に戻す
      const insertData: any = {
        workspace_id,
        threads_account_id,
        content: postContent,
        status,
        scheduled_at: scheduled_at || null,
        published_at: isImmediatePost ? new Date().toISOString() : null,
      }
      
      // 一時的にparent_post_id関連フィールドを除外
      // insertData.parent_post_id = parentPostId
      // insertData.thread_root_id = threadRootId
      // insertData.thread_position = i
      
      const { data: inserted, error }: { data: any, error: any } = await supabaseAdmin
        .from('posts')
        .insert(insertData)
        .select('*')
        .single()

      if (error) {
        console.error(`投稿 ${i + 1} 作成エラー:`, error)
        return NextResponse.json({ error: `投稿 ${i + 1} の作成に失敗しました` }, { status: 500 })
      }

      console.log(`投稿 ${i + 1} データベース保存完了:`, inserted.id)
      createdPosts.push(inserted)

      // 最初の投稿の場合、thread_root_idを設定
      if (i === 0) {
        threadRootId = inserted.id
        
        // 最初の投稿のthread_root_idを自分自身に更新
        // TODO: スキーマキャッシュ問題が解決したら有効化
        // await supabaseAdmin
        //   .from('posts')
        //   .update({ thread_root_id: inserted.id })
        //   .eq('id', inserted.id)
      }

      // 次の投稿の親として設定
      parentPostId = inserted.id
    }

    // 即時投稿の場合、Threads APIに順番に投稿
    if (isImmediatePost) {
      console.log('即時ツリー投稿開始...')
      try {
        // Threadsアカウント情報を取得
        const { data: threadsAccount, error: accountError } = await supabaseAdmin
          .from('threads_accounts')
          .select('access_token, threads_user_id, username')
          .eq('id', threads_account_id)
          .single()

        if (accountError || !threadsAccount) {
          throw new Error('Threadsアカウント情報の取得に失敗しました')
        }

        console.log('Threadsアカウント取得完了:', threadsAccount.username)

        let parentThreadsPostId: string | null = null

        // 各投稿をThreads APIに順番に送信
        for (let i = 0; i < createdPosts.length; i++) {
          const post = createdPosts[i]
          
          console.log(`Threads API 投稿 ${i + 1}/${createdPosts.length} 送信中...`)

          // Threads API リクエストボディ
          const requestBody: any = {
            media_type: 'TEXT',
            text: post.content,
          }
          
          // 2つ目以降の投稿の場合、前の投稿への返信として設定
          if (i > 0 && parentThreadsPostId) {
            console.log(`  親投稿ID (reply_to_id): ${parentThreadsPostId}`)
            // Threads API v1.0では reply_to_id を使用
            requestBody.reply_to_id = parentThreadsPostId
          }

          console.log(`Threads API リクエスト ${i + 1}:`, JSON.stringify(requestBody, null, 2))

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
          console.log(`Threads API 作成レスポンス ${i + 1}:`, threadsData)

          if (threadsResponse.ok && threadsData.id) {
            // ステップ2: 投稿を公開
            console.log(`投稿 ${i + 1} を公開中... Creation ID:`, threadsData.id)
            
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
            console.log(`Threads API 公開レスポンス ${i + 1}:`, publishData)
            
            if (publishResponse.ok && publishData.id) {
              // 成功：投稿IDを更新（公開後のIDを使用）
              const { error: updateError } = await supabaseAdmin
                .from('posts')
                .update({
                  threads_post_id: publishData.id,  // 公開後のIDを保存
                  status: 'published',
                  published_at: new Date().toISOString(),
                })
                .eq('id', post.id)

              if (updateError) {
                console.error(`投稿 ${i + 1} ID更新エラー:`, updateError)
              } else {
                console.log(`✅ Threads投稿 ${i + 1} 成功:`)
                console.log(`  投稿ID: ${publishData.id}`)
                console.log(`  URL: https://www.threads.net/@${threadsAccount.username}/post/${publishData.id}`)
                if (i === 0) {
                  console.log(`  これがツリーの最初の投稿です`)
                } else {
                  console.log(`  親投稿への返信として作成されました`)
                }
              }

              // 次の投稿の親として設定（公開後のIDを使用）
              parentThreadsPostId = publishData.id
            } else {
              // 公開失敗
              const errorMessage = publishData.error?.message || `Threads投稿 ${i + 1} の公開に失敗しました`
              console.error(`❌ Threads公開 ${i + 1} 失敗:`, errorMessage)
              
              await supabaseAdmin
                .from('posts')
                .update({
                  status: 'failed',
                  error_message: errorMessage,
                })
                .eq('id', post.id)

              return NextResponse.json({ 
                error: `投稿 ${i + 1} の公開に失敗しました: ${errorMessage}` 
              }, { status: 500 })
            }
          } else {
            // エラー：失敗ステータスに更新
            const errorMessage = threadsData.error?.message || `Threads投稿 ${i + 1} に失敗しました`
            console.error(`❌ Threads投稿 ${i + 1} 失敗:`, errorMessage)
            
            await supabaseAdmin
              .from('posts')
              .update({
                status: 'failed',
                error_message: errorMessage,
              })
              .eq('id', post.id)

            return NextResponse.json({ 
              error: `投稿 ${i + 1} のThreads投稿に失敗しました: ${errorMessage}` 
            }, { status: 500 })
          }

          // レート制限を避けるため、少し待機
          if (i < createdPosts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      } catch (threadsError) {
        console.error('❌ Threads ツリー投稿処理エラー:', threadsError)
        
        // 全ての投稿を失敗ステータスに更新
        for (const post of createdPosts) {
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'failed',
              error_message: threadsError instanceof Error ? threadsError.message : 'Threads投稿エラー',
            })
            .eq('id', post.id)
        }

        return NextResponse.json({ 
          error: `ツリー投稿でエラーが発生しました: ${threadsError instanceof Error ? threadsError.message : '不明なエラー'}` 
        }, { status: 500 })
      }
    }

    console.log('✅ ツリー投稿処理完了')
    return NextResponse.json({ 
      posts: createdPosts,
      message: `${createdPosts.length}つの投稿からなるツリー投稿を${isImmediatePost ? '作成しました' : '予約しました'}`
    })
  } catch (e) {
    console.error('❌ ツリー投稿作成API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}