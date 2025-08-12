'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useWorkspace } from '@/hooks/useWorkspace'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { 
    threadsAccounts, 
    currentWorkspace, 
    loading: workspaceLoading,
    checkingThreads,
    threadsLoaded 
  } = useWorkspace()
  const [threadsConnected, setThreadsConnected] = useState(false)

  useEffect(() => {
    // 一時的にローカルストレージで認証チェック（テスト用）
    const testUser = localStorage.getItem('test_user')
    if (!testUser && !loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Threads連携状態をチェック
  useEffect(() => {
    // threadsAccountsが存在し、1つ以上のアカウントがある場合は連携済みとする
    setThreadsConnected(threadsAccounts && threadsAccounts.length > 0)
  }, [threadsAccounts])
  // TODO: 実際のデータを取得
  const stats = {
    totalPosts: 0,
    scheduledPosts: 0,
    publishedToday: 0,
    failedPosts: 0,
  }

  // 段階的な読み込み状態を表示
  const isInitialLoading = loading || workspaceLoading
  const isCheckingThreads = checkingThreads
  const isReady = !isInitialLoading && threadsLoaded

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">アカウント情報を読み込み中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isCheckingThreads && !threadsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Threads連携状態を確認中...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Threads未連携の場合の表示（より親しみやすく）
  if (isReady && !threadsConnected) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
        </div>
        
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <AlertCircleIcon className="h-5 w-5 text-blue-600" />
              Threadsアカウントと連携しましょう
            </CardTitle>
            <CardDescription className="text-blue-700">
              投稿を開始するために、まずはThreadsアカウントとの連携設定を行います。数分で完了します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-blue-600">
                <p className="font-medium mb-2">連携により可能になること:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>自動投稿とスケジュール投稿</li>
                  <li>ツリー投稿（連続投稿）</li>
                  <li>コメント自動返信（今後対応予定）</li>
                </ul>
              </div>
              <Link href="/threads-setup">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  🔗 Threadsと連携を開始する
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 統計カード（プレビュー表示） */}
        <div className="opacity-40 pointer-events-none">
          <div className="text-sm text-gray-500 mb-4 text-center">
            連携後に利用できる機能のプレビュー
          </div>
          {renderStatsCards()}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Link href="/posts/new">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            新規投稿
          </Button>
        </Link>
      </div>
      
      {renderStatsCards()}
    </div>
  )

  function renderStatsCards() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              総投稿数
            </CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts}</div>
            <p className="text-xs text-muted-foreground">
              すべての投稿
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              予約投稿
            </CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
            <p className="text-xs text-muted-foreground">
              投稿待ち
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              本日の投稿
            </CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publishedToday}</div>
            <p className="text-xs text-muted-foreground">
              今日投稿された数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              失敗投稿
            </CardTitle>
            <AlertCircleIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedPosts}</div>
            <p className="text-xs text-muted-foreground">
              エラーで失敗
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

}