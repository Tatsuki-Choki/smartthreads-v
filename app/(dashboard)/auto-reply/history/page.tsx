'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  MessageCircle, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReplyQueueItem {
  id: string;
  comment_id: string;
  rule_id: string | null;
  reply_content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'postponed';
  retry_count: number;
  scheduled_at: string;
  processed_at: string | null;
  error_message: string | null;
  threads_reply_id: string | null;
  created_at: string;
  comments: {
    threads_comment_id: string;
    content: string;
    author_username: string;
    post_id: string;
  };
  auto_reply_rules: {
    name: string;
    trigger_keywords: string[];
  } | null;
  threads_accounts: {
    username: string;
  };
}

export default function AutoReplyHistoryPage() {
  const [queueItems, setQueueItems] = useState<ReplyQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<ReplyQueueItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchQueueHistory();
    
    // リアルタイム更新の設定
    const channel = supabase
      .channel('reply_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reply_queue'
        },
        () => {
          fetchQueueHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchQueueHistory = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('reply_queue')
        .select(`
          *,
          comments (
            threads_comment_id,
            content,
            author_username,
            post_id
          ),
          auto_reply_rules (
            name,
            trigger_keywords
          ),
          threads_accounts (
            username
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setQueueItems(data || []);
    } catch (error) {
      console.error('履歴の取得に失敗:', error);
      toast({
        title: 'エラー',
        description: '履歴の取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchQueueHistory();
    setIsRefreshing(false);
  };

  const handleRetry = async (itemId: string) => {
    try {
      const response = await fetch(`/api/auto-reply/queue/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) throw new Error('リトライに失敗しました');

      toast({
        title: '成功',
        description: 'リトライをスケジュールしました',
      });

      fetchQueueHistory();
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'リトライに失敗しました',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { icon: Clock, label: '待機中', className: 'bg-yellow-100 text-yellow-800' },
      processing: { icon: RefreshCw, label: '処理中', className: 'bg-blue-100 text-blue-800' },
      completed: { icon: CheckCircle, label: '完了', className: 'bg-green-100 text-green-800' },
      failed: { icon: XCircle, label: '失敗', className: 'bg-red-100 text-red-800' },
      postponed: { icon: AlertCircle, label: '延期', className: 'bg-orange-100 text-orange-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config?.icon || Clock;

    return (
      <Badge className={config?.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config?.label || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const filteredItems = queueItems.filter(item => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      item.comments?.content?.toLowerCase().includes(searchLower) ||
      item.comments?.author_username?.toLowerCase().includes(searchLower) ||
      item.reply_content.toLowerCase().includes(searchLower) ||
      item.auto_reply_rules?.name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">
              <MessageCircle className="inline-block w-6 h-6 mr-2" />
              自動返信履歴
            </CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              更新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* フィルタとサーチ */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="コメント、ユーザー名、返信内容で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="ステータスで絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="pending">待機中</SelectItem>
                <SelectItem value="processing">処理中</SelectItem>
                <SelectItem value="completed">完了</SelectItem>
                <SelectItem value="failed">失敗</SelectItem>
                <SelectItem value="postponed">延期</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 統計情報 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {queueItems.filter(i => i.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-500">待機中</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {queueItems.filter(i => i.status === 'processing').length}
                </div>
                <div className="text-sm text-gray-500">処理中</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {queueItems.filter(i => i.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-500">完了</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {queueItems.filter(i => i.status === 'failed').length}
                </div>
                <div className="text-sm text-gray-500">失敗</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {queueItems.filter(i => i.status === 'postponed').length}
                </div>
                <div className="text-sm text-gray-500">延期</div>
              </CardContent>
            </Card>
          </div>

          {/* テーブル */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>読み込み中...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              履歴がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ステータス</TableHead>
                    <TableHead>作成日時</TableHead>
                    <TableHead>コメント投稿者</TableHead>
                    <TableHead>コメント内容</TableHead>
                    <TableHead>返信内容</TableHead>
                    <TableHead>ルール</TableHead>
                    <TableHead>アカウント</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        @{item.comments?.author_username}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {item.comments?.content}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {item.reply_content}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.auto_reply_rules?.name || '-'}
                      </TableCell>
                      <TableCell>
                        @{item.threads_accounts?.username}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedItem(item)}
                          >
                            詳細
                          </Button>
                          {item.status === 'failed' && item.retry_count < 3 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(item.id)}
                            >
                              リトライ
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 詳細ダイアログ */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>返信詳細</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-1">ステータス</div>
                {getStatusBadge(selectedItem.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold mb-1">作成日時</div>
                  <div className="text-sm">{formatDate(selectedItem.created_at)}</div>
                </div>
                <div>
                  <div className="font-semibold mb-1">予定日時</div>
                  <div className="text-sm">{formatDate(selectedItem.scheduled_at)}</div>
                </div>
                {selectedItem.processed_at && (
                  <div>
                    <div className="font-semibold mb-1">処理日時</div>
                    <div className="text-sm">{formatDate(selectedItem.processed_at)}</div>
                  </div>
                )}
                <div>
                  <div className="font-semibold mb-1">リトライ回数</div>
                  <div className="text-sm">{selectedItem.retry_count} / 3</div>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">元のコメント</div>
                <Card className="p-3">
                  <div className="text-sm text-gray-500 mb-1">
                    @{selectedItem.comments?.author_username}
                  </div>
                  <div>{selectedItem.comments?.content}</div>
                </Card>
              </div>

              <div>
                <div className="font-semibold mb-1">返信内容</div>
                <Card className="p-3">
                  <div>{selectedItem.reply_content}</div>
                </Card>
              </div>

              {selectedItem.auto_reply_rules && (
                <div>
                  <div className="font-semibold mb-1">適用ルール</div>
                  <Card className="p-3">
                    <div className="font-medium">{selectedItem.auto_reply_rules.name}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedItem.auto_reply_rules.trigger_keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {selectedItem.error_message && (
                <div>
                  <div className="font-semibold mb-1 text-red-600">エラーメッセージ</div>
                  <Card className="p-3 border-red-200 bg-red-50">
                    <div className="text-sm">{selectedItem.error_message}</div>
                  </Card>
                </div>
              )}

              {selectedItem.threads_reply_id && (
                <div>
                  <div className="font-semibold mb-1">Threads返信ID</div>
                  <div className="text-sm font-mono">{selectedItem.threads_reply_id}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}