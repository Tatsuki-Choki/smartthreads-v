import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// 現在のユーザーが所属する既定のワークスペースを返す
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    // Cookie認証を試みる
    let user
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !cookieUser) {
      // Authorizationヘッダーから認証を試みる
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
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

    // 最初のワークスペースを取得
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, created_at, workspace_members!inner(user_id)')
      .eq('workspace_members.user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      console.error('ワークスペース取得エラー:', error)
      return NextResponse.json({ error: 'ワークスペースの取得に失敗しました' }, { status: 500 })
    }

    if (!workspaces || workspaces.length === 0) {
      // 存在しない場合は404（フロント側で作成フローに入る）
      return NextResponse.json({ error: 'ワークスペースが見つかりません' }, { status: 404 })
    }

    const workspaceId = workspaces[0].id

    // Threadsアカウント情報を取得
    const { data: threadsAccounts } = await supabase
      .from('threads_accounts')
      .select('id, threads_user_id, username, profile_picture_url, expires_at, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    const workspace = { 
      id: workspaceId, 
      name: workspaces[0].name,
      threads_accounts: threadsAccounts || []
    }
    return NextResponse.json(workspace)
  } catch (e) {
    console.error('現在ワークスペースAPI エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

