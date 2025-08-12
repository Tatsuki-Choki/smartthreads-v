import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { ThreadsAPI, ThreadsContentAPI } from '@/lib/threads/api'
import crypto from 'crypto'

// Publish a post immediately (skeleton: no external Threads call yet)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const postId = params.id
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // Load post with workspace_id to validate membership and fetch content/account
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, workspace_id, status, content, threads_account_id')
      .eq('id', postId)
      .single()
    if (fetchError || !post) {
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
    }

    // membership check
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .single()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    try {
      if (post.status === 'published') {
        return NextResponse.json({ error: '既に投稿済みです' }, { status: 409 })
      }
      // Fetch and decrypt Threads access token
      const { data: account, error: accError } = await supabase
        .from('threads_accounts')
        .select('id, access_token, workspace_id, username')
        .eq('id', post.threads_account_id)
        .eq('workspace_id', post.workspace_id)
        .single()
      if (accError || !account) {
        throw new Error('Threadsアカウントが見つかりません')
      }

      let token: string | null = null
      try {
        const parsed = JSON.parse(account.access_token)
        token = decrypt(parsed)
      } catch {
        // backward compatibility: plaintext
        token = account.access_token
      }
      if (!token) {
        throw new Error('アクセストークンの復号に失敗しました')
      }

      // Validate token and publish
      const threads = new ThreadsAPI(token)
      await threads.getUserInfo(['id'])
      const contentApi = new ThreadsContentAPI(token)
      if (!post.content || !post.content.trim()) {
        throw new Error('投稿内容が空です')
      }
      // 長さ制限（目安: 500文字）
      const text = post.content.trim().slice(0, 500)
      const published = await contentApi.publishText(text)

      const { data: updated, error: updError } = await supabase
        .from('posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          threads_post_id: published.id,
          error_message: null,
        })
        .eq('id', postId)
        .select('*')
        .single()
      if (updError) {
        throw updError
      }

      return NextResponse.json({ post: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : '投稿に失敗しました'
      // Mark as failed
      await supabase
        .from('posts')
        .update({ status: 'failed', error_message: message })
        .eq('id', postId)

      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (e) {
    console.error('即時投稿API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
