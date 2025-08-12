'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusIcon, FileText, Edit, Trash2, Copy } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'

export default function AutoReplyTemplatesPage() {
  const { currentWorkspace } = useWorkspace()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentWorkspace) {
      fetchTemplates()
    }
  }, [currentWorkspace])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      // TODO: APIエンドポイントが実装されたら取得
      // const response = await fetch('/api/auto-reply/templates')
      // const data = await response.json()
      // setTemplates(data.templates || [])
      
      // ダミーデータ
      setTemplates([])
    } catch (error) {
      console.error('テンプレート取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">返信テンプレート</h1>
        <p className="text-gray-600">
          自動返信で使用するメッセージテンプレートを管理します
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              テンプレート一覧
            </CardTitle>
            <CardDescription>
              変数を使って動的な返信メッセージを作成できます
            </CardDescription>
          </div>
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            新規テンプレート作成
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              読み込み中...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-4">
                まだテンプレートが作成されていません
              </p>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                最初のテンプレートを作成
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{template.name}</h3>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">
                      {template.description}
                    </p>
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm whitespace-pre-wrap">
                        {template.content}
                      </p>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">
                        使用回数: {template.usage_count || 0}回
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 変数の説明 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>使用可能な変数</CardTitle>
          <CardDescription>
            テンプレート内で以下の変数を使用できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm mr-3">
                {'{username}'}
              </code>
              <span className="text-sm text-gray-600">
                コメントした人のユーザー名
              </span>
            </div>
            <div className="flex items-start">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm mr-3">
                {'{comment}'}
              </code>
              <span className="text-sm text-gray-600">
                受け取ったコメントの内容
              </span>
            </div>
            <div className="flex items-start">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm mr-3">
                {'{date}'}
              </code>
              <span className="text-sm text-gray-600">
                現在の日付
              </span>
            </div>
            <div className="flex items-start">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm mr-3">
                {'{time}'}
              </code>
              <span className="text-sm text-gray-600">
                現在の時刻
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}