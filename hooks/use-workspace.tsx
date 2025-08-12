'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/client';
import { useToast } from './use-toast';

interface Workspace {
  id: string;
  name: string;
  slug?: string;
  owner_id?: string;
  plan_type?: 'standard' | 'vip' | 'ultra_vip';
  max_threads_accounts?: number;
  plan_expires_at?: string | null;
  plan_notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspacePlanStatus {
  id: string;
  name: string;
  plan_type: 'standard' | 'vip' | 'ultra_vip';
  max_threads_accounts: number;
  active_accounts_count: number;
  remaining_slots: number;
  plan_status: 'active' | 'expired';
  plan_expires_at?: string | null;
}

// ワークスペース一覧取得
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: async (): Promise<Workspace[]> => {
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('ワークスペースの取得に失敗しました');
      }
      const data = await response.json();
      return data.data || [];
    },
  });
}

// 単一ワークスペース取得
export function useWorkspace(id: string) {
  return useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: async (): Promise<Workspace> => {
      const response = await fetch(`/api/workspaces/${id}`);
      if (!response.ok) {
        throw new Error('ワークスペースの取得に失敗しました');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!id,
  });
}

// ワークスペースプラン情報取得
export function useWorkspacePlan(id: string) {
  return useQuery({
    queryKey: queryKeys.workspacePlan(id),
    queryFn: async (): Promise<WorkspacePlanStatus> => {
      const response = await fetch(`/api/workspaces/${id}/plan`);
      if (!response.ok) {
        throw new Error('プラン情報の取得に失敗しました');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // プラン情報は2分でstaleにする
  });
}

// ワークスペース作成
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newWorkspace: { name: string; slug?: string }) => {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkspace),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ワークスペースの作成に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // ワークスペース一覧のキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      
      toast({
        title: '成功',
        description: 'ワークスペースを作成しました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ワークスペース更新
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Workspace> }) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ワークスペースの更新に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 関連するキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.id) });
      
      toast({
        title: '成功',
        description: 'ワークスペースを更新しました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// アカウント上限チェック
export function useCheckAccountLimit(workspaceId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_account_limit' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'アカウント上限の確認に失敗しました');
      }
      
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: 'アカウント上限エラー',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}