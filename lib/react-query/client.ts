import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // キャッシュの保持時間（5分）
      staleTime: 5 * 60 * 1000,
      // データが古くなった時の再フェッチ間隔（10分）
      gcTime: 10 * 60 * 1000,
      // ネットワークエラー時のリトライ回数
      retry: (failureCount, error: any) => {
        // 認証エラーやクライアントエラーはリトライしない
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      // リトライ間隔（指数関数的に増加）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // ウィンドウフォーカス時の自動再フェッチを無効化
      refetchOnWindowFocus: false,
      // マウント時の自動再フェッチを無効化（データが新しい場合）
      refetchOnMount: 'always',
    },
    mutations: {
      // ミューテーション失敗時のリトライ回数
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

// キャッシュキーの定数定義
export const queryKeys = {
  // ワークスペース関連
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspaces', id] as const,
  workspacePlan: (id: string) => ['workspaces', id, 'plan'] as const,
  
  // Threadsアカウント関連
  threadsAccounts: ['threads-accounts'] as const,
  threadsAccount: (workspaceId: string) => ['threads-accounts', workspaceId] as const,
  
  // 投稿関連
  posts: ['posts'] as const,
  postsByStatus: (status: string) => ['posts', 'status', status] as const,
  post: (id: string) => ['posts', id] as const,
  
  // 自動返信関連
  autoReplyRules: ['auto-reply', 'rules'] as const,
  autoReplyRule: (id: string) => ['auto-reply', 'rules', id] as const,
  autoReplyTemplates: ['auto-reply', 'templates'] as const,
  autoReplyPools: (ruleId: string) => ['auto-reply', 'pools', ruleId] as const,
  autoReplyHistory: ['auto-reply', 'history'] as const,
  autoReplyAnalytics: ['auto-reply', 'analytics'] as const,
  
  // コメント関連
  comments: ['comments'] as const,
  commentsByPost: (postId: string) => ['comments', 'post', postId] as const,
  
  // 管理者関連
  adminWorkspaces: ['admin', 'workspaces'] as const,
  adminPlanHistory: (workspaceId: string) => ['admin', 'workspaces', workspaceId, 'plan-history'] as const,
  
  // システム関連
  systemEvents: ['system', 'events'] as const,
  systemMetrics: ['system', 'metrics'] as const,
} as const;