import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    
    // 現在のユーザーを取得
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // ユーザーが所属するワークスペースIDを取得
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, workspace_members!inner(user_id)')
      .eq('workspace_members.user_id', user.id)

    if (wsError) {
      console.error('ワークスペース取得エラー:', wsError)
      return NextResponse.json({ connected: false, accounts: [] })
    }

    const workspaceIds = (workspaces || []).map(w => w.id)
    if (workspaceIds.length === 0) {
      return NextResponse.json({ connected: false, accounts: [] })
    }

    // いずれかのワークスペースに紐づくThreadsアカウントを取得
    const { data: threadsAccounts, error: accountsError } = await supabase
      .from('threads_accounts')
      .select('id, workspace_id, threads_user_id, username')
      .in('workspace_id', workspaceIds)

    if (accountsError) {
      console.error('Threadsアカウント取得エラー:', accountsError)
      return NextResponse.json({ connected: false, accounts: [] })
    }

    const connected = !!threadsAccounts && threadsAccounts.length > 0
    return NextResponse.json({
      connected,
      accounts: (threadsAccounts || []).map(a => ({
        id: a.id,
        username: a.username,
      })),
    })

  } catch (error) {
    console.error('Threads連携状態確認エラー:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
