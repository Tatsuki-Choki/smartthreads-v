'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    console.log('ログイン試行開始:', { email })
    
    try {
      const result = await signIn(email, password)
      console.log('ログイン結果:', result)
      
      if (result.success) {
        console.log('ログイン成功、初期化処理を実行')
        
        // ユーザーとワークスペースの初期化
        try {
          const initResponse = await fetch('/api/auth/initialize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          })
          
          const initData = await initResponse.json()
          console.log('初期化結果:', initData)
        } catch (initError) {
          console.error('初期化エラー（続行）:', initError)
        }
        
        // リダイレクト前に少し待機してセッションが確立されるのを待つ
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 強制的にページをリロードしてリダイレクト
        // 一時的にセッション情報をローカルストレージに保存（テスト用）
        localStorage.setItem('test_user', JSON.stringify({ email, loggedIn: true }))
        window.location.href = '/dashboard'
      } else {
        console.error('ログイン失敗:', result.error)
        setError(result.error || 'ログインに失敗しました')
        setLoading(false)
      }
    } catch (error) {
      console.error('ログイン処理中のエラー:', error)
      setError('ログイン処理中にエラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            アカウントにログインしてThreads運用を開始
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                メールアドレス
              </label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <Input
                id="password"
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-primary hover:underline">
              新規登録
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}