'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClockIcon, EditIcon, TrashIcon } from 'lucide-react'
import Link from 'next/link'

// TODO: 実際のデータはSupabaseから取得
const mockScheduledPosts = [
  {
    id: '1',
    content: '明日の朝に投稿予定のコンテンツです。新しい機能についてのお知らせです。',
    scheduledAt: '2024-01-16T09:00:00Z',
    createdAt: '2024-01-15T14:30:00Z',
  },
  {
    id: '2',
    content: '来週の月曜日に投稿予定です。週間レポートを共有します。',
    scheduledAt: '2024-01-22T10:00:00Z',
    createdAt: '2024-01-15T16:45:00Z',
  },
]

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60))
  
  const formatted = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })

  if (diffInHours < 24 && diffInHours > 0) {
    return `${formatted} (${diffInHours}時間後)`
  } else if (diffInHours < 0) {
    return `${formatted} (期限切れ)`
  } else {
    const diffInDays = Math.ceil(diffInHours / 24)
    return `${formatted} (${diffInDays}日後)`
  }
}

const isOverdue = (dateString: string) => {
  return new Date(dateString) < new Date()
}

export default function ScheduledPostsPage() {
  const handleEdit = (postId: string) => {
    // TODO: 編集機能実装
    alert(`投稿 ${postId} の編集機能は後で実装予定です`)
  }

  const handleDelete = (postId: string) => {
    // TODO: 削除機能実装
    if (confirm('この予約投稿を削除しますか？')) {
      alert(`投稿 ${postId} の削除機能は後で実装予定です`)
    }
  }

  const handlePostNow = (postId: string) => {
    // TODO: 即座投稿機能実装
    if (confirm('この投稿を今すぐ投稿しますか？')) {
      alert(`投稿 ${postId} の即座投稿機能は後で実装予定です`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">予約投稿</h1>
          <p className="text-muted-foreground">
            予約されている投稿の管理と編集
          </p>
        </div>
        <Link href="/posts/new">
          <Button>
            新規予約投稿
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {mockScheduledPosts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                予約投稿がありません。
                <Link href="/posts/new" className="text-primary hover:underline ml-1">
                  新しい予約投稿を作成
                </Link>
                してみましょう。
              </div>
            </CardContent>
          </Card>
        ) : (
          mockScheduledPosts.map((post) => (
            <Card key={post.id} className={isOverdue(post.scheduledAt) ? 'border-red-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className={`h-5 w-5 ${isOverdue(post.scheduledAt) ? 'text-red-600' : 'text-blue-600'}`} />
                    <div>
                      <CardTitle className="text-lg">
                        予約投稿
                      </CardTitle>
                      <CardDescription>
                        {formatDate(post.scheduledAt)}
                        {isOverdue(post.scheduledAt) && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            期限切れ
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">{post.content}</p>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      作成日時: {formatDate(post.createdAt)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(post.id)}
                      >
                        <EditIcon className="mr-1 h-3 w-3" />
                        編集
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePostNow(post.id)}
                      >
                        今すぐ投稿
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(post.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="mr-1 h-3 w-3" />
                        削除
                      </Button>
                    </div>
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