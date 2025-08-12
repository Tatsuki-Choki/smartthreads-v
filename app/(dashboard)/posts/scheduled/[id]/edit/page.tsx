'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Calendar, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useWorkspace } from '@/hooks/useWorkspace'

interface Post {
  id: string
  content: string
  scheduled_at: string
  status: string
  threads_accounts?: {
    id: string
    username: string
    threads_user_id: string
  }
}

export default function EditScheduledPostPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { currentWorkspace } = useWorkspace()
  const [post, setPost] = useState<Post | null>(null)
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true)
        console.log('編集対象の投稿ID:', params.id)
        
        const response = await fetch(`/api/posts/${params.id}`, {
          headers: {
            'x-workspace-id': currentWorkspace?.id || '',
          }
        })
        
        if (!response.ok) {
          const data = await response.json()
          console.error('API エラーレスポンス:', data)
          throw new Error(data.error || '投稿の取得に失敗しました')
        }
  
        const data = await response.json()
        console.log('取得した投稿データ:', data)
        setPost(data)
        setContent(data.content)
        
        // 日時フォーマットを調整
        if (data.scheduled_at) {
          const date = new Date(data.scheduled_at)
          const localDatetime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
          setScheduledAt(localDatetime)
        }
      } catch (error) {
        console.error('投稿取得エラー:', error)
        setError(error instanceof Error ? error.message : '投稿の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (currentWorkspace) {
      fetchPost()
    }
  }, [currentWorkspace, params.id])

  const handleSave = async () => {
    if (!content.trim()) {
      setError('投稿内容を入力してください')
      return
    }

    if (!scheduledAt) {
      setError('予約日時を設定してください')
      return
    }

    // 過去の日時チェック
    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      setError('予約日時は現在より未来を指定してください')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const response = await fetch(`/api/posts/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': currentWorkspace?.id || '',
        },
        body: JSON.stringify({
          content,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '更新に失敗しました')
      }

      setSuccess('予約投稿を更新しました')
      setTimeout(() => {
        router.push('/posts/scheduled')
      }, 2000)
    } catch (error) {
      console.error('更新エラー:', error)
      setError(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">投稿が見つかりません</p>
            <div className="flex justify-center mt-4">
              <Link href="/posts/scheduled">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  予約投稿一覧へ戻る
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (post.status !== 'scheduled') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">予約中の投稿のみ編集できます</p>
            <div className="flex justify-center mt-4">
              <Link href="/posts/scheduled">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  予約投稿一覧へ戻る
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/posts/scheduled">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              予約投稿一覧へ戻る
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              予約投稿を編集
            </CardTitle>
            {post.threads_accounts && (
              <p className="text-sm text-gray-500">
                Threadsアカウント: @{post.threads_accounts.username}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                {error}
              </div>
            )}

            {/* 成功メッセージ */}
            {success && (
              <div className="bg-green-50 text-green-600 p-4 rounded-lg">
                {success}
              </div>
            )}

            {/* 投稿内容 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                投稿内容
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="投稿する内容を入力してください"
                className="min-h-[150px]"
                maxLength={500}
              />
              <p className="text-sm text-gray-500 mt-1">
                {content.length}/500 文字
              </p>
            </div>

            {/* 予約日時 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                予約日時
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* アクションボタン */}
            <div className="flex justify-end space-x-4">
              <Link href="/posts/scheduled">
                <Button variant="outline">
                  キャンセル
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving || !content.trim() || !scheduledAt}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    更新
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}