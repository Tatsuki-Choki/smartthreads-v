'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon, XCircleIcon, ClockIcon, ExternalLinkIcon } from 'lucide-react'
import { clsx } from 'clsx'

// TODO: 実際のデータはSupabaseから取得
const mockPosts = [
  {
    id: '1',
    content: 'これは投稿されたサンプルテキストです。Threadsへの自動投稿のテストです。',
    status: 'published' as const,
    scheduledAt: null,
    publishedAt: '2024-01-15T10:30:00Z',
    threadsPostId: 'thread_123',
    errorMessage: null,
  },
  {
    id: '2',
    content: '予定されている投稿のサンプルです。後で自動的に投稿されます。',
    status: 'scheduled' as const,
    scheduledAt: '2024-01-16T14:00:00Z',
    publishedAt: null,
    threadsPostId: null,
    errorMessage: null,
  },
  {
    id: '3',
    content: 'エラーが発生した投稿のサンプルです。',
    status: 'failed' as const,
    scheduledAt: '2024-01-14T09:00:00Z',
    publishedAt: null,
    threadsPostId: null,
    errorMessage: 'Threads APIの認証に失敗しました',
  },
]

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'published':
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />
    case 'failed':
      return <XCircleIcon className="h-5 w-5 text-red-600" />
    case 'scheduled':
      return <ClockIcon className="h-5 w-5 text-blue-600" />
    default:
      return <ClockIcon className="h-5 w-5 text-gray-400" />
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'published':
      return '投稿済み'
    case 'failed':
      return '失敗'
    case 'scheduled':
      return '予約中'
    case 'draft':
      return '下書き'
    default:
      return '不明'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'published':
      return 'text-green-700 bg-green-50'
    case 'failed':
      return 'text-red-700 bg-red-50'
    case 'scheduled':
      return 'text-blue-700 bg-blue-50'
    case 'draft':
      return 'text-gray-700 bg-gray-50'
    default:
      return 'text-gray-700 bg-gray-50'
  }
}

export default function PostHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">投稿履歴</h1>
          <p className="text-muted-foreground">
            すべての投稿の状態を確認できます
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {mockPosts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                まだ投稿がありません。
              </div>
            </CardContent>
          </Card>
        ) : (
          mockPosts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(post.status)}
                    <span
                      className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        getStatusColor(post.status)
                      )}
                    >
                      {getStatusText(post.status)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {post.publishedAt && formatDate(post.publishedAt)}
                    {post.scheduledAt && !post.publishedAt && 
                      `予定: ${formatDate(post.scheduledAt)}`
                    }
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">{post.content}</p>
                  
                  {post.errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">
                        <strong>エラー:</strong> {post.errorMessage}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      投稿ID: {post.id}
                    </div>
                    {post.threadsPostId && (
                      <Button size="sm" variant="outline">
                        <ExternalLinkIcon className="mr-2 h-3 w-3" />
                        Threadsで表示
                      </Button>
                    )}
                    {post.status === 'failed' && (
                      <Button size="sm" variant="outline">
                        再試行
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}