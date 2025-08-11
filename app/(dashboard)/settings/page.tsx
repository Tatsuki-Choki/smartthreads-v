'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExternalLinkIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState('マイワークスペース')
  const [threadsConnected, setThreadsConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConnectThreads = async () => {
    setLoading(true)
    // TODO: Threads OAuth実装
    setTimeout(() => {
      setLoading(false)
      alert('Threads連携機能は後で実装予定です')
    }, 1000)
  }

  const handleDisconnectThreads = async () => {
    if (confirm('Threadsアカウントとの連携を解除しますか？')) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setThreadsConnected(false)
        alert('連携を解除しました')
      }, 1000)
    }
  }

  const handleSaveWorkspace = async () => {
    setLoading(true)
    // TODO: ワークスペース設定保存
    setTimeout(() => {
      setLoading(false)
      alert('設定を保存しました')
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">
          アカウント設定とThreads連携の管理
        </p>
      </div>

      {/* ワークスペース設定 */}
      <Card>
        <CardHeader>
          <CardTitle>ワークスペース設定</CardTitle>
          <CardDescription>
            ワークスペースの基本情報を設定できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspaceName" className="text-sm font-medium">
              ワークスペース名
            </label>
            <Input
              id="workspaceName"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="ワークスペース名を入力"
            />
          </div>
          <Button onClick={handleSaveWorkspace} disabled={loading}>
            {loading ? '保存中...' : '設定を保存'}
          </Button>
        </CardContent>
      </Card>

      {/* Threads連携設定 */}
      <Card>
        <CardHeader>
          <CardTitle>Threads連携</CardTitle>
          <CardDescription>
            Threadsアカウントと連携して投稿機能を有効にします
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              {threadsConnected ? (
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircleIcon className="h-6 w-6 text-orange-500" />
              )}
              <div>
                <p className="font-medium">
                  {threadsConnected ? 'Threadsと連携済み' : 'Threadsとの連携が必要です'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {threadsConnected 
                    ? '@username でログイン中' 
                    : 'Threadsアカウントと連携して投稿機能を有効にしてください'
                  }
                </p>
              </div>
            </div>
            {threadsConnected ? (
              <Button 
                variant="outline" 
                onClick={handleDisconnectThreads}
                disabled={loading}
              >
                連携解除
              </Button>
            ) : (
              <Button onClick={handleConnectThreads} disabled={loading}>
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                {loading ? '連携中...' : 'Threadsと連携'}
              </Button>
            )}
          </div>

          {!threadsConnected && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">連携の手順</h4>
              <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                <li>「Threadsと連携」ボタンをクリック</li>
                <li>Threadsにログインして認証</li>
                <li>アプリケーションへのアクセスを許可</li>
                <li>連携完了後、投稿機能が利用可能になります</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* アカウント設定 */}
      <Card>
        <CardHeader>
          <CardTitle>アカウント設定</CardTitle>
          <CardDescription>
            アカウントの基本設定とセキュリティ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">メールアドレス</h4>
              <p className="text-sm text-muted-foreground">user@example.com</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">アカウント作成日</h4>
              <p className="text-sm text-muted-foreground">2024年1月15日</p>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Button variant="outline" className="text-red-600 hover:bg-red-50">
              アカウントを削除
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}