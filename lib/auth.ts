'use client'

import { supabase } from '@/lib/supabase/client'
import { AuthError } from '@supabase/supabase-js'

export interface AuthResult {
  success: boolean
  error?: string
  user?: any
}

// サインアップ
export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return {
        success: false,
        error: getJapaneseErrorMessage(error)
      }
    }

    return {
      success: true,
      user: data.user
    }
  } catch (error) {
    return {
      success: false,
      error: 'アカウント作成中にエラーが発生しました'
    }
  }
}

// サインイン
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    console.log('Supabase signIn開始:', { email })
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('Supabase signIn結果:', { 
      success: !error, 
      user: data?.user?.email,
      session: !!data?.session,
      error: error?.message 
    })

    if (error) {
      console.error('Supabase認証エラー:', error)
      return {
        success: false,
        error: getJapaneseErrorMessage(error)
      }
    }

    // セッションの確認
    const { data: sessionData } = await supabase.auth.getSession()
    console.log('現在のセッション:', {
      hasSession: !!sessionData.session,
      userEmail: sessionData.session?.user?.email
    })

    return {
      success: true,
      user: data.user
    }
  } catch (error) {
    console.error('予期しないエラー:', error)
    return {
      success: false,
      error: 'ログイン中にエラーが発生しました'
    }
  }
}

// サインアウト
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        success: false,
        error: 'ログアウト中にエラーが発生しました'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: 'ログアウト中にエラーが発生しました'
    }
  }
}

// 現在のユーザーを取得
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('ユーザー情報取得エラー:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error)
    return null
  }
}

// エラーメッセージの日本語化
function getJapaneseErrorMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'メールアドレスまたはパスワードが間違っています'
    case 'Email not confirmed':
      return 'メールアドレスの確認が完了していません'
    case 'Password should be at least 6 characters':
      return 'パスワードは6文字以上で入力してください'
    case 'User already registered':
      return 'このメールアドレスは既に登録されています'
    case 'Invalid email':
      return '有効なメールアドレスを入力してください'
    case 'Signup is disabled':
      return '新規登録は現在無効になっています'
    default:
      return error.message || '認証中にエラーが発生しました'
  }
}