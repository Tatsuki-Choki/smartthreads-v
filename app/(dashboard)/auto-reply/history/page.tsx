'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageCircle } from 'lucide-react'

export default function AutoReplyHistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">返信履歴</h1>
        <p className="text-gray-600">
          自動返信の履歴を確認できます
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageCircle className="w-5 h-5 mr-2" />
            自動返信履歴
          </CardTitle>
          <CardDescription>
            送信された自動返信の記録
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">
              まだ自動返信の履歴はありません
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}