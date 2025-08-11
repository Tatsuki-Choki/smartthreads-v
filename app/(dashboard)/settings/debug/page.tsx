'use client'

import { useAuth } from '@/contexts/auth-context'
import { authenticatedFetch } from '@/lib/supabase/client-server'
import { useEffect, useState } from 'react'

export default function DebugPage() {
  const { user, loading } = useAuth()
  const [workspaceData, setWorkspaceData] = useState<any>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      // ワークスペースAPIを認証トークン付きでテスト
      authenticatedFetch('/api/workspaces')
        .then(res => {
          console.log('API Response Status:', res.status)
          return res.json()
        })
        .then(data => {
          console.log('API Response Data:', data)
          setWorkspaceData(data)
        })
        .catch(err => {
          console.error('API Error:', err)
          setApiError(err.message)
        })
    }
  }, [user])

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">デバッグ画面</h1>
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold">認証状態</h2>
        <p>Loading: {loading ? 'true' : 'false'}</p>
        <p>User: {user ? 'ログイン済み' : '未ログイン'}</p>
        <p>User ID: {user?.id || 'なし'}</p>
        <p>Email: {user?.email || 'なし'}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold">ワークスペースAPI</h2>
        <p>エラー: {apiError || 'なし'}</p>
        <pre className="text-xs bg-white p-2 rounded mt-2">
          {JSON.stringify(workspaceData, null, 2)}
        </pre>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold">環境変数</h2>
        <p>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '設定済み' : '未設定'}</p>
        <p>SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '設定済み' : '未設定'}</p>
      </div>
    </div>
  )
}