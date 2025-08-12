'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { List, PlusIcon } from 'lucide-react'

export default function AutoReplyPoolsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">返信プール</h1>
        <p className="text-gray-600">
          ランダムに選ばれる返信メッセージのプールを管理します
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <List className="w-5 h-5 mr-2" />
            返信プール管理
          </CardTitle>
          <CardDescription>
            複数の返信パターンをプールに登録し、ランダムに選択できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <List className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">
              この機能は現在開発中です
            </p>
            <Button disabled>
              <PlusIcon className="w-4 h-4 mr-2" />
              プールを作成
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}