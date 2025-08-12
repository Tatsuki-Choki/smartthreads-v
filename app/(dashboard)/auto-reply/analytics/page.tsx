'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageCircle, TrendingUp, Clock, Users, BarChart3, Activity } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'

interface AnalyticsData {
  totalComments: number
  totalReplies: number
  responseRate: number
  avgResponseTime: number
  topKeywords: { keyword: string; count: number }[]
  recentActivity: {
    date: string
    comments: number
    replies: number
  }[]
  rulePerformance: {
    ruleName: string
    matches: number
    replies: number
  }[]
}

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspace()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchAnalytics()
    }
  }, [currentWorkspace, dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/auto-reply/analytics?workspace_id=${currentWorkspace?.id}&range=${dateRange}`,
        {
          headers: {
            'x-workspace-id': currentWorkspace?.id || '',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      // デモデータを設定
      setAnalytics({
        totalComments: 245,
        totalReplies: 189,
        responseRate: 77.1,
        avgResponseTime: 4.2,
        topKeywords: [
          { keyword: '質問', count: 45 },
          { keyword: '商品', count: 38 },
          { keyword: '価格', count: 27 },
          { keyword: 'サポート', count: 23 },
          { keyword: '購入', count: 19 },
        ],
        recentActivity: [
          { date: '2025-01-06', comments: 35, replies: 28 },
          { date: '2025-01-07', comments: 42, replies: 33 },
          { date: '2025-01-08', comments: 38, replies: 29 },
          { date: '2025-01-09', comments: 31, replies: 24 },
          { date: '2025-01-10', comments: 45, replies: 35 },
          { date: '2025-01-11', comments: 29, replies: 22 },
          { date: '2025-01-12', comments: 25, replies: 18 },
        ],
        rulePerformance: [
          { ruleName: '商品に関する質問', matches: 67, replies: 65 },
          { ruleName: 'お礼メッセージ', matches: 45, replies: 43 },
          { ruleName: 'サポート問い合わせ', matches: 38, replies: 36 },
          { ruleName: '購入希望', matches: 28, replies: 27 },
          { ruleName: 'その他', matches: 11, replies: 8 },
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">分析ダッシュボード</h2>
          <p className="text-muted-foreground">
            自動返信のパフォーマンスを分析します
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDateRange('24h')}
            className={`px-3 py-1 rounded ${
              dateRange === '24h' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            24時間
          </button>
          <button
            onClick={() => setDateRange('7d')}
            className={`px-3 py-1 rounded ${
              dateRange === '7d' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            7日間
          </button>
          <button
            onClick={() => setDateRange('30d')}
            className={`px-3 py-1 rounded ${
              dateRange === '30d' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            30日間
          </button>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総コメント数</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalComments || 0}</div>
            <p className="text-xs text-muted-foreground">
              受信したコメントの総数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総返信数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalReplies || 0}</div>
            <p className="text-xs text-muted-foreground">
              自動送信した返信の総数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">返信率</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.responseRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              コメントへの返信率
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均返信時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.avgResponseTime?.toFixed(1) || 0}秒
            </div>
            <p className="text-xs text-muted-foreground">
              コメント受信から返信まで
            </p>
          </CardContent>
        </Card>
      </div>

      {/* トップキーワード */}
      <Card>
        <CardHeader>
          <CardTitle>頻出キーワード</CardTitle>
          <CardDescription>
            コメントに含まれる頻出キーワードのトップ5
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.topKeywords?.map((keyword, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="font-medium">{keyword.keyword}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${(keyword.count / (analytics?.topKeywords[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {keyword.count}
                  </span>
                </div>
              </div>
            )) || (
              <p className="text-muted-foreground">データがありません</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ルールパフォーマンス */}
      <Card>
        <CardHeader>
          <CardTitle>ルール別パフォーマンス</CardTitle>
          <CardDescription>
            各自動返信ルールのマッチ数と返信数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.rulePerformance?.map((rule, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{rule.ruleName}</span>
                  <span className="text-sm text-muted-foreground">
                    {rule.replies} / {rule.matches} 返信
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${(rule.replies / rule.matches) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )) || (
              <p className="text-muted-foreground">データがありません</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* アクティビティグラフ（簡易版） */}
      <Card>
        <CardHeader>
          <CardTitle>最近のアクティビティ</CardTitle>
          <CardDescription>
            過去7日間のコメントと返信の推移
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.recentActivity?.map((day, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-20">
                  {new Date(day.date).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded h-4 relative">
                    <div
                      className="bg-blue-500 h-4 rounded absolute"
                      style={{
                        width: `${(day.comments / 50) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs w-8">{day.comments}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded h-4 relative">
                    <div
                      className="bg-green-500 h-4 rounded absolute"
                      style={{
                        width: `${(day.replies / 50) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs w-8">{day.replies}</span>
                </div>
              </div>
            )) || (
              <p className="text-muted-foreground">データがありません</p>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>コメント</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>返信</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}