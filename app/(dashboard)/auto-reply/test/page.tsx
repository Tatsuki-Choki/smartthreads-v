'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { List, Send } from 'lucide-react'

export default function AutoReplyTestPage() {
  const [testComment, setTestComment] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (!testComment.trim()) return
    
    setTesting(true)
    try {
      // TODO: テストAPIの実装
      // const response = await fetch('/api/auto-reply/test', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ comment: testComment })
      // })
      // const data = await response.json()
      // setTestResult(data)
      
      // ダミー結果
      setTestResult({
        matchedRule: null,
        message: 'マッチするルールがありませんでした'
      })
    } catch (error) {
      console.error('テストエラー:', error)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Webhookテスト</h1>
        <p className="text-gray-600">
          自動返信ルールをテストできます
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>テストコメント入力</CardTitle>
            <CardDescription>
              コメントを入力して、どのルールがマッチするか確認します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="テストしたいコメントを入力..."
              value={testComment}
              onChange={(e) => setTestComment(e.target.value)}
              rows={5}
            />
            <Button 
              onClick={handleTest}
              disabled={testing || !testComment.trim()}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {testing ? 'テスト中...' : 'テスト実行'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テスト結果</CardTitle>
            <CardDescription>
              マッチしたルールと返信内容
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResult ? (
              <div className="space-y-3">
                {testResult.matchedRule ? (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">
                        マッチしたルール:
                      </p>
                      <p className="text-sm">{testResult.matchedRule.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">
                        返信内容:
                      </p>
                      <div className="bg-gray-50 rounded p-3 mt-1">
                        <p className="text-sm whitespace-pre-wrap">
                          {testResult.reply}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <List className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      {testResult.message}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  テストを実行すると結果が表示されます
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}