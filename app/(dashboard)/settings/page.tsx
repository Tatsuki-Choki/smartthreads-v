'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExternalLinkIcon, CheckCircleIcon, AlertCircleIcon, PlusIcon, TrashIcon, UserIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspace } from '@/hooks/useWorkspace'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    threadsAccounts,
    loading,
    error,
    createWorkspace,
    connectThreads,
    removeThreadsAccount
  } = useWorkspace()
  
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // URLパラメータからメッセージを取得
  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const messageParam = searchParams.get('message')
    const username = searchParams.get('username')

    if (success === 'threads_connected' && username) {
      setMessage({
        type: 'success',
        text: `@${username} とのThreads連携が完了しました`
      })
    } else if (error && messageParam) {
      setMessage({
        type: 'error',
        text: decodeURIComponent(messageParam)
      })
    }

    // 3秒後にメッセージを消去
    if (success || error) {
      setTimeout(() => setMessage(null), 5000)
    }
  }, [searchParams])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    setIsCreating(true)
    try {
      await createWorkspace(newWorkspaceName.trim())
      setNewWorkspaceName('')
      setMessage({
        type: 'success',
        text: 'ワークスペースを作成しました'
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'ワークスペースの作成に失敗しました'
      })
    }
    setIsCreating(false)
  }

  const handleConnectThreads = async () => {
    if (!currentWorkspace) return

    setIsConnecting(true)
    try {
      await connectThreads(currentWorkspace.id)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Threads連携の開始に失敗しました'
      })
      setIsConnecting(false)
    }
  }

  const handleRemoveAccount = async (accountId: string, username: string) => {
    if (!currentWorkspace) return
    if (!confirm(`@${username} のThreads連携を解除しますか？`)) return

    try {
      await removeThreadsAccount(currentWorkspace.id, accountId)
      setMessage({
        type: 'success',
        text: `@${username} の連携を解除しました`
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '連携解除に失敗しました'
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'invalid':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '接続中'
      case 'invalid':
        return '期限切れ'
      default:
        return 'エラー'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">読み込み中...</div>
  }

  // デバッグ情報
  console.log('Settings Debug:', {
    user: !!user,
    currentWorkspace: currentWorkspace?.id,
    workspacesCount: workspaces.length,
    isConnecting,
    error
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">
          ワークスペースとThreads連携の管理
        </p>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div className={`p-4 rounded-md border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* ワークスペース管理 */}
      <Card>
        <CardHeader>
          <CardTitle>ワークスペース管理</CardTitle>
          <CardDescription>
            ワークスペースを作成・切り替えできます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 現在のワークスペース */}
          {currentWorkspace ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="font-medium text-blue-900">現在のワークスペース</p>
              <p className="text-sm text-blue-700">{currentWorkspace.name}</p>
              <p className="text-xs text-blue-600">ID: {currentWorkspace.id}</p>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="font-medium text-gray-700">ワークスペースを読み込み中...</p>
              <p className="text-sm text-gray-600">初回アクセス時は自動でワークスペースを作成します</p>
            </div>
          )}

          {/* ワークスペース一覧 */}
          {workspaces.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">ワークスペースを切り替え</label>
              <select 
                value={currentWorkspace?.id || ''} 
                onChange={(e) => {
                  const workspace = workspaces.find(w => w.id === e.target.value)
                  if (workspace) setCurrentWorkspace(workspace)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 新しいワークスペース作成 */}
          <form onSubmit={handleCreateWorkspace} className="space-y-3">
            <label className="text-sm font-medium">新しいワークスペースを作成</label>
            <div className="flex gap-2">
              <Input
                placeholder="ワークスペース名"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                required
              />
              <Button type="submit" disabled={isCreating || !newWorkspaceName.trim()}>
                <PlusIcon className="mr-2 h-4 w-4" />
                {isCreating ? '作成中...' : '作成'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Threads連携 */}
      <Card>
        <CardHeader>
          <CardTitle>Threads連携</CardTitle>
          <CardDescription>
            Threadsアカウントと連携して投稿機能を有効にします
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 連携済みアカウント一覧 */}
          {threadsAccounts.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">連携済みアカウント</h4>
              {threadsAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">@{account.username}</p>
                      <p className="text-xs text-gray-500">
                        連携日: {new Date(account.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(account.status)}`}>
                      {getStatusText(account.status)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveAccount(account.id, account.username)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 新規連携ボタン */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">新しいThreadsアカウントを連携</p>
              <p className="text-sm text-muted-foreground">
                Threadsアカウントと連携して投稿機能を有効にしてください
              </p>
            </div>
            <Button 
              onClick={handleConnectThreads} 
              disabled={isConnecting || !currentWorkspace}
              title={!currentWorkspace ? 'ワークスペースを読み込み中...' : ''}
            >
              <ExternalLinkIcon className="mr-2 h-4 w-4" />
              {isConnecting ? '連携中...' : !currentWorkspace ? '読み込み中...' : 'Threadsと連携'}
            </Button>
          </div>

          {/* 連携手順 */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">連携の手順</h4>
            <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
              <li>「Threadsと連携」ボタンをクリック</li>
              <li>Threads APIの認証情報を入力</li>
              <li>Client ID、Client Secret、Access Tokenを設定</li>
              <li>ユーザー名と有効期限が表示されて連携完了</li>
            </ol>
          </div>
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
              <p className="text-sm text-muted-foreground">{user?.email || 'loading...'}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">アカウント作成日</h4>
              <p className="text-sm text-muted-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : 'loading...'}
              </p>
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