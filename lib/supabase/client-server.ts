// クライアントサイドからサーバーAPIを呼び出すためのユーティリティ

import { supabase } from './client'

// 認証トークンを含めたAPIリクエスト
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('ログインが必要です')
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}