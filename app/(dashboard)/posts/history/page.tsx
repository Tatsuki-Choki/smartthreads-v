'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClockIcon, AlertCircleIcon, CheckCircleIcon, MessageSquareIcon, CopyIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/hooks/useWorkspace'
import { authenticatedFetch } from '@/lib/supabase/client-server'

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
}

export default function PostHistoryPage() {
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
      const resp = await authenticatedFetch(`/api/posts?workspace_id=${currentWorkspace.id}`)
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

  const handleDuplicateThread = async (threadPosts: any[]) => {
    try {
      // ツリー投稿データを整形
      const contents = threadPosts.map(post => post.content)
      
      // LocalStorageに保存
      const duplicateData = {
        contents,
        isThread: true,
        timestamp: Date.now()
      }
      localStorage.setItem('duplicatePost', JSON.stringify(duplicateData))
      
      // 新規投稿ページへ遷移
      router.push('/posts/new?mode=duplicate')
    } catch (error) {
      console.error('ツリー投稿複製エラー:', error)
      alert('ツリー投稿の複製に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">投稿履歴</h1>
          <p className="text-muted-foreground">
            これまでの投稿内容を確認
          </p>
        </div>
        <a href="/posts/new">
          <Button>新規投稿</Button>
        </a>
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
                まだ投稿履歴がありません。
                <a href="/posts/new" className="text-primary hover:underline ml-1">
                  最初の投稿を作成
                </a>
                してみましょう。
              </div>
            </CardContent>
          </Card>
        ) : (
          (() => {
            // ツリー投稿をグループ化
            const threadGroups = new Map<string, any[]>()
            const standaloneThreads = new Map<string, any>()
            const standalonePosts: any[] = []
            
            posts.forEach(post => {
              if (post.thread_root_id) {
                // ツリー投稿
                if (!threadGroups.has(post.thread_root_id)) {
                  threadGroups.set(post.thread_root_id, [])
                }
                threadGroups.get(post.thread_root_id)!.push(post)
              } else if (post.parent_post_id) {
                // 親投稿IDがあるがthread_root_idがない（親が削除された？）
                standalonePosts.push(post)
              } else {
                // 通常の単独投稿
                standalonePosts.push(post)
              }
            })
            
            // ツリーグループをソートし、各グループ内もソート
            const sortedThreads = Array.from(threadGroups.entries()).map(([rootId, threadPosts]) => {
              return threadPosts.sort((a, b) => (a.thread_position || 0) - (b.thread_position || 0))
            })
            
            // 最新のツリーから表示（ルート投稿の作成時間でソート）
            sortedThreads.sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime())
            
            // 単独投稿も日時順にソート
            standalonePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            
            const allItems: Array<{ type: 'thread' | 'post', data: any }> = []
            
            // ツリー投稿を追加
            sortedThreads.forEach(threadPosts => {
              allItems.push({ type: 'thread', data: threadPosts })
            })
            
            // 単独投稿を追加
            standalonePosts.forEach(post => {
              allItems.push({ type: 'post', data: post })
            })
            
            return allItems.map((item, index) => {
              if (item.type === 'thread') {
                const threadPosts = item.data
                const rootPost = threadPosts[0]
                const allPublished = threadPosts.every((p: any) => p.status === 'published')
                const anyFailed = threadPosts.some((p: any) => p.status === 'failed')
                
                return (
                  <Card key={`thread-${rootPost.id}`} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MessageSquareIcon className="h-5 w-5 text-blue-600" />
                          {allPublished ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          ) : anyFailed ? (
                            <AlertCircleIcon className="h-5 w-5 text-red-600" />
                          ) : (
                            <ClockIcon className="h-5 w-5 text-blue-600" />
                          )}
                          <div>
                            <CardTitle className="text-lg">
                              ツリー投稿 ({threadPosts.length}つの投稿)
                            </CardTitle>
                            <CardDescription>
                              {rootPost.published_at ? formatDate(rootPost.published_at) : formatDate(rootPost.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateThread(threadPosts)}
                          >
                            <CopyIcon className="mr-1 h-3 w-3" />
                            複製
                          </Button>
                          {anyFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                              // 失敗した投稿のみ再試行
                              for (const post of threadPosts.filter((p: any) => p.status === 'failed')) {
                                try {
                                  const resp = await authenticatedFetch(`/api/posts/${post.id}/publish`, { method: 'POST' })
                                  const data = await resp.json()
                                  if (!resp.ok) throw new Error(data?.error || '再試行に失敗しました')
                                } catch (e) {
                                  alert(`投稿 ${post.thread_position + 1} の再試行エラー: ${e instanceof Error ? e.message : '不明なエラー'}`)
                                  break
                                }
                              }
                              fetchPosts()
                            }}
                          >
                            再試行
                          </Button>
                        )}
                      </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {threadPosts.map((post: any, idx: number) => (
                        <div key={post.id} className="border-l-2 border-l-gray-200 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">
                              投稿 {idx + 1}
                            </span>
                            {post.status === 'published' ? (
                              <CheckCircleIcon className="h-3 w-3 text-green-600" />
                            ) : post.status === 'failed' ? (
                              <AlertCircleIcon className="h-3 w-3 text-red-600" />
                            ) : (
                              <ClockIcon className="h-3 w-3 text-blue-600" />
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                          {post.error_message && (
                            <p className="text-xs text-red-600 mt-1">エラー: {post.error_message}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              } else {
                const post = item.data
                const isPublished = post.status === 'published'
                const isFailed = post.status === 'failed'
                
                return (
                  <Card key={post.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {isPublished ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          ) : isFailed ? (
                            <AlertCircleIcon className="h-5 w-5 text-red-600" />
                          ) : (
                            <ClockIcon className="h-5 w-5 text-blue-600" />
                          )}
                          <div>
                            <CardTitle className="text-lg">
                              {isPublished ? '投稿済み' : isFailed ? '失敗' : '履歴'}
                            </CardTitle>
                            <CardDescription>
                              {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicate(post.id)}
                          >
                            <CopyIcon className="mr-1 h-3 w-3" />
                            複製
                          </Button>
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                              try {
                                const resp = await authenticatedFetch(`/api/posts/${post.id}/publish`, { method: 'POST' })
                                const data = await resp.json()
                                if (!resp.ok) throw new Error(data?.error || '再試行に失敗しました')
                                fetchPosts()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : '再試行エラー')
                              }
                            }}
                          >
                            再試行
                          </Button>
                        )}
                      </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                      {post.error_message && (
                        <p className="text-xs text-red-600 mt-2">エラー: {post.error_message}</p>
                      )}
                    </CardContent>
                  </Card>
                )
              }
            })
          })()
        )}
      </div>
    </div>
  )
}
