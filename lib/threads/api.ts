// Threads API v2.0 ユーティリティ
export interface ThreadsUser {
  id: string
  username: string
  name?: string
  threads_profile_picture_url?: string
  threads_biography?: string
}

export interface ThreadsTokenInfo {
  access_token: string
  token_type: string
  expires_in?: number
  expires_at?: string
}

export interface ThreadsApiError {
  error: {
    message: string
    type: string
    code: number
  }
}

export class ThreadsAPI {
  private baseUrl = 'https://graph.threads.net'
  
  constructor(private accessToken?: string) {}

  // ユーザー情報を取得
  async getUserInfo(fields: string[] = ['id', 'username', 'name', 'threads_profile_picture_url']): Promise<ThreadsUser> {
    if (!this.accessToken) {
      throw new Error('アクセストークンが設定されていません')
    }

    const fieldsParam = fields.join(',')
    const url = `${this.baseUrl}/v1.0/me?fields=${fieldsParam}&access_token=${this.accessToken}`

    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      const error = data as ThreadsApiError
      throw new Error(error.error?.message || 'ユーザー情報の取得に失敗しました')
    }

    return data as ThreadsUser
  }

  // アクセストークンの有効性を確認
  async validateToken(): Promise<boolean> {
    try {
      await this.getUserInfo(['id'])
      return true
    } catch (error) {
      return false
    }
  }

  // 長期間有効なアクセストークンを取得
  async getLongLivedAccessToken(shortLivedToken: string): Promise<ThreadsTokenInfo> {
    const url = `${this.baseUrl}/access_token`
    const params = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: process.env.THREADS_APP_SECRET!,
      access_token: shortLivedToken,
    })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as ThreadsApiError
      throw new Error(error.error?.message || '長期間トークンの取得に失敗しました')
    }

    // 有効期限を計算（通常60日）
    const expiresAt = data.expires_in 
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined

    return {
      ...data,
      expires_at: expiresAt
    } as ThreadsTokenInfo
  }

  // アクセストークンを更新
  async refreshAccessToken(accessToken: string): Promise<ThreadsTokenInfo> {
    const url = `${this.baseUrl}/refresh_access_token`
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: accessToken,
    })

    const response = await fetch(`${url}?${params}`)
    const data = await response.json()

    if (!response.ok) {
      const error = data as ThreadsApiError
      throw new Error(error.error?.message || 'トークンの更新に失敗しました')
    }

    // 有効期限を計算
    const expiresAt = data.expires_in 
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined

    return {
      ...data,
      expires_at: expiresAt
    } as ThreadsTokenInfo
  }
}

// OAuth認証URL生成
export function generateThreadsAuthUrl(redirectUri: string, scopes: string[] = ['threads_basic', 'threads_content_publish']): string {
  const baseUrl = 'https://threads.net/oauth/authorize'
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_THREADS_APP_ID || process.env.THREADS_APP_ID || '',
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    response_type: 'code',
  })

  return `${baseUrl}?${params}`
}

// 認証コードからアクセストークンを取得
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<ThreadsTokenInfo> {
  const url = 'https://graph.threads.net/oauth/access_token'
  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID!,
    client_secret: process.env.THREADS_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data as ThreadsApiError
    throw new Error(error.error?.message || 'アクセストークンの取得に失敗しました')
  }

  return data as ThreadsTokenInfo
}