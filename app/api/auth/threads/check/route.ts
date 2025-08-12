import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('===== Threads Check API Started =====')
  
  try {
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
      // デバッグAPIが失敗した場合、60日後を仮の有効期限とする
      const sixtyDaysFromNow = new Date()
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)
      expiresAt = sixtyDaysFromNow.toISOString()
    }

    // 成功レスポンス（データベースには保存しない）
    const successResponse = {
      success: true,
      user_id: userData.id,
      username: userData.username,
      profile_picture_url: userData.threads_profile_picture_url || null,
      expires_at: expiresAt,
    }
    
    console.log('===== Threads Check API Success =====')
    console.log('Returning response:', successResponse)
    
    return NextResponse.json(successResponse)

  } catch (error) {
    console.error('===== Threads Check API Error =====')
    console.error('Threads API エラー:', error)
    return NextResponse.json(
      { error: '認証情報の確認中にエラーが発生しました' },
      { status: 500 }
    )
  }
}