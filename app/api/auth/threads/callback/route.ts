import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { exchangeCodeForToken, ThreadsAPI } from '@/lib/threads/api'

// Threads OAuth コールバック処理
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // workspace_id
    const error = searchParams.get('error')

    if (error) {
      const errorDescription = searchParams.get('error_description')
      console.error('Threads OAuth エラー:', error, errorDescription)
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=oauth_error&message=${encodeURIComponent(errorDescription || 'OAuth認証に失敗しました')}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=missing_params&message=${encodeURIComponent('認証パラメータが不正です')}`)
    }

    const workspaceId = state

    // 現在のユーザーを取得
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.redirect(`${request.nextUrl.origin}/login?error=auth_required&message=${encodeURIComponent('ログインが必要です')}`)
    }

    // ワークスペースのメンバーシップを確認
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=workspace_access&message=${encodeURIComponent('ワークスペースへのアクセス権限がありません')}`)
    }

    // リダイレクトURIを生成
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3002'
    
    const redirectUri = `${baseUrl}/api/auth/threads/callback`

    // 認証コードをアクセストークンに交換
    const tokenInfo = await exchangeCodeForToken(code, redirectUri)

    // 短期間トークンを長期間トークンに交換
    const threadsAPI = new ThreadsAPI(tokenInfo.access_token)
    const longLivedToken = await threadsAPI.getLongLivedAccessToken(tokenInfo.access_token)

    // ユーザー情報を取得
    const longLivedAPI = new ThreadsAPI(longLivedToken.access_token)
    const userInfo = await longLivedAPI.getUserInfo()

    // データベースにThreadsアカウント情報を保存
    const { error: insertError } = await supabase
      .from('threads_accounts')
      .upsert({
        workspace_id: workspaceId,
        threads_user_id: userInfo.id,
        username: userInfo.username,
        access_token: longLivedToken.access_token, // TODO: 暗号化
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,threads_user_id'
      })

    if (insertError) {
      console.error('Threadsアカウント保存エラー:', insertError)
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=database_error&message=${encodeURIComponent('アカウント情報の保存に失敗しました')}`)
    }

    // 成功時は設定ページにリダイレクト
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?success=threads_connected&username=${encodeURIComponent(userInfo.username)}`)

  } catch (error) {
    console.error('Threads OAuth コールバックエラー:', error)
    const errorMessage = error instanceof Error ? error.message : 'Threads連携に失敗しました'
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?error=connection_failed&message=${encodeURIComponent(errorMessage)}`)
  }
}