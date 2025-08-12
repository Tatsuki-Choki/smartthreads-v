'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Filter, 
  Crown, 
  Users, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Workspace {
  id: string;
  name: string;
  plan_type: 'standard' | 'vip' | 'ultra_vip';
  max_threads_accounts: number;
  active_accounts_count: number;
  remaining_slots: number;
  plan_status: 'active' | 'expired';
  plan_expires_at?: string | null;
  created_at: string;
}

interface PlanHistory {
  id: string;
  previous_plan: string;
  new_plan: string;
  previous_max_accounts: number;
  new_max_accounts: number;
  change_reason: string;
  created_at: string;
  changed_by_user?: {
    email: string;
  };
}

export default function AdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'standard' | 'vip' | 'ultra_vip'>('all');
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanHistory[]>([]);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [downgradeReason, setDowngradeReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, standard: 0, vip: 0, ultra_vip: 0 });
  const { toast } = useToast();

  const itemsPerPage = 10;

  useEffect(() => {
    fetchWorkspaces();
  }, [currentPage, searchTerm, planFilter]);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (planFilter !== 'all') params.append('plan_type', planFilter);

      const response = await fetch(`/api/admin/workspace-plans?${params}`);
      const data = await response.json();

      if (data.success) {
        setWorkspaces(data.data.workspaces);
        setStats(data.data.stats);
      } else {
        toast({
          title: 'エラー',
          description: 'ワークスペース情報の取得に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: 'エラー',
        description: 'データの取得中にエラーが発生しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanHistory = async (workspaceId: string) => {
    try {
      const response = await fetch('/api/admin/workspace-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      const data = await response.json();
      if (data.success) {
        setPlanHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching plan history:', error);
      toast({
        title: 'エラー',
        description: '履歴の取得に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handlePlanChange = async (action: 'upgrade_to_vip' | 'upgrade_to_ultra_vip' | 'downgrade_to_standard') => {
    if (!selectedWorkspace) return;

    const reason = (action === 'upgrade_to_vip' || action === 'upgrade_to_ultra_vip') ? upgradeReason : downgradeReason;
    if (!reason.trim()) {
      toast({
        title: 'エラー',
        description: '変更理由を入力してください',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/workspace-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: selectedWorkspace.id,
          action,
          reason,
          expires_at: (action === 'upgrade_to_vip' || action === 'upgrade_to_ultra_vip') && expiresAt ? expiresAt : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: '成功',
          description: data.message,
        });
        setShowUpgradeDialog(false);
        setShowDowngradeDialog(false);
        setUpgradeReason('');
        setDowngradeReason('');
        setExpiresAt('');
        setSelectedWorkspace(null);
        fetchWorkspaces();
      } else {
        toast({
          title: 'エラー',
          description: data.error || 'プランの変更に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      toast({
        title: 'エラー',
        description: 'プランの変更中にエラーが発生しました',
        variant: 'destructive',
      });
    }
  };

  const filteredWorkspaces = workspaces.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = planFilter === 'all' || workspace.plan_type === planFilter;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(stats.total / itemsPerPage);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ワークスペース管理</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">{stats.total}件</Badge>
          <Badge variant="outline">スタンダード: {stats.standard}件</Badge>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Crown className="w-3 h-3 mr-1" />
            VIP: {stats.vip}件
          </Badge>
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            <Crown className="w-3 h-3 mr-1" />
            UltraVIP: {stats.ultra_vip}件
          </Badge>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="ワークスペース名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={planFilter} onValueChange={(value: 'all' | 'standard' | 'vip' | 'ultra_vip') => setPlanFilter(value)}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="standard">スタンダード</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="ultra_vip">UltraVIP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ワークスペース一覧 */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : filteredWorkspaces.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                条件に一致するワークスペースが見つかりませんでした
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredWorkspaces.map((workspace) => (
            <Card key={workspace.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{workspace.name}</h3>
                      <Badge 
                        variant={workspace.plan_type !== 'standard' ? 'default' : 'secondary'}
                        className={
                          workspace.plan_type === 'vip' ? 'bg-yellow-100 text-yellow-700' : 
                          workspace.plan_type === 'ultra_vip' ? 'bg-purple-100 text-purple-700' : ''
                        }
                      >
                        {workspace.plan_type !== 'standard' && <Crown className="w-3 h-3 mr-1" />}
                        {workspace.plan_type === 'standard' ? 'スタンダード' : 
                         workspace.plan_type === 'vip' ? 'VIP' : 
                         'UltraVIP'}プラン
                      </Badge>
                      {workspace.plan_status === 'expired' && (
                        <Badge variant="destructive">期限切れ</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {workspace.active_accounts_count}/{workspace.max_threads_accounts} アカウント
                      </div>
                      {workspace.plan_expires_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          期限: {new Date(workspace.plan_expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkspace(workspace);
                        fetchPlanHistory(workspace.id);
                        setShowHistoryDialog(true);
                      }}
                    >
                      <History className="w-4 h-4 mr-1" />
                      履歴
                    </Button>
                    
                    {workspace.plan_type === 'standard' ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedWorkspace(workspace);
                            setShowUpgradeDialog(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          VIPへ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedWorkspace(workspace);
                            // UltraVIPアップグレードのダイアログを表示（実装省略）
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          UltraVIPへ
                        </Button>
                      </div>
                    ) : workspace.plan_type === 'vip' ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedWorkspace(workspace);
                            // UltraVIPアップグレードのダイアログを表示（実装省略）
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          UltraVIPへ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedWorkspace(workspace);
                            setShowDowngradeDialog(true);
                          }}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          スタンダードへ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWorkspace(workspace);
                          setShowDowngradeDialog(true);
                        }}
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        スタンダードへ
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* VIPアップグレードダイアログ */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>VIPプランにアップグレード</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">
                ワークスペース: <strong>{selectedWorkspace?.name}</strong>
              </p>
              <p className="text-sm text-gray-600">
                アカウント上限: {selectedWorkspace?.max_threads_accounts}個 → 10個
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">アップグレード理由</label>
              <Textarea
                value={upgradeReason}
                onChange={(e) => setUpgradeReason(e.target.value)}
                placeholder="VIPプランにアップグレードする理由を入力してください..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">期限（オプション）</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={() => handlePlanChange('upgrade_to_vip')}>
                アップグレード
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* スタンダードダウングレードダイアログ */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スタンダードプランにダウングレード</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">
                ワークスペース: <strong>{selectedWorkspace?.name}</strong>
              </p>
              <p className="text-sm text-gray-600">
                アカウント上限: {selectedWorkspace?.max_threads_accounts}個 → 3個
              </p>
              {selectedWorkspace && selectedWorkspace.active_accounts_count > 3 && (
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ {selectedWorkspace.active_accounts_count - 3}個のアカウントが無効化されます
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ダウングレード理由</label>
              <Textarea
                value={downgradeReason}
                onChange={(e) => setDowngradeReason(e.target.value)}
                placeholder="スタンダードプランにダウングレードする理由を入力してください..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDowngradeDialog(false)}>
                キャンセル
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handlePlanChange('downgrade_to_standard')}
              >
                ダウングレード
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 履歴ダイアログ */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>プラン変更履歴</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {planHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                プラン変更履歴がありません
              </p>
            ) : (
              planHistory.map((history) => (
                <Card key={history.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {history.previous_plan} → {history.new_plan}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(history.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">
                          アカウント上限: {history.previous_max_accounts}個 → {history.new_max_accounts}個
                        </p>
                        <p className="text-sm text-gray-600">
                          理由: {history.change_reason}
                        </p>
                        {history.changed_by_user && (
                          <p className="text-xs text-gray-500">
                            変更者: {history.changed_by_user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}