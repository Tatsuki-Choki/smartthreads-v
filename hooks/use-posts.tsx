'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/client';
import { useToast } from './use-toast';

interface Post {
  id: string;
  workspace_id: string;
  threads_account_id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  threads_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface PostsResponse {
  posts: Post[];
  hasMore: boolean;
  total: number;
}

// 投稿一覧取得（無限スクロール対応）
export function usePosts(filters: {
  status?: string;
  workspaceId?: string;
  limit?: number;
} = {}) {
  return useInfiniteQuery({
    queryKey: [queryKeys.posts, filters],
    queryFn: async ({ pageParam = 1 }): Promise<PostsResponse> => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: (filters.limit || 20).toString(),
      });
      
      if (filters.status) params.append('status', filters.status);
      if (filters.workspaceId) params.append('workspace_id', filters.workspaceId);
      
      const response = await fetch(`/api/posts?${params}`);
      if (!response.ok) {
        throw new Error('投稿の取得に失敗しました');
      }
      
      const data = await response.json();
      return {
        posts: data.data || [],
        hasMore: data.hasMore || false,
        total: data.total || 0,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 60 * 1000, // 投稿データは1分でstale
  });
}

// ステータス別投稿一覧取得
export function usePostsByStatus(status: string, workspaceId?: string) {
  return useQuery({
    queryKey: [queryKeys.postsByStatus(status), workspaceId],
    queryFn: async (): Promise<Post[]> => {
      const params = new URLSearchParams({ status });
      if (workspaceId) params.append('workspace_id', workspaceId);
      
      const response = await fetch(`/api/posts?${params}`);
      if (!response.ok) {
        throw new Error('投稿の取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 30 * 1000, // 30秒でstale（リアルタイム性重視）
  });
}

// 単一投稿取得
export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: async (): Promise<Post> => {
      const response = await fetch(`/api/posts/${id}`);
      if (!response.ok) {
        throw new Error('投稿の取得に失敗しました');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!id,
  });
}

// 投稿作成
export function useCreatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newPost: {
      content: string;
      threads_account_id: string;
      scheduled_at?: string;
      auto_reply_enabled?: boolean;
    }) => {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '投稿の作成に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // 関連するキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      queryClient.invalidateQueries({ queryKey: queryKeys.postsByStatus('draft') });
      queryClient.invalidateQueries({ queryKey: queryKeys.postsByStatus('scheduled') });
      
      toast({
        title: '成功',
        description: '投稿を作成しました',
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

// 投稿更新
export function useUpdatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Post> }) => {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '投稿の更新に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 関連するキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      queryClient.invalidateQueries({ queryKey: queryKeys.post(variables.id) });
      
      // ステータスが変更された可能性があるので、全ステータスのキャッシュを無効化
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.postsByStatus('draft') 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.postsByStatus('scheduled') 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.postsByStatus('published') 
      });
      
      toast({
        title: '成功',
        description: '投稿を更新しました',
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

// 投稿削除
export function useDeletePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '投稿の削除に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 関連するキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      queryClient.removeQueries({ queryKey: queryKeys.post(variables) });
      
      // 全ステータスのキャッシュを無効化
      ['draft', 'scheduled', 'published', 'failed'].forEach(status => {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.postsByStatus(status) 
        });
      });
      
      toast({
        title: '成功',
        description: '投稿を削除しました',
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

// 投稿の即座送信
export function usePublishPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/posts/${id}/publish`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '投稿の送信に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 関連するキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      queryClient.invalidateQueries({ queryKey: queryKeys.post(variables) });
      queryClient.invalidateQueries({ queryKey: queryKeys.postsByStatus('published') });
      
      toast({
        title: '成功',
        description: '投稿を送信しました',
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