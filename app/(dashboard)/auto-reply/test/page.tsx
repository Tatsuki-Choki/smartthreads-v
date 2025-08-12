'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Send, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function WebhookTestPage() {
  const [testData, setTestData] = useState({
    postId: '',
    commentText: '',
    username: 'test_user',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTestResult(null)

    try {
      // Webhookエンドポイントにテストデータを送信
      const response = await fetch('/api/auto-reply/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Mode': 'true', // テストモードフラグ
        },
        body: JSON.stringify({
          event: 'comment_created',
          data: {
            post_id: testData.postId,
            comment_id: `test_${Date.now()}`,
            user_id: 'test_user_id',
            username: testData.username,
            content: testData.commentText,
            created_at: new Date().toISOString(),
          },
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: '✅ Webhookテストが成功しました',
          details: result,
        })
        toast({
          title: 'テスト成功',
          description: 'Webhookの処理が正常に完了しました',
        })
      } else {
        throw new Error(result.error || 'Webhookテストに失敗しました')
      }
    } catch (error) {
      console.error('Webhook test error:', error)
      setTestResult({
        success: false,
        message: '❌ Webhookテストに失敗しました',
        details: error instanceof Error ? error.message : String(error),
      })
      toast({
        title: 'テスト失敗',
        description: error instanceof Error ? error.message : 'エラーが発生しました',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runConnectionTest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auto-reply/webhook/test')
      const result = await response.json()
      
      if (response.ok) {
        toast({
          title: '接続テスト成功',
          description: 'Webhookエンドポイントは正常に動作しています',
        })
        setTestResult({
          success: true,
          message: '✅ 接続テストが成功しました',
          details: result,
        })
      } else {
        throw new Error('接続テストに失敗しました')
      }
    } catch (error) {
      toast({
        title: '接続テスト失敗',
        description: 'エンドポイントへの接続に失敗しました',
        variant: 'destructive',
      })
      setTestResult({
        success: false,
        message: '❌ 接続テストに失敗しました',
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Webhookテスト</h2>
        <p className="text-muted-foreground">
          Webhook機能の動作をテストします
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 接続テスト */}
        <Card>
          <CardHeader>
            <CardTitle>接続テスト</CardTitle>
            <CardDescription>
              Webhookエンドポイントの接続状態を確認します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runConnectionTest}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  テスト中...
                </>
              ) : (
                '接続テストを実行'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* コメント受信テスト */}
        <Card>
          <CardHeader>
            <CardTitle>コメント受信テスト</CardTitle>
            <CardDescription>
              実際のコメント受信をシミュレートします
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="postId">投稿ID</Label>
                <Input
                  id="postId"
                  value={testData.postId}
                  onChange={(e) => setTestData({ ...testData, postId: e.target.value })}
                  placeholder="threads_post_123456"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  value={testData.username}
                  onChange={(e) => setTestData({ ...testData, username: e.target.value })}
                  placeholder="test_user"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commentText">コメント内容</Label>
                <Textarea
                  id="commentText"
                  value={testData.commentText}
                  onChange={(e) => setTestData({ ...testData, commentText: e.target.value })}
                  placeholder="テストコメントの内容を入力してください"
                  rows={3}
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    テスト送信
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* テスト結果 */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>テスト結果</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className={testResult.success ? 'border-green-500' : 'border-red-500'}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription className="space-y-2">
                <p className="font-medium">{testResult.message}</p>
                {testResult.details && (
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {typeof testResult.details === 'string'
                      ? testResult.details
                      : JSON.stringify(testResult.details, null, 2)}
                  </pre>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* 使用方法 */}
      <Card>
        <CardHeader>
          <CardTitle>使用方法</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">1. 接続テスト</h4>
            <p className="text-sm text-muted-foreground">
              まず「接続テスト」を実行して、Webhookエンドポイントが正常に動作していることを確認してください。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">2. コメント受信テスト</h4>
            <p className="text-sm text-muted-foreground">
              実際のコメント受信をシミュレートします。投稿IDとコメント内容を入力して、自動返信ルールがマッチするかテストできます。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">3. 本番環境での設定</h4>
            <p className="text-sm text-muted-foreground">
              本番環境では、Threads APIのWebhook設定画面で以下のURLを登録してください：
            </p>
            <code className="block mt-1 p-2 bg-muted rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/auto-reply/webhook
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}