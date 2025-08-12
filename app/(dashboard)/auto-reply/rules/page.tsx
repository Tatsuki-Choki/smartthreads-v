'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useWorkspace } from '@/hooks/useWorkspace'
import { PlusIcon, TrashIcon, PencilIcon } from 'lucide-react'

interface AutoReplyRule {
  id: string
  keyword: string
  reply_message: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AutoReplyRulesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace()
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewRuleForm, setShowNewRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null)
  const [formData, setFormData] = useState({
    keyword: '',
    reply_message: ''
  })

  useEffect(() => {
    if (!workspaceLoading && currentWorkspace) {
      fetchRules()
    }
  }, [currentWorkspace, workspaceLoading])

  const fetchRules = async () => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/auto-reply/rules`)
      
      if (!response.ok) {
        throw new Error('自動返信ルールの取得に失敗しました')
      }

      const data = await response.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error('自動返信ルール取得エラー:', error)
      toast({
        title: 'エラー',
        description: '自動返信ルールの取得に失敗しました',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentWorkspace) {
      toast({
        title: 'エラー',
        description: 'ワークスペースが選択されていません',
        variant: 'destructive'
      })
      return
    }

    if (!formData.keyword || !formData.reply_message) {
      toast({
        title: 'エラー',
        description: 'キーワードと返信メッセージを入力してください',
        variant: 'destructive'
      })
      return
    }

    try {
      const url = editingRule 
        ? `/api/workspaces/${currentWorkspace.id}/auto-reply/rules/${editingRule.id}`
        : `/api/workspaces/${currentWorkspace.id}/auto-reply/rules`

      const response = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keyword: formData.keyword,
          reply_message: formData.reply_message,
          is_active: true
        })
      })

      if (!response.ok) {
        throw new Error('自動返信ルールの保存に失敗しました')
      }

      toast({
        title: '成功',
        description: editingRule ? 'ルールを更新しました' : '新しいルールを作成しました',
      })

      // フォームをリセット
      setFormData({ keyword: '', reply_message: '' })
      setShowNewRuleForm(false)
      setEditingRule(null)
      
      // ルールを再取得
      await fetchRules()
    } catch (error) {
      console.error('ルール保存エラー:', error)
      toast({
        title: 'エラー',
        description: '自動返信ルールの保存に失敗しました',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (rule: AutoReplyRule) => {
    setEditingRule(rule)
    setFormData({
      keyword: rule.keyword,
      reply_message: rule.reply_message
    })
    setShowNewRuleForm(true)
  }

  const handleDelete = async (ruleId: string) => {
    if (!currentWorkspace) return

    if (!confirm('このルールを削除してもよろしいですか？')) {
      return
    }

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/auto-reply/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('ルールの削除に失敗しました')
      }

      toast({
        title: '成功',
        description: 'ルールを削除しました',
      })

      await fetchRules()
    } catch (error) {
      console.error('ルール削除エラー:', error)
      toast({
        title: 'エラー',
        description: 'ルールの削除に失敗しました',
        variant: 'destructive'
      })
    }
  }

  const handleToggleActive = async (rule: AutoReplyRule) => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/auto-reply/rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keyword: rule.keyword,
          reply_message: rule.reply_message,
          is_active: !rule.is_active
        })
      })

      if (!response.ok) {
        throw new Error('ステータスの更新に失敗しました')
      }

      toast({
        title: '成功',
        description: `ルールを${!rule.is_active ? '有効化' : '無効化'}しました`,
      })

      await fetchRules()
    } catch (error) {
      console.error('ステータス更新エラー:', error)
      toast({
        title: 'エラー',
        description: 'ステータスの更新に失敗しました',
        variant: 'destructive'
      })
    }
  }

  if (workspaceLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">ワークスペースが選択されていません</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">自動返信ルール</h1>
          {!showNewRuleForm && (
            <Button
              onClick={() => {
                setShowNewRuleForm(true)
                setEditingRule(null)
                setFormData({ keyword: '', reply_message: '' })
              }}
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              新規ルール作成
            </Button>
          )}
        </div>

        {showNewRuleForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingRule ? 'ルールを編集' : '新規ルール作成'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="keyword">キーワード</Label>
                <Input
                  id="keyword"
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="例: 問い合わせ, 質問"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  このキーワードが含まれるコメントに自動返信します
                </p>
              </div>

              <div>
                <Label htmlFor="reply_message">返信メッセージ</Label>
                <textarea
                  id="reply_message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                  value={formData.reply_message}
                  onChange={(e) => setFormData({ ...formData, reply_message: e.target.value })}
                  placeholder="自動返信のメッセージを入力してください"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingRule ? '更新' : '作成'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewRuleForm(false)
                    setEditingRule(null)
                    setFormData({ keyword: '', reply_message: '' })
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">まだ自動返信ルールがありません</p>
              <p className="text-sm text-gray-400 mt-2">
                新規ルールを作成して、コメントへの自動返信を設定しましょう
              </p>
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-lg shadow-md p-6 ${
                  !rule.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{rule.keyword}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          rule.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {rule.is_active ? '有効' : '無効'}
                      </span>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap">{rule.reply_message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      作成日: {new Date(rule.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(rule)}
                    >
                      {rule.is_active ? '無効化' : '有効化'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(rule)}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}