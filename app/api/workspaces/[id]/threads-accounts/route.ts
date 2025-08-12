import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Threadsアカウント一覧取得 / 削除
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  
  // Admin client for bypassing RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  const workspaceId = params.id
  try {
    // まず通常の認証（cookie）を試行
    let user;
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    if (cookieError || !cookieUser) {
      console.log('Cookie認証失敗、Authorizationヘッダーをチェック:', cookieError?.message)
      
      // Authorizationヘッダーを確認
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

    // ワークスペースメンバーシップ確認（Adminクライアント使用）
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // アカウント一覧取得（Adminクライアント使用）
    console.log('Fetching threads accounts for workspace:', workspaceId)
    console.log('Using Admin client to bypass RLS')
    
    const { data: accounts, error } = await supabaseAdmin
      .from('threads_accounts')
      .select('id, username, created_at, threads_user_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    console.log('Query executed, error:', error)
    console.log('Query executed, data:', accounts)

    if (error) {
      console.error('Threadsアカウント取得エラー:', error)
      return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
    }

    console.log('取得したThreadsアカウント数:', accounts?.length || 0)
    if (accounts && accounts.length > 0) {
      console.log('アカウント詳細:', JSON.stringify(accounts, null, 2))
    } else {
      console.log('No threads accounts found for workspace:', workspaceId)
    }

    // UIが期待する最低限の形に整形
    const shaped = (accounts || []).map(a => ({
      id: a.id,
      username: a.username,
      created_at: a.created_at,
      status: 'active' as const,
      expires_at: null,
      threads_user_id: a.threads_user_id
    }))

    console.log('Returning shaped accounts:', JSON.stringify(shaped, null, 2))
    const response = { accounts: shaped }
    console.log('Full response:', JSON.stringify(response, null, 2))
    
    return NextResponse.json(response)
  } catch (e) {
    console.error('Threadsアカウント一覧API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  
  // Admin client for bypassing RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  const workspaceId = params.id
  try {
    // まず通常の認証（cookie）を試行
    let user;
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    
    if (cookieError || !cookieUser) {
      console.log('Cookie認証失敗、Authorizationヘッダーをチェック:', cookieError?.message)
      
      // Authorizationヘッダーを確認
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

    // メンバー確認（Adminクライアント使用）
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.json({ error: 'account_id が必要です' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('threads_accounts')
      .delete()
      .eq('id', accountId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Threadsアカウント削除エラー:', error)
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Threadsアカウント削除API エラー:', e)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

