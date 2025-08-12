'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = '/login' }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // 一時的に認証チェックを無効化（開発中）
  const skipAuth = true

  useEffect(() => {
    if (!skipAuth && !loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo, skipAuth])

  if (!skipAuth && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>認証状態を確認中...</p>
        </div>
      </div>
    )
  }

  if (!skipAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>ログインが必要です。リダイレクト中...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}