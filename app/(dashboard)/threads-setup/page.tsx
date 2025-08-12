'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, ArrowLeft, User, Calendar, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'

export default function ThreadsSetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [fromSettings, setFromSettings] = useState(false)
  
  // フォームの状態
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  
  // 取得した情報の状態（ステップ1の結果）
  const [verifiedInfo, setVerifiedInfo] = useState<{
    username: string
    userId: string
    profilePictureUrl: string | null
    biography: string | null
    expiresAt: string | null
  } | null>(null)
  
  // 連携済み情報の状態
  const [threadsAccount, setThreadsAccount] = useState<{
    username: string
    userId: string
    expiresAt: string | null
  } | null>(null)

  const checkExistingConnection = useCallback(async () => {
    if (!user) return

    // セッションストレージからworkspaceIdを確認（設定画面から来た場合）
    const savedWorkspaceId = sessionStorage.getItem('workspace_id_for_threads')
    if (savedWorkspaceId) {
      setFromSettings(true)
      setWorkspaceId(savedWorkspaceId)
      sessionStorage.removeItem('workspace_id_for_threads')
      setChecking(false)
      return
    }

    try {
      // まずワークスペースを取得または作成
      const workspaceResponse = await fetch('/api/workspaces/current', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!workspaceResponse.ok) {
        // ワークスペースがない場合は作成
        setCreatingWorkspace(true)
        const createResponse = await fetch('/api/workspaces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'デフォルトワークスペース',
            slug: `workspace-${Date.now()}`,
          }),
        })

        if (createResponse.ok) {
          const data = await createResponse.json()
          const created = data?.workspace ?? data
          setWorkspaceId(created.id)
        }
        setCreatingWorkspace(false)
      } else {
        const workspace = await workspaceResponse.json()
        setWorkspaceId(workspace.id)
        
        // 既存の連携情報を確認
        if (workspace.threads_accounts && workspace.threads_accounts.length > 0) {
          const account = workspace.threads_accounts[0]
          setThreadsAccount({
            username: account.username,
            userId: account.threads_user_id,
            expiresAt: account.expires_at
          })
        }
      }
    } catch (error) {
      console.error('ワークスペース取得エラー:', error)
    } finally {
      setChecking(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    
    if (user) {
      checkExistingConnection()
    }
  }, [user, authLoading, checkExistingConnection, router])

  // ステップ1: ユーザー情報を取得（保存なし）
  const handleCheckCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Checking credentials...')
    
    setLoading(true)
    setVerifiedInfo(null)

    try {
      // Threads APIで認証情報を確認（保存なし）
      const response = await fetch('/api/auth/threads/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          access_token: accessToken,
        }),
      })

      console.log('Check response status:', response.status)
      const data = await response.json()
      console.log('Check response data:', data)

      if (!response.ok) {
        throw new Error(data.error || '認証情報の確認に失敗しました')
      }
      
      // 取得した情報を保存（UIに表示）
      setVerifiedInfo({
        username: data.username,
        userId: data.user_id,
        profilePictureUrl: data.profile_picture_url,
        biography: data.biography,
        expiresAt: data.expires_at,
      })

      toast({
        title: '確認成功',
        description: `@${data.username} の情報を取得しました`,
      })

    } catch (error) {
      console.error('確認エラー:', error)
      toast({
        title: '確認エラー',
        description: error instanceof Error ? error.message : '認証情報の確認に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ステップ2: 連携を確定（データベースに保存）
  const handleConfirmConnection = async () => {
    if (!workspaceId || !verifiedInfo) {
      console.error('No workspace ID or verified info')
      return
    }

    setVerifying(true)
    console.log('Confirming connection...')

    try {
      // Threads APIで認証情報を保存
      const response = await fetch('/api/auth/threads/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          access_token: accessToken,
        }),
      })

      console.log('Verify response status:', response.status)
      const data = await response.json()
      console.log('Verify response data:', data)

      if (!response.ok) {
        throw new Error(data.error || '連携の保存に失敗しました')
      }
      
      // 成功したら連携情報を表示
      setThreadsAccount({
        username: data.username,
        userId: data.user_id,
        expiresAt: data.expires_at,
      })

      toast({
        title: '連携成功',
        description: `@${data.username} のアカウントと連携しました`,
      })

      // 3秒後に適切なページへリダイレクト
      setTimeout(() => {
        if (fromSettings) {
          router.push('/settings')
        } else {
          router.push('/dashboard')
        }
      }, 3000)

    } catch (error) {
      console.error('連携エラー:', error)
      toast({
        title: '連携エラー',
        description: error instanceof Error ? error.message : '連携の保存に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setVerifying(false)
    }
  }

  const formatExpiryDate = (expiresAt: string | null) => {
    if (!expiresAt) return '無期限'
    const date = new Date(expiresAt)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || checking || creatingWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {authLoading ? '認証状態を確認中...' : creatingWorkspace ? 'ワークスペースを作成中...' : '連携状態を確認中...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            {fromSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/settings')}
                className="absolute left-6 top-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                設定に戻る
              </Button>
            )}
          </div>
          <CardTitle className="text-2xl text-center">
            Threads API連携設定
          </CardTitle>
          <CardDescription className="text-center">
            Threads APIの認証情報を入力してアカウントを連携します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {threadsAccount ? (
            // 連携済みの場合
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">連携済み</p>
                    <p className="text-sm text-green-700 mt-1">
                      @{threadsAccount.username} (ID: {threadsAccount.userId})
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      トークン有効期限: {formatExpiryDate(threadsAccount.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => router.push(fromSettings ? '/settings' : '/dashboard')}
                  className="flex-1"
                >
                  {fromSettings ? '設定に戻る' : 'ダッシュボードへ'}
                </Button>
                <Button 
                  onClick={() => {
                    setThreadsAccount(null)
                    setVerifiedInfo(null)
                    setClientId('')
                    setClientSecret('')
                    setAccessToken('')
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  再設定
                </Button>
              </div>
            </div>
          ) : (
            // 未連携の場合
            <div className="space-y-6">
              {/* ステップ1: 認証情報の入力 */}
              <form onSubmit={handleCheckCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    type="text"
                    placeholder="Threads App のClient IDを入力"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    disabled={loading || verifying}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="client-secret"
                      type={showClientSecret ? 'text' : 'password'}
                      placeholder="Threads App のClient Secretを入力"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      required
                      disabled={loading || verifying}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showClientSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="access-token">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="access-token"
                      type={showAccessToken ? 'text' : 'password'}
                      placeholder="長期アクセストークンを入力"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                      disabled={loading || verifying}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showAccessToken ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    60日間有効な長期アクセストークンを入力してください
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  size="lg"
                  disabled={loading || verifying || !clientId || !clientSecret || !accessToken}
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      確認中...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      ユーザー情報を取得
                    </>
                  )}
                </Button>
              </form>

              {/* ステップ2: 取得した情報の表示と連携確定 */}
              {verifiedInfo && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-lg">取得した情報</h3>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <User className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">
                          @{verifiedInfo.username}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          ID: {verifiedInfo.userId}
                        </p>
                        {verifiedInfo.biography && (
                          <p className="text-sm text-blue-600 mt-2">
                            {verifiedInfo.biography}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-900">
                          トークン有効期限
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">
                          {formatExpiryDate(verifiedInfo.expiresAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleConfirmConnection}
                    className="w-full"
                    size="lg"
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        連携中...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        このアカウントと連携
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* 取得方法の説明 */}
              {!verifiedInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">取得方法</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Meta for Developersでアプリを作成</li>
                        <li>Threads APIを有効化</li>
                        <li>Graph API Explorerでアクセストークンを生成</li>
                        <li>長期アクセストークンに交換</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}