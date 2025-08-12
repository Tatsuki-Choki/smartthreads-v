import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET: 投稿を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  
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

    const postId = params.id
    console.log('投稿取得:', postId)

    // 投稿を取得
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        threads_accounts (
          id,
          username,
          threads_user_id
        )
      `)
      .eq('id', postId)
      .single()

    if (postError || !post) {
      console.error('投稿取得エラー:', postError)
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
    }

    // ワークスペースメンバーかチェック
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'この投稿を閲覧する権限がありません' }, { status: 403 })
    }

    console.log('投稿取得成功:', post.id)
    return NextResponse.json(post)
  } catch (error) {
    console.error('投稿取得エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

// PATCH: 投稿を更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  
  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const postId = params.id
    const body = await request.json()
    const { content, scheduled_at } = body

    console.log('投稿更新リクエスト:', { postId, content: content?.substring(0, 50), scheduled_at })

    // 既存の投稿を取得
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (fetchError || !existingPost) {
      console.error('投稿取得エラー:', fetchError)
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
    }

    // ワークスペースメンバーかチェック
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', existingPost.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'この投稿を編集する権限がありません' }, { status: 403 })
    }

    // 編集可能な状態かチェック
    if (existingPost.status !== 'scheduled') {
      return NextResponse.json({ 
        error: '予約中の投稿のみ編集できます' 
      }, { status: 400 })
    }

    // 予約日時が過去でないかチェック
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at)
      if (scheduledDate <= new Date()) {
        return NextResponse.json({ 
          error: '予約日時は現在より未来を指定してください' 
        }, { status: 400 })
      }
    }

    // 更新データの準備
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (content !== undefined) {
      updateData.content = content
    }

    if (scheduled_at !== undefined) {
      updateData.scheduled_at = scheduled_at
    }

    // 投稿を更新
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('posts')
      .update(updateData)
      .eq('id', postId)
      .select(`
        *,
        threads_accounts (
          id,
          username,
          threads_user_id
        )
      `)
      .single()

    if (updateError) {
      console.error('投稿更新エラー:', updateError)
      return NextResponse.json({ error: '投稿の更新に失敗しました' }, { status: 500 })
    }

    console.log('投稿更新成功:', postId)
    return NextResponse.json({
      post: updatedPost,
      message: '予約投稿を更新しました'
    })
  } catch (error) {
    console.error('投稿更新エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

// Delete a post (only if member of the workspace)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const postId = params.id
  
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

    // Load post to get workspace_id for membership check (Adminクライアント使用)
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('id, workspace_id')
      .eq('id', postId)
      .single()
    if (fetchError || !post) {
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
    }

    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .single()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      console.error('投稿削除エラー:', error)
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('投稿削除API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

