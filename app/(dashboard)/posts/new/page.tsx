'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  CalendarIcon, 
  ClockIcon, 
  SendIcon, 
  PlusIcon, 
  MinusIcon, 
  MessageSquareIcon,
  ImageIcon,
  VideoIcon,
  LayoutGridIcon,
  XIcon,
  Upload
} from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { authenticatedFetch } from '@/lib/supabase/client-server'
import { useToast } from '@/components/ui/use-toast'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface MediaUpload {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string;
}

export default function NewPostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentWorkspace, threadsAccounts, loading: wsLoading, error: wsError } = useWorkspace()
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  
  // メディア関連のstate
  const [mediaType, setMediaType] = useState<'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL'>('TEXT')
  const [mediaUploads, setMediaUploads] = useState<MediaUpload[]>([])
  const [uploading, setUploading] = useState(false)
  
  // ツリー投稿関連のstate
  const [isThreadPost, setIsThreadPost] = useState(false)
  const [threadPosts, setThreadPosts] = useState<{ content: string; media?: MediaUpload[] }[]>([{ content: '', media: [] }])
  const [currentThreadIndex, setCurrentThreadIndex] = useState(0)
  
  // カルーセル投稿関連のstate
  const [carouselItems, setCarouselItems] = useState<{ media: MediaUpload | null; caption: string }[]>([])

  // プリセットで最初のアカウントを選択
  useEffect(() => {
    if (!wsLoading && threadsAccounts?.length && !accountId) {
      setAccountId(threadsAccounts[0].id)
    }
  }, [wsLoading, threadsAccounts, accountId])

  // 複製データの読み込み
  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'duplicate') {
      // LocalStorageから複製データを取得
      const duplicateDataStr = localStorage.getItem('duplicatePost')
      if (duplicateDataStr) {
        try {
          const duplicateData = JSON.parse(duplicateDataStr)
          
          // 24時間以上経過していたら削除
          if (Date.now() - duplicateData.timestamp > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('duplicatePost')
            return
          }
          
          // データをフォームに設定
          if (duplicateData.isThread && duplicateData.contents) {
            // ツリー投稿の場合
            setIsThreadPost(true)
            const posts = duplicateData.contents.map((content: string) => ({ 
              content, 
              media: [] 
            }))
            setThreadPosts(posts)
            setCurrentThreadIndex(0)
            setIsDuplicate(true)
            toast({
              title: '複製データを読み込みました',
              description: 'ツリー投稿の内容が自動入力されました',
            })
          } else if (duplicateData.content) {
            // 通常投稿の場合
            setContent(duplicateData.content)
            setIsDuplicate(true)
            toast({
              title: '複製データを読み込みました',
              description: '投稿内容が自動入力されました',
            })
          }
          
          // LocalStorageをクリア
          localStorage.removeItem('duplicatePost')
        } catch (error) {
          console.error('複製データの読み込みエラー:', error)
          localStorage.removeItem('duplicatePost')
        }
      }
    }
  }, [searchParams, toast])

  // メディアアップロード処理
  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    setUploading(true)
    const uploadedMedia: MediaUpload[] = []
    
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mediaType', 'threads')
      
      try {
        const response = await authenticatedFetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'アップロードに失敗しました')
        }
        
        const data = await response.json()
        uploadedMedia.push({
          id: data.upload.id,
          public_url: data.publicUrl,
          file_name: data.upload.file_name,
          mime_type: data.upload.mime_type
        })
      } catch (error) {
        toast({
          title: 'エラー',
          description: `${file.name}のアップロードに失敗しました`,
          variant: 'destructive'
        })
      }
    }
    
    if (mediaType === 'CAROUSEL') {
      // カルーセルの場合は各アイテムとして追加
      uploadedMedia.forEach(media => {
        setCarouselItems(prev => [...prev, { media, caption: '' }])
      })
    } else if (isThreadPost) {
      // ツリー投稿の場合は現在の投稿に追加
      const newPosts = [...threadPosts]
      newPosts[currentThreadIndex].media = [...(newPosts[currentThreadIndex].media || []), ...uploadedMedia]
      setThreadPosts(newPosts)
    } else {
      // 通常投稿の場合
      setMediaUploads(prev => [...prev, ...uploadedMedia])
    }
    
    setUploading(false)
  }

  // メディア削除処理
  const handleMediaRemove = (index: number) => {
    if (mediaType === 'CAROUSEL') {
      setCarouselItems(prev => prev.filter((_, i) => i !== index))
    } else if (isThreadPost) {
      const newPosts = [...threadPosts]
      newPosts[currentThreadIndex].media = newPosts[currentThreadIndex].media?.filter((_, i) => i !== index)
      setThreadPosts(newPosts)
    } else {
      setMediaUploads(prev => prev.filter((_, i) => i !== index))
    }
  }

  // ツリー投稿ヘルパー関数
  const addThreadPost = () => {
    setThreadPosts([...threadPosts, { content: '', media: [] }])
    setCurrentThreadIndex(threadPosts.length)
  }

  const removeThreadPost = (index: number) => {
    if (threadPosts.length > 1) {
      const newPosts = threadPosts.filter((_, i) => i !== index)
      setThreadPosts(newPosts)
      if (currentThreadIndex >= newPosts.length) {
        setCurrentThreadIndex(newPosts.length - 1)
      }
    }
  }

  const updateThreadPost = (index: number, content: string) => {
    const newPosts = [...threadPosts]
    newPosts[index].content = content
    setThreadPosts(newPosts)
  }

  // カルーセルキャプション更新
  const updateCarouselCaption = (index: number, caption: string) => {
    const newItems = [...carouselItems]
    newItems[index].caption = caption
    setCarouselItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      if (!currentWorkspace) {
        throw new Error('ワークスペース情報を取得できませんでした')
      }
      if (!accountId) {
        throw new Error('Threadsアカウントを選択してください')
      }

      const scheduled_at = isScheduled && scheduledDate && scheduledTime
        ? `${scheduledDate}T${scheduledTime}`
        : null

      // ツリー投稿の場合
      if (isThreadPost && threadPosts.length > 0) {
        const resp = await authenticatedFetch('/api/posts/thread', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            threads_account_id: accountId,
            thread_posts: threadPosts.filter(post => post.content.trim().length > 0).map(post => ({
              content: post.content,
              media_urls: post.media?.map(m => m.public_url) || []
            })),
            scheduled_at,
          }),
        })

        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data?.error || 'ツリー投稿の作成に失敗しました')
        }

        setSuccessMessage(`${threadPosts.filter(p => p.content.trim()).length}つの投稿からなるツリー投稿を${isScheduled ? '予約しました' : '作成しました'}`)
      } 
      // カルーセル投稿の場合
      else if (mediaType === 'CAROUSEL' && carouselItems.length > 0) {
        const resp = await authenticatedFetch('/api/posts', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            threads_account_id: accountId,
            content,
            media_type: 'CAROUSEL',
            carousel_items: carouselItems.map(item => ({
              media_url: item.media?.public_url,
              caption: item.caption
            })),
            scheduled_at,
          }),
        })

        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data?.error || 'カルーセル投稿の作成に失敗しました')
        }

        setSuccessMessage(`カルーセル投稿を${isScheduled ? '予約しました' : '作成しました'}`)
      }
      // 通常投稿（テキスト、画像、動画）
      else {
        const resp = await authenticatedFetch('/api/posts', {
          method: 'POST',
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            threads_account_id: accountId,
            content,
            media_type: mediaType,
            media_urls: mediaUploads.map(m => m.public_url),
            scheduled_at,
          }),
        })

        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data?.error || '投稿の作成に失敗しました')
        }

        setSuccessMessage(
          isScheduled 
            ? `投稿を${scheduledDate} ${scheduledTime}に予約しました`
            : '投稿を作成しました'
        )
      }

      // フォームをリセット
      setContent('')
      setThreadPosts([{ content: '', media: [] }])
      setMediaUploads([])
      setCarouselItems([])
      setCurrentThreadIndex(0)
      setIsScheduled(false)
      setScheduledDate('')
      setScheduledTime('')
      
    } catch (error) {
      console.error('投稿エラー:', error)
      setError(error instanceof Error ? error.message : '投稿の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ローディング中の表示
  if (wsLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            読み込み中...
          </CardContent>
        </Card>
      </div>
    )
  }

  // Threads連携チェック
  const hasThreadsAccount = threadsAccounts && threadsAccounts.length > 0

  if (!hasThreadsAccount) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Threads連携が必要です</CardTitle>
            <CardDescription>
              投稿を作成するには、Threadsアカウントとの連携が必要です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/threads-setup">
              <Button>Threadsと連携する</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {isDuplicate ? '複製から新規投稿作成' : '新規投稿作成'}
          </CardTitle>
          <CardDescription>
            {isDuplicate 
              ? '複製した内容を編集してThreadsへ投稿できます' 
              : 'Threadsへの投稿を作成します'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* アカウント選択 */}
            <div className="space-y-2">
              <Label htmlFor="account">投稿アカウント</Label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">アカウントを選択</option>
                {threadsAccounts?.map(account => (
                  <option key={account.id} value={account.id}>
                    @{account.username}
                  </option>
                ))}
              </select>
            </div>

            {/* 投稿タイプ選択 */}
            <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="TEXT">テキスト</TabsTrigger>
                <TabsTrigger value="IMAGE">画像</TabsTrigger>
                <TabsTrigger value="VIDEO">動画</TabsTrigger>
                <TabsTrigger value="CAROUSEL">カルーセル</TabsTrigger>
              </TabsList>

              <TabsContent value="TEXT" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">投稿内容</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="投稿内容を入力..."
                    rows={6}
                    maxLength={500}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {content.length} / 500文字
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="IMAGE" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">投稿内容</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="投稿内容を入力..."
                    rows={4}
                    maxLength={500}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>画像をアップロード</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {mediaUploads.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {mediaUploads.map((media, index) => (
                          <div key={media.id} className="relative">
                            <img 
                              src={media.public_url} 
                              alt={media.file_name}
                              className="w-full h-32 object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={() => handleMediaRemove(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-sm text-gray-500 mb-2">
                          クリックまたはドラッグ＆ドロップで画像をアップロード
                        </p>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMediaUpload(e.target.files)}
                      className="hidden"
                      id="image-upload"
                      disabled={uploading}
                    />
                    <Label htmlFor="image-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" disabled={uploading} asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? 'アップロード中...' : '画像を選択'}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="VIDEO" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">投稿内容</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="投稿内容を入力..."
                    rows={4}
                    maxLength={500}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>動画をアップロード</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {mediaUploads.length > 0 ? (
                      <div className="space-y-2">
                        {mediaUploads.map((media, index) => (
                          <div key={media.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <VideoIcon className="w-5 h-5" />
                              <span className="text-sm">{media.file_name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleMediaRemove(index)}
                              className="text-red-500"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <VideoIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-sm text-gray-500 mb-2">
                          動画ファイルをアップロード（最大10MB）
                        </p>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleMediaUpload(e.target.files)}
                      className="hidden"
                      id="video-upload"
                      disabled={uploading}
                    />
                    <Label htmlFor="video-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" disabled={uploading} asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? 'アップロード中...' : '動画を選択'}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="CAROUSEL" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">メインキャプション</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="カルーセル全体のキャプション..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>カルーセルアイテム（最大10枚）</Label>
                  {carouselItems.map((item, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded">
                      {item.media ? (
                        <img 
                          src={item.media.public_url} 
                          alt={`Item ${index + 1}`}
                          className="w-24 h-24 object-cover rounded"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          placeholder={`アイテム${index + 1}のキャプション（オプション）`}
                          value={item.caption}
                          onChange={(e) => updateCarouselCaption(index, e.target.value)}
                          maxLength={200}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMediaRemove(index)}
                        className="text-red-500"
                      >
                        <XIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  
                  {carouselItems.length < 10 && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => handleMediaUpload(e.target.files)}
                        className="hidden"
                        id="carousel-upload"
                        disabled={uploading}
                      />
                      <Label htmlFor="carousel-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" disabled={uploading} asChild>
                          <span>
                            <PlusIcon className="w-4 h-4 mr-2" />
                            {uploading ? 'アップロード中...' : 'アイテムを追加'}
                          </span>
                        </Button>
                      </Label>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* ツリー投稿オプション */}
            <div className="flex items-center space-x-2">
              <Switch
                id="thread-mode"
                checked={isThreadPost}
                onCheckedChange={setIsThreadPost}
                disabled={mediaType === 'CAROUSEL'}
              />
              <Label htmlFor="thread-mode" className="flex items-center gap-2">
                <MessageSquareIcon className="w-4 h-4" />
                ツリー投稿として作成
              </Label>
            </div>

            {isThreadPost && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">ツリー投稿</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addThreadPost}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    投稿を追加
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {threadPosts.map((post, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <Textarea
                          value={post.content}
                          onChange={(e) => updateThreadPost(index, e.target.value)}
                          placeholder={`投稿 ${index + 1}`}
                          rows={3}
                          className="w-full"
                        />
                        {post.media && post.media.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {post.media.map((m, mIndex) => (
                              <div key={m.id} className="relative">
                                <img 
                                  src={m.public_url} 
                                  alt={m.file_name}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {threadPosts.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeThreadPost(index)}
                        >
                          <MinusIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 予約投稿設定 */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="scheduled"
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
                <Label htmlFor="scheduled" className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" />
                  予約投稿
                </Label>
              </div>

              {isScheduled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">投稿日</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required={isScheduled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">投稿時刻</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      required={isScheduled}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-md">
                {error}
              </div>
            )}

            {/* 成功メッセージ */}
            {successMessage && (
              <div className="p-4 bg-green-50 text-green-600 rounded-md">
                {successMessage}
              </div>
            )}

            {/* 送信ボタン */}
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || uploading}
            >
              {loading ? (
                '投稿中...'
              ) : (
                <>
                  {isScheduled ? (
                    <>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      予約投稿
                    </>
                  ) : (
                    <>
                      <SendIcon className="w-4 h-4 mr-2" />
                      今すぐ投稿
                    </>
                  )}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}