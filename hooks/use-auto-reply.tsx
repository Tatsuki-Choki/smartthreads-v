'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/client';
import { useToast } from './use-toast';

interface AutoReplyRule {
  id: string;
  workspace_id: string;
  threads_account_id: string;
  name: string;
  description: string | null;
  trigger_keywords: string[];
  exclude_keywords: string[];
  match_mode: 'any' | 'all' | 'exact';
  reply_content: string;
  reply_delay_seconds: number;
  max_replies_per_hour: number;
  max_replies_per_user: number;
  is_active: boolean;
  priority: number;
  use_ai: boolean;
  ai_prompt: string | null;
  ai_tone: 'friendly' | 'professional' | 'casual' | 'formal' | null;
  created_at: string;
  updated_at: string;
}

interface ReplyTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  content: string;
  variables: Record<string, any>;
  media_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReplyPool {
  id: string;
  rule_id: string;
  content: string;
  weight: number;
  media_urls: string[];
  is_active: boolean;
  created_at: string;
}

interface AnalyticsData {
  total_comments: number;
  replied_comments: number;
  reply_rate: number;
  avg_response_time: number;
  daily_stats: Array<{
    date: string;
    comments: number;
    replies: number;
  }>;
}

// 自動返信ルール一覧取得
export function useAutoReplyRules(workspaceId?: string) {
  return useQuery({
    queryKey: [queryKeys.autoReplyRules, workspaceId],
    queryFn: async (): Promise<AutoReplyRule[]> => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const response = await fetch(`/api/auto-reply/rules${params}`);
      if (!response.ok) {
        throw new Error('自動返信ルールの取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2分でstale
  });
}

// 単一自動返信ルール取得
export function useAutoReplyRule(id: string) {
  return useQuery({
    queryKey: queryKeys.autoReplyRule(id),
    queryFn: async (): Promise<AutoReplyRule> => {
      const response = await fetch(`/api/auto-reply/rules/${id}`);
      if (!response.ok) {
        throw new Error('自動返信ルールの取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!id,
  });
}

// 返信テンプレート一覧取得
export function useReplyTemplates(workspaceId?: string) {
  return useQuery({
    queryKey: [queryKeys.autoReplyTemplates, workspaceId],
    queryFn: async (): Promise<ReplyTemplate[]> => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const response = await fetch(`/api/auto-reply/templates${params}`);
      if (!response.ok) {
        throw new Error('返信テンプレートの取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // テンプレートは5分でstale
  });
}

// 返信プール一覧取得
export function useReplyPools(ruleId: string) {
  return useQuery({
    queryKey: queryKeys.autoReplyPools(ruleId),
    queryFn: async (): Promise<ReplyPool[]> => {
      const response = await fetch(`/api/auto-reply/pools?rule_id=${ruleId}`);
      if (!response.ok) {
        throw new Error('返信プールの取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!ruleId,
    staleTime: 3 * 60 * 1000, // 3分でstale
  });
}

// 自動返信履歴取得
export function useAutoReplyHistory(workspaceId?: string) {
  return useQuery({
    queryKey: [queryKeys.autoReplyHistory, workspaceId],
    queryFn: async () => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const response = await fetch(`/api/auto-reply/history${params}`);
      if (!response.ok) {
        throw new Error('自動返信履歴の取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 60 * 1000, // 履歴は1分でstale
  });
}

// 分析データ取得
export function useAutoReplyAnalytics(workspaceId?: string) {
  return useQuery({
    queryKey: [queryKeys.autoReplyAnalytics, workspaceId],
    queryFn: async (): Promise<AnalyticsData> => {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const response = await fetch(`/api/auto-reply/analytics${params}`);
      if (!response.ok) {
        throw new Error('分析データの取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 分析データは5分でstale
  });
}

// 自動返信ルール作成
export function useCreateAutoReplyRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newRule: Omit<AutoReplyRule, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await fetch('/api/auto-reply/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ルールの作成に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRules });
      
      toast({
        title: '成功',
        description: '自動返信ルールを作成しました',
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

// 自動返信ルール更新
export function useUpdateAutoReplyRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AutoReplyRule> }) => {
      const response = await fetch(`/api/auto-reply/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ルールの更新に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRules });
      queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRule(variables.id) });
      
      toast({
        title: '成功',
        description: '自動返信ルールを更新しました',
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

// 返信プール作成
export function useCreateReplyPool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newPool: Omit<ReplyPool, 'id' | 'created_at'>) => {
      const response = await fetch('/api/auto-reply/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPool),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '返信プールの作成に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.autoReplyPools(variables.rule_id) 
      });
      
      toast({
        title: '成功',
        description: '返信プールを作成しました',
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

// AI返信生成
export function useGenerateAIReply() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      comment_content: string;
      ai_prompt?: string;
      ai_tone?: string;
    }) => {
      const response = await fetch('/api/auto-reply/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI返信の生成に失敗しました');
      }
      
      return response.json();
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

// ルールの有効/無効切り替え
export function useToggleAutoReplyRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await fetch(`/api/auto-reply/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ルールの切り替えに失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRules });
      queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRule(variables.id) });
      
      toast({
        title: '成功',
        description: `ルールを${variables.is_active ? '有効' : '無効'}にしました`,
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