import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  // TODO: 実際のデータを取得
  const stats = {
    totalPosts: 0,
    scheduledPosts: 0,
    publishedToday: 0,
    failedPosts: 0,
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

      {/* 統計カード */}
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

      {/* 最近の活動 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>最近の投稿</CardTitle>
            <CardDescription>
              直近の投稿活動を確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              まだ投稿がありません。
              <Link href="/posts/new" className="text-primary hover:underline ml-1">
                最初の投稿を作成
              </Link>
              してみましょう。
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>予約投稿</CardTitle>
            <CardDescription>
              今後の予定されている投稿
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              予約投稿がありません。
              <Link href="/posts/new" className="text-primary hover:underline ml-1">
                投稿をスケジュール
              </Link>
              してみましょう。
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}