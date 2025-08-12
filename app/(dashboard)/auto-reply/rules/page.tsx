'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusIcon, Bot, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'

export default function AutoReplyRulesPage() {
  const { currentWorkspace } = useWorkspace()
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentWorkspace) {
      fetchRules()
    }
  }, [currentWorkspace])

  const fetchRules = async () => {
    try {
      setLoading(true)
      // TODO: APIエンドポイントが実装されたら取得
      // const response = await fetch('/api/auto-reply/rules')
      // const data = await response.json()
      // setRules(data.rules || [])
      
      // ダミーデータ
      setRules([])
    } catch (error) {
      console.error('ルール取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">自動返信ルール</h1>
        <p className="text-gray-600">
          特定のキーワードやパターンに基づいて自動返信を設定できます
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              返信ルール一覧
            </CardTitle>
            <CardDescription>
              コメントに含まれるキーワードに応じて自動返信します
            </CardDescription>
          </div>
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            新規ルール作成
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              読み込み中...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-4">
                まだ自動返信ルールが設定されていません
              </p>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                最初のルールを作成
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        キーワード: {rule.keywords?.join(', ')}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        返信テンプレート: {rule.template_name}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {/* TODO: 切り替え処理 */}}
                      >
                        {rule.is_active ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使い方ガイド */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>自動返信ルールの使い方</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold mb-1">1. ルールを作成</h4>
            <p className="text-sm text-gray-600">
              キーワードと返信テンプレートを設定します
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">2. 優先順位を設定</h4>
            <p className="text-sm text-gray-600">
              複数のルールがマッチする場合、優先順位の高いものが適用されます
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">3. ルールを有効化</h4>
            <p className="text-sm text-gray-600">
              トグルボタンでルールの有効/無効を切り替えられます
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}