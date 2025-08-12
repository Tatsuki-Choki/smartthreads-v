import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function POST(request: NextRequest) {
  console.log('===== Threads Verify API Started =====')
  
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // 認証チェック（開発モードではスキップ可能）
    const skipAuth = process.env.SKIP_AUTH_CHECK === 'true'
    let userId = 'dev-user-id'
    
    if (!skipAuth) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('Auth check:', { userId: user?.id, error: authError })
      
      if (authError || !user) {
        console.error('Auth error:', authError)
        return NextResponse.json(
          { error: '認証が必要です' },
          { status: 401 }
        )
      }
      userId = user.id
    } else {
      console.log('Skipping auth check (dev mode)')
    }

    // ワークスペースIDを取得
    const workspaceId = request.headers.get('x-workspace-id')
    console.log('Workspace ID:', workspaceId)
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      )
    }

    // リクエストボディから認証情報を取得
    const body = await request.json()
    const { client_id, client_secret, access_token } = body
    console.log('Received credentials:', { 
      client_id: client_id ? 'PROVIDED' : 'MISSING',
      client_secret: client_secret ? 'PROVIDED' : 'MISSING',
      access_token: access_token ? `${access_token.substring(0, 10)}...` : 'MISSING'
    })

    if (!client_id || !client_secret || !access_token) {
      return NextResponse.json(
        { error: '必要な認証情報が不足しています' },
        { status: 400 }
      )
    }

    // Threads API でユーザー情報を取得
    console.log('Calling Threads API /me endpoint...')
    const meUrl = `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${access_token}`
    console.log('Request URL:', meUrl.replace(access_token, 'REDACTED'))
    
    const meResponse = await fetch(meUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    console.log('Threads API Response Status:', meResponse.status)
    const responseText = await meResponse.text()
    console.log('Threads API Response Body:', responseText)

    if (!meResponse.ok) {
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }
      console.error('Threads API エラー:', errorData)
      return NextResponse.json(
        { error: errorData.error?.message || 'アクセストークンが無効です' },
        { status: 401 }
      )
    }

    const userData = JSON.parse(responseText)
    console.log('User data retrieved:', userData)
    
    // アクセストークンの有効期限を確認（デバッグAPIを使用）
    console.log('Calling debug_token endpoint...')
    const debugUrl = `https://graph.threads.net/debug_token?input_token=${access_token}&access_token=${client_id}|${client_secret}`
    
    const debugResponse = await fetch(debugUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    console.log('Debug API Response Status:', debugResponse.status)
    let expiresAt: string | null = null
    
    if (debugResponse.ok) {
      const debugData = await debugResponse.json()
      console.log('Debug data:', debugData)
      
      if (debugData.data && debugData.data.expires_at) {
        // Unix timestampをISO文字列に変換
        expiresAt = new Date(debugData.data.expires_at * 1000).toISOString()
        console.log('Token expires at:', expiresAt)
      }
    } else {
      console.log('Debug token API failed, continuing without expiry info')
    }

    // データベース保存（認証スキップに関わらず常に実行）
    console.log('Saving to database...')
    
    // 既存のThreadsアカウントをチェック（Adminクライアント使用）
    const { data: existingAccount } = await supabaseAdmin
      .from('threads_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('threads_user_id', userData.id)
      .single()

    if (existingAccount) {
      // 既存のアカウント情報を更新（Adminクライアント使用）
      console.log('Updating existing account:', existingAccount.id)
      const { data: updatedAccount, error: updateError } = await supabaseAdmin
        .from('threads_accounts')
        .update({
          username: userData.username,
          access_token: access_token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id)
        .select()
        .single()

      if (updateError) {
        console.error('アカウント更新エラー:', updateError)
        return NextResponse.json(
          { error: 'アカウント情報の更新に失敗しました' },
          { status: 500 }
        )
      }
      console.log('Account updated successfully:', updatedAccount)
    } else {
      // 新規アカウントを作成（Adminクライアント使用）
      console.log('Creating new account for workspace:', workspaceId)
      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('threads_accounts')
        .insert({
          workspace_id: workspaceId,
          threads_user_id: userData.id,
          username: userData.username,
          access_token: access_token,
        })
        .select()
        .single()

      if (insertError) {
        console.error('アカウント作成エラー:', insertError)
        // エラー詳細をログに出力
        console.error('エラー詳細:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        })
        return NextResponse.json(
          { error: 'アカウント情報の保存に失敗しました' },
          { status: 500 }
        )
      }
      console.log('Account created successfully:', newAccount)
    }

    // 成功レスポンス
    const successResponse = {
      success: true,
      user_id: userData.id,
      username: userData.username,
      profile_picture_url: userData.threads_profile_picture_url || null,
      expires_at: expiresAt,
    }
    
    console.log('===== Threads Verify API Success =====')
    console.log('Returning response:', successResponse)
    
    return NextResponse.json(successResponse)

  } catch (error) {
    console.error('===== Threads Verify API Error =====')
    console.error('Threads認証エラー:', error)
    return NextResponse.json(
      { error: '認証処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}