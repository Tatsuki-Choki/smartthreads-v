'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClockIcon, EditIcon, TrashIcon, CopyIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/hooks/useWorkspace'
import { authenticatedFetch } from '@/lib/supabase/client-server'

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
  const router = useRouter()
  const { currentWorkspace } = useWorkspace()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = async () => {
    if (!currentWorkspace) return
    setLoading(true)
    setError(null)
    try {
      const resp = await authenticatedFetch(`/api/posts?workspace_id=${currentWorkspace.id}&status=scheduled`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || '取得に失敗しました')
      setPosts(data.posts || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id])

  const handleEdit = (postId: string) => {
    router.push(`/posts/scheduled/${postId}/edit`)
  }

  const handleDuplicate = async (postId: string) => {
    try {
      // 投稿データを取得
      const resp = await authenticatedFetch(`/api/posts/${postId}`)
      if (!resp.ok) {
        throw new Error('投稿データの取得に失敗しました')
      }
      const postData = await resp.json()
      
      // LocalStorageに保存
      const duplicateData = {
        content: postData.content,
        isThread: false,
        timestamp: Date.now()
      }
      localStorage.setItem('duplicatePost', JSON.stringify(duplicateData))
      
      // 新規投稿ページへ遷移
      router.push('/posts/new?mode=duplicate')
    } catch (error) {
      console.error('複製エラー:', error)
      alert('投稿の複製に失敗しました')
    }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('この予約投稿を削除しますか？')) return
    try {
      const resp = await authenticatedFetch(`/api/posts/${postId}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || '削除に失敗しました')
      await fetchPosts()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除エラー')
    }
  }

  const handlePostNow = async (postId: string) => {
    if (!confirm('この投稿を今すぐ投稿しますか？')) return
    try {
      const resp = await authenticatedFetch(`/api/posts/${postId}/publish`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || '投稿に失敗しました')
      await fetchPosts()
    } catch (e) {
      alert(e instanceof Error ? e.message : '投稿エラー')
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
        {loading ? (
          <Card>
            <CardContent className="pt-6">読み込み中...</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-red-600">{error}</CardContent>
          </Card>
        ) : posts.length === 0 ? (
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
          posts.map((post) => (
            <Card key={post.id} className={post.scheduled_at && isOverdue(post.scheduled_at) ? 'border-red-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className={`h-5 w-5 ${post.scheduled_at && isOverdue(post.scheduled_at) ? 'text-red-600' : 'text-blue-600'}`} />
                    <div>
                      <CardTitle className="text-lg">
                        予約投稿
                      </CardTitle>
                      <CardDescription>
                        {post.scheduled_at ? formatDate(post.scheduled_at) : '日時未設定'}
                        {post.scheduled_at && isOverdue(post.scheduled_at) && (
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
                      作成日時: {formatDate(post.created_at)}
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
                        variant="outline"
                        onClick={() => handleDuplicate(post.id)}
                      >
                        <CopyIcon className="mr-1 h-3 w-3" />
                        複製
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
