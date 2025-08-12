'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Activity,
  RefreshCw
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnalyticsData {
  totalComments: number;
  totalReplies: number;
  replyRate: number;
  avgResponseTime: number;
  successRate: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  hourlyActivity: Array<{
    hour: string;
    comments: number;
    replies: number;
  }>;
  topRules: Array<{
    name: string;
    replies: number;
    successRate: number;
  }>;
  accountPerformance: Array<{
    username: string;
    replies: number;
    avgTime: number;
  }>;
}

export default function AutoReplyAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // 時間範囲の計算
      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
      }

      // コメント総数と返信数を取得
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (commentsError) throw commentsError;

      const totalComments = comments?.length || 0;
      const repliedComments = comments?.filter(c => c.is_replied).length || 0;
      const replyRate = totalComments > 0 ? (repliedComments / totalComments) * 100 : 0;

      // 返信キューの統計を取得
      const { data: queueStats, error: queueError } = await supabase
        .from('reply_queue')
        .select('status, created_at, processed_at')
        .gte('created_at', startDate.toISOString());

      if (queueError) throw queueError;

      const successfulReplies = queueStats?.filter(q => q.status === 'completed').length || 0;
      const totalReplies = queueStats?.length || 0;
      const successRate = totalReplies > 0 ? (successfulReplies / totalReplies) * 100 : 0;

      // 平均応答時間の計算
      let totalResponseTime = 0;
      let responseCount = 0;
      
      queueStats?.forEach(item => {
        if (item.processed_at && item.status === 'completed') {
          const responseTime = new Date(item.processed_at).getTime() - new Date(item.created_at).getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      });
      
      const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000) : 0;

      // センチメント分析データ（モック）
      const sentimentBreakdown = {
        positive: Math.floor(Math.random() * 50) + 30,
        neutral: Math.floor(Math.random() * 30) + 20,
        negative: Math.floor(Math.random() * 20) + 10
      };

      // 時間別アクティビティ（24時間）
      const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
        const hour = i;
        const hourComments = comments?.filter(c => {
          const commentHour = new Date(c.created_at).getHours();
          return commentHour === hour;
        }).length || 0;
        
        const hourReplies = queueStats?.filter(q => {
          const replyHour = new Date(q.created_at).getHours();
          return replyHour === hour && q.status === 'completed';
        }).length || 0;

        return {
          hour: `${hour}:00`,
          comments: hourComments,
          replies: hourReplies
        };
      });

      // トップルールの取得
      const { data: rules, error: rulesError } = await supabase
        .from('auto_reply_rules')
        .select('id, name')
        .limit(5);

      if (rulesError) throw rulesError;

      const topRules = await Promise.all(
        (rules || []).map(async (rule) => {
          const { count } = await supabase
            .from('reply_queue')
            .select('*', { count: 'exact', head: true })
            .eq('rule_id', rule.id)
            .eq('status', 'completed')
            .gte('created_at', startDate.toISOString());

          const { count: totalCount } = await supabase
            .from('reply_queue')
            .select('*', { count: 'exact', head: true })
            .eq('rule_id', rule.id)
            .gte('created_at', startDate.toISOString());

          return {
            name: rule.name,
            replies: count || 0,
            successRate: totalCount && totalCount > 0 ? ((count || 0) / totalCount) * 100 : 0
          };
        })
      );

      // アカウントパフォーマンス
      const { data: accounts, error: accountsError } = await supabase
        .from('threads_accounts')
        .select('id, username');

      if (accountsError) throw accountsError;

      const accountPerformance = await Promise.all(
        (accounts || []).map(async (account) => {
          const { data: stats } = await supabase
            .from('account_usage_stats')
            .select('total_replies')
            .eq('account_id', account.id)
            .single();

          return {
            username: account.username,
            replies: stats?.total_replies || 0,
            avgTime: Math.floor(Math.random() * 60) + 30 // モックデータ
          };
        })
      );

      setAnalyticsData({
        totalComments,
        totalReplies: repliedComments,
        replyRate,
        avgResponseTime,
        successRate,
        sentimentBreakdown,
        hourlyActivity,
        topRules: topRules.sort((a, b) => b.replies - a.replies).slice(0, 5),
        accountPerformance: accountPerformance.sort((a, b) => b.replies - a.replies).slice(0, 5)
      });

    } catch (error) {
      console.error('分析データ取得エラー:', error);
      toast({
        title: 'エラー',
        description: '分析データの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAnalytics();
    setIsRefreshing(false);
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">自動返信分析</h1>
          <p className="text-muted-foreground">パフォーマンスと統計を確認</p>
        </div>
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">過去24時間</SelectItem>
              <SelectItem value="7d">過去7日間</SelectItem>
              <SelectItem value="30d">過去30日間</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総コメント数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalComments || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <MessageCircle className="w-3 h-3 mr-1" />
              受信したコメント
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">返信率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.replyRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {analyticsData?.replyRate > 80 ? (
                <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
              )}
              自動返信率
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">平均応答時間</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.avgResponseTime}秒
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Clock className="w-3 h-3 mr-1" />
              返信までの時間
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analyticsData?.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <CheckCircle className="w-3 h-3 mr-1" />
              正常完了
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総返信数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalReplies || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Activity className="w-3 h-3 mr-1" />
              送信済み返信
            </p>
          </CardContent>
        </Card>
      </div>

      {/* グラフセクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 時間別アクティビティ */}
        <Card>
          <CardHeader>
            <CardTitle>時間別アクティビティ</CardTitle>
            <CardDescription>コメントと返信の時間分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData?.hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="comments" 
                  stroke="#8884d8" 
                  name="コメント"
                />
                <Line 
                  type="monotone" 
                  dataKey="replies" 
                  stroke="#82ca9d" 
                  name="返信"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* センチメント分析 */}
        <Card>
          <CardHeader>
            <CardTitle>センチメント分析</CardTitle>
            <CardDescription>コメントの感情分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'ポジティブ', value: analyticsData?.sentimentBreakdown.positive },
                    { name: 'ニュートラル', value: analyticsData?.sentimentBreakdown.neutral },
                    { name: 'ネガティブ', value: analyticsData?.sentimentBreakdown.negative }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* パフォーマンステーブル */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* トップルール */}
        <Card>
          <CardHeader>
            <CardTitle>トップルール</CardTitle>
            <CardDescription>最も活用されている返信ルール</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData?.topRules.map((rule, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {rule.replies}回返信 • 成功率 {rule.successRate.toFixed(0)}%
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${rule.successRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* アカウントパフォーマンス */}
        <Card>
          <CardHeader>
            <CardTitle>アカウントパフォーマンス</CardTitle>
            <CardDescription>各アカウントの返信実績</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData?.accountPerformance.map((account, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">@{account.username}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.replies}回返信 • 平均{account.avgTime}秒
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}