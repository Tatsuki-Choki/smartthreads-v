'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CalendarIcon, ClockIcon, SendIcon } from 'lucide-react'

export default function NewPostPage() {
  const [content, setContent] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const postData = {
      content,
      isScheduled,
      scheduledAt: isScheduled ? `${scheduledDate}T${scheduledTime}` : null,
    }

    // TODO: API呼び出し実装
    console.log('投稿データ:', postData)
    
    setTimeout(() => {
      setLoading(false)
      alert(isScheduled ? '予約投稿を作成しました' : '投稿を送信しました')
      // リセット
      setContent('')
      setIsScheduled(false)
      setScheduledDate('')
      setScheduledTime('')
    }, 1000)
  }

  const getCurrentDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    }
  }

  const { date: currentDate, time: currentTime } = getCurrentDateTime()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">新規投稿</h1>
        <p className="text-muted-foreground">
          Threadsへの投稿を作成または予約できます
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>投稿内容</CardTitle>
          <CardDescription>
            投稿する内容と配信方法を設定してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium">
                投稿テキスト
              </label>
              <Textarea
                id="content"
                placeholder="投稿内容を入力してください..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={500}
                required
              />
              <div className="text-xs text-muted-foreground text-right">
                {content.length}/500 文字
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="immediate"
                  name="postType"
                  checked={!isScheduled}
                  onChange={() => setIsScheduled(false)}
                  className="w-4 h-4"
                />
                <label htmlFor="immediate" className="text-sm font-medium flex items-center">
                  <SendIcon className="mr-2 h-4 w-4" />
                  すぐに投稿
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scheduled"
                  name="postType"
                  checked={isScheduled}
                  onChange={() => setIsScheduled(true)}
                  className="w-4 h-4"
                />
                <label htmlFor="scheduled" className="text-sm font-medium flex items-center">
                  <ClockIcon className="mr-2 h-4 w-4" />
                  予約投稿
                </label>
              </div>

              {isScheduled && (
                <div className="ml-6 space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="scheduledDate" className="text-sm font-medium flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        投稿日
                      </label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={currentDate}
                        required={isScheduled}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="scheduledTime" className="text-sm font-medium flex items-center">
                        <ClockIcon className="mr-2 h-4 w-4" />
                        投稿時刻
                      </label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required={isScheduled}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading || !content.trim()}>
              {loading ? (
                isScheduled ? '予約中...' : '投稿中...'
              ) : (
                isScheduled ? '予約投稿を作成' : '今すぐ投稿'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}