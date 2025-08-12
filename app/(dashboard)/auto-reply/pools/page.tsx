'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shuffle,
  BarChart,
  Save,
  RefreshCw,
  Copy,
  Percent
} from 'lucide-react';

interface ReplyPool {
  id: string;
  rule_id: string;
  content: string;
  weight: number;
  weightPercentage?: number;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  auto_reply_rules?: {
    id: string;
    name: string;
  };
}

interface AutoReplyRule {
  id: string;
  name: string;
  use_random_reply: boolean;
  random_selection_mode: 'weighted' | 'equal' | 'least_used';
}

export default function ReplyPoolsPage() {
  const [pools, setPools] = useState<ReplyPool[]>([]);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPool, setEditingPool] = useState<ReplyPool | null>(null);
  const [isWeightEditMode, setIsWeightEditMode] = useState(false);
  const [tempWeights, setTempWeights] = useState<Record<string, number>>({});
  
  // フォーム状態
  const [formData, setFormData] = useState({
    content: '',
    weight: 10,
    rule_id: ''
  });
  
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchRules();
    fetchPools();
  }, []);

  useEffect(() => {
    if (selectedRuleId) {
      fetchPools();
    }
  }, [selectedRuleId]);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('auto_reply_rules')
        .select('id, name, use_random_reply, random_selection_mode')
        .order('name');

      if (error) throw error;
      setRules(data || []);
      
      // 最初のルールを選択
      if (data && data.length > 0 && !selectedRuleId) {
        setSelectedRuleId(data[0].id);
      }
    } catch (error) {
      console.error('ルール取得エラー:', error);
      toast({
        title: 'エラー',
        description: 'ルールの取得に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const fetchPools = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('reply_pools')
        .select(`
          *,
          auto_reply_rules (
            id,
            name
          )
        `)
        .order('weight', { ascending: false });

      if (selectedRuleId) {
        query = query.eq('rule_id', selectedRuleId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 重みのパーセンテージを計算
      const totalWeight = data?.reduce((sum, pool) => sum + pool.weight, 0) || 0;
      const poolsWithPercentage = data?.map(pool => ({
        ...pool,
        weightPercentage: totalWeight > 0 ? (pool.weight / totalWeight) * 100 : 0
      })) || [];

      setPools(poolsWithPercentage);
      
      // 重み編集用の一時データを初期化
      const weights: Record<string, number> = {};
      poolsWithPercentage.forEach(pool => {
        weights[pool.id] = pool.weight;
      });
      setTempWeights(weights);
      
    } catch (error) {
      console.error('プール取得エラー:', error);
      toast({
        title: 'エラー',
        description: 'プールの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/auto-reply/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': localStorage.getItem('current_workspace_id') || '',
        },
        body: JSON.stringify({
          ruleId: formData.rule_id || selectedRuleId,
          content: formData.content,
          weight: formData.weight
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'プールの作成に失敗しました');
      }

      toast({
        title: '成功',
        description: '返信プールを作成しました',
      });

      setIsDialogOpen(false);
      setFormData({ content: '', weight: 10, rule_id: '' });
      fetchPools();
      
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プールの作成に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingPool) return;

    try {
      const response = await fetch('/api/auto-reply/pools', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': localStorage.getItem('current_workspace_id') || '',
        },
        body: JSON.stringify({
          id: editingPool.id,
          content: formData.content,
          weight: formData.weight
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'プールの更新に失敗しました');
      }

      toast({
        title: '成功',
        description: '返信プールを更新しました',
      });

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingPool(null);
      setFormData({ content: '', weight: 10, rule_id: '' });
      fetchPools();
      
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プールの更新に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (poolId: string) => {
    if (!confirm('この返信プールを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/auto-reply/pools?id=${poolId}`, {
        method: 'DELETE',
        headers: {
          'x-workspace-id': localStorage.getItem('current_workspace_id') || '',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'プールの削除に失敗しました');
      }

      toast({
        title: '成功',
        description: '返信プールを削除しました',
      });

      fetchPools();
      
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'プールの削除に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleSaveWeights = async () => {
    try {
      const weights: Record<string, number> = {};
      pools.forEach(pool => {
        weights[pool.id] = tempWeights[pool.id] || pool.weight;
      });

      const response = await fetch('/api/auto-reply/pools', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': localStorage.getItem('current_workspace_id') || '',
        },
        body: JSON.stringify({
          ruleId: selectedRuleId,
          weights
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '重みの更新に失敗しました');
      }

      toast({
        title: '成功',
        description: '重みを更新しました',
      });

      setIsWeightEditMode(false);
      fetchPools();
      
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '重みの更新に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (pool: ReplyPool) => {
    setEditingPool(pool);
    setFormData({
      content: pool.content,
      weight: pool.weight,
      rule_id: pool.rule_id
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const currentRule = rules.find(r => r.id === selectedRuleId);
  const filteredPools = selectedRuleId ? pools.filter(p => p.rule_id === selectedRuleId) : pools;

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold">
                <Shuffle className="inline-block w-6 h-6 mr-2" />
                返信プール管理
              </CardTitle>
              <CardDescription>
                ランダム返信用のコンテンツプールを管理します
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setIsEditMode(false);
                setEditingPool(null);
                setFormData({ content: '', weight: 10, rule_id: selectedRuleId });
                setIsDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              新規プール
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* ルール選択 */}
          <div className="mb-6">
            <Label>対象ルール</Label>
            <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
              <SelectTrigger>
                <SelectValue placeholder="ルールを選択" />
              </SelectTrigger>
              <SelectContent>
                {rules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.name}
                    {rule.use_random_reply && (
                      <Badge className="ml-2" variant="secondary">
                        ランダム返信有効
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 選択モード表示 */}
          {currentRule && currentRule.use_random_reply && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">選択モード: {
                    currentRule.random_selection_mode === 'weighted' ? '重み付きランダム' :
                    currentRule.random_selection_mode === 'equal' ? '均等ランダム' :
                    '最少使用優先'
                  }</p>
                  <p className="text-sm text-gray-600 mt-1">
                    プール数: {filteredPools.length} / 総使用回数: {filteredPools.reduce((sum, p) => sum + p.usage_count, 0)}
                  </p>
                </div>
                {currentRule.random_selection_mode === 'weighted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsWeightEditMode(!isWeightEditMode)}
                  >
                    <Percent className="w-4 h-4 mr-2" />
                    {isWeightEditMode ? 'キャンセル' : '重み調整'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 重み編集モード */}
          {isWeightEditMode && (
            <Card className="mb-6 p-4 border-blue-200 bg-blue-50">
              <div className="space-y-4">
                <h3 className="font-medium">重み調整モード</h3>
                {filteredPools.map((pool) => (
                  <div key={pool.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {pool.content.substring(0, 50)}...
                      </span>
                      <span className="text-sm font-bold">
                        {tempWeights[pool.id] || pool.weight}%
                      </span>
                    </div>
                    <Slider
                      value={[tempWeights[pool.id] || pool.weight]}
                      onValueChange={(value) => {
                        setTempWeights({
                          ...tempWeights,
                          [pool.id]: value[0]
                        });
                      }}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsWeightEditMode(false);
                      const weights: Record<string, number> = {};
                      filteredPools.forEach(pool => {
                        weights[pool.id] = pool.weight;
                      });
                      setTempWeights(weights);
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleSaveWeights}>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* プールテーブル */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>読み込み中...</p>
            </div>
          ) : filteredPools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              返信プールがありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>返信内容</TableHead>
                  <TableHead className="w-32">重み</TableHead>
                  <TableHead className="w-32">選択確率</TableHead>
                  <TableHead className="w-32">使用回数</TableHead>
                  <TableHead className="w-32">最終使用</TableHead>
                  <TableHead className="w-32">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPools.map((pool) => (
                  <TableRow key={pool.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="line-clamp-2">{pool.content}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {pool.weight}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${pool.weightPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm">
                          {pool.weightPercentage?.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pool.usage_count}
                    </TableCell>
                    <TableCell>
                      {pool.last_used_at ? 
                        new Date(pool.last_used_at).toLocaleDateString('ja-JP') : 
                        '未使用'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(pool.content);
                            toast({
                              title: 'コピーしました',
                              description: '返信内容をクリップボードにコピーしました',
                            });
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(pool)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(pool.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 作成/編集ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? '返信プールを編集' : '新規返信プール'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!isEditMode && (
              <div className="space-y-2">
                <Label>対象ルール</Label>
                <Select 
                  value={formData.rule_id || selectedRuleId} 
                  onValueChange={(value) => setFormData({ ...formData, rule_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ルールを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>返信内容</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="返信内容を入力..."
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-gray-500">
                {formData.content.length} / 500文字
              </p>
            </div>

            <div className="space-y-2">
              <Label>重み（0-100）</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[formData.weight]}
                  onValueChange={(value) => setFormData({ ...formData, weight: value[0] })}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  className="w-20"
                  min={0}
                  max={100}
                />
              </div>
              <p className="text-sm text-gray-500">
                他のプールとの相対的な選択確率を決定します
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={isEditMode ? handleUpdate : handleCreate}>
              {isEditMode ? '更新' : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}