import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ThreadsAPI } from '@/lib/threads/api'

// ワークスペースのThreadsアカウント一覧取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    // ワークスペースのメンバーシップを確認
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'このワークスペースへのアクセス権限がありません' },
        { status: 403 }
      )
    }

    // Threadsアカウント一覧を取得
    const { data: accounts, error } = await supabase
      .from('threads_accounts')
      .select('id, threads_user_id, username, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Threadsアカウント取得エラー:', error)
      return NextResponse.json(
        { error: 'Threadsアカウントの取得に失敗しました' },
        { status: 500 }
      )
    }

    // 各アカウントのトークン有効性をチェック
    const accountsWithStatus = await Promise.all(
      accounts.map(async (account) => {
        try {
          // アクセストークンを取得（復号化）
          const { data: tokenData } = await supabase
            .from('threads_accounts')
            .select('access_token')
            .eq('id', account.id)
            .single()

          if (!tokenData?.access_token) {
            return {
              ...account,
              access_token: undefined,
              status: 'invalid',
              expires_at: null
            }
          }

          const threadsAPI = new ThreadsAPI(tokenData.access_token)
          const isValid = await threadsAPI.validateToken()

          return {
            ...account,
            access_token: undefined, // セキュリティのため除外
            status: isValid ? 'active' : 'invalid',
            expires_at: null // TODO: 有効期限情報の追加
          }
        } catch (error) {
          return {
            ...account,
            access_token: undefined,
            status: 'error',
            expires_at: null
          }
        }
      })
    )

    return NextResponse.json({ accounts: accountsWithStatus })
  } catch (error) {
    console.error('Threadsアカウント一覧 API エラー:', error)
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 }
    )
  }
}

// Threadsアカウント削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'アカウントIDが必要です' },
        { status: 400 }
      )
    }

    // ワークスペースのメンバーシップを確認
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'このワークスペースへのアクセス権限がありません' },
        { status: 403 }
      )
    }

    // Threadsアカウントを削除
    const { error } = await supabase
      .from('threads_accounts')
      .delete()
      .eq('id', accountId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Threadsアカウント削除エラー:', error)
      return NextResponse.json(
        { error: 'Threadsアカウントの削除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Threadsアカウント削除 API エラー:', error)
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 }
    )
  }
}