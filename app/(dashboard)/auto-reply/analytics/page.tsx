'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function AutoReplyAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">分析</h1>
        <p className="text-gray-600">
          自動返信のパフォーマンスを分析します
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            自動返信分析
          </CardTitle>
          <CardDescription>
            返信率、エンゲージメント率などの統計情報
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">
              分析データがまだありません
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}