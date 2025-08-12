import { queryClient, queryKeys } from './client';

/**
 * キャッシュユーティリティ関数
 * React Queryのキャッシュを効率的に管理するためのヘルパー関数群
 */

// 特定のワークスペースに関連するすべてのキャッシュを無効化
export function invalidateWorkspaceData(workspaceId: string) {
  const queries = [
    queryKeys.workspace(workspaceId),
    queryKeys.workspacePlan(workspaceId),
    queryKeys.threadsAccount(workspaceId),
    [queryKeys.posts, workspaceId],
    [queryKeys.autoReplyRules, workspaceId],
    [queryKeys.autoReplyHistory, workspaceId],
    [queryKeys.autoReplyAnalytics, workspaceId],
  ];

  queries.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });
}

// 投稿関連のキャッシュを無効化（ステータス変更時など）
export function invalidatePostsData(options?: {
  postId?: string;
  status?: string;
  workspaceId?: string;
}) {
  // 全投稿一覧を無効化
  queryClient.invalidateQueries({ queryKey: queryKeys.posts });

  // 特定の投稿が指定されている場合
  if (options?.postId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.post(options.postId) });
  }

  // ステータス別投稿一覧を無効化
  if (options?.status) {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.postsByStatus(options.status) 
    });
  }

  // 主要なステータスのキャッシュも無効化
  ['draft', 'scheduled', 'published', 'failed'].forEach(status => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.postsByStatus(status) 
    });
  });
}

// 自動返信関連のキャッシュを無効化
export function invalidateAutoReplyData(options?: {
  ruleId?: string;
  workspaceId?: string;
}) {
  queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyRules });
  queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyHistory });
  queryClient.invalidateQueries({ queryKey: queryKeys.autoReplyAnalytics });

  if (options?.ruleId) {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.autoReplyRule(options.ruleId) 
    });
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.autoReplyPools(options.ruleId) 
    });
  }
}

// 管理者データのキャッシュを無効化
export function invalidateAdminData(workspaceId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.adminWorkspaces });
  
  if (workspaceId) {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.adminPlanHistory(workspaceId) 
    });
  }
}

// 特定のキーのキャッシュを事前に取得（プリフェッチ）
export async function prefetchWorkspaceData(workspaceId: string) {
  const prefetchPromises = [
    queryClient.prefetchQuery({
      queryKey: queryKeys.workspace(workspaceId),
      queryFn: async () => {
        const response = await fetch(`/api/workspaces/${workspaceId}`);
        if (!response.ok) throw new Error('Failed to fetch workspace');
        const data = await response.json();
        return data.data;
      },
      staleTime: 5 * 60 * 1000, // 5分間フレッシュ
    }),
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.workspacePlan(workspaceId),
      queryFn: async () => {
        const response = await fetch(`/api/workspaces/${workspaceId}/plan`);
        if (!response.ok) throw new Error('Failed to fetch plan');
        const data = await response.json();
        return data.data;
      },
      staleTime: 2 * 60 * 1000, // 2分間フレッシュ
    }),
  ];

  return Promise.all(prefetchPromises);
}

// キャッシュサイズを監視・最適化
export function optimizeCache() {
  const cache = queryClient.getQueryCache();
  const totalQueries = cache.getAll().length;
  
  // キャッシュが大きくなりすぎた場合の最適化
  if (totalQueries > 100) {
    console.log(`キャッシュ最適化中... (${totalQueries}件のクエリ)`);
    
    // 使用されていない古いキャッシュを削除
    cache.getAll().forEach(query => {
      const timeSinceLastUse = Date.now() - query.state.dataUpdatedAt;
      const oneHour = 60 * 60 * 1000;
      
      // 1時間以上使用されていないキャッシュを削除
      if (timeSinceLastUse > oneHour && query.getObserversCount() === 0) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
    
    console.log(`キャッシュ最適化完了 (${cache.getAll().length}件)`);
  }
}

// 開発環境でのキャッシュ状態のログ出力
export function logCacheStatus() {
  if (process.env.NODE_ENV === 'development') {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    console.group('React Query Cache Status');
    console.log(`総クエリ数: ${queries.length}`);
    
    const statusCounts = queries.reduce((acc, query) => {
      const status = query.state.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('ステータス別:', statusCounts);
    
    const staleQueries = queries.filter(query => query.isStale()).length;
    console.log(`Staleクエリ数: ${staleQueries}`);
    
    console.groupEnd();
  }
}

// 緊急時のキャッシュ全削除
export function clearAllCache() {
  queryClient.clear();
  console.log('すべてのキャッシュを削除しました');
}

// ネットワーク状態に応じたキャッシュ戦略の調整
export function adjustCacheForNetwork(isOnline: boolean) {
  if (!isOnline) {
    // オフライン時はstaleTimeを長くしてキャッシュを長期間保持
    queryClient.setDefaultOptions({
      queries: {
        staleTime: 30 * 60 * 1000, // 30分
        gcTime: 60 * 60 * 1000, // 1時間
        retry: 0, // リトライを無効化
      },
    });
  } else {
    // オンライン時は通常の設定に戻す
    queryClient.setDefaultOptions({
      queries: {
        staleTime: 5 * 60 * 1000, // 5分
        gcTime: 10 * 60 * 1000, // 10分
        retry: (failureCount, error: any) => {
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
      },
    });
  }
}