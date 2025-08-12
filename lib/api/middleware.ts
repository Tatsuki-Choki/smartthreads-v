import { NextRequest, NextResponse } from 'next/server';
import { logSystemEvent, recordMetric, EventType } from '@/lib/monitoring/events';

interface ApiHandlerOptions {
  requireAuth?: boolean;
  requireWorkspace?: boolean;
  successEvent?: EventType;
  failureEvent?: EventType;
  eventTitle?: string;
}

/**
 * APIハンドラーのラッパー
 * エラーハンドリング、ロギング、メトリクス記録を統一的に処理
 */
export function withApiHandler<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options: ApiHandlerOptions = {}
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const workspaceId = req.headers.get('x-workspace-id') || undefined;
    
    try {
      // リクエストの基本情報をログ
      console.log(`[API] ${req.method} ${req.url}`);
      
      // 認証チェック（必要な場合）
      if (options.requireAuth) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          await logSystemEvent({
            eventType: 'auth_failure',
            title: `認証失敗: ${req.url}`,
            severity: 'warning',
            workspaceId,
            metadata: {
              method: req.method,
              url: req.url
            }
          });
          
          return NextResponse.json(
            { error: '認証が必要です' },
            { status: 401 }
          );
        }
      }
      
      // ワークスペースIDチェック（必要な場合）
      if (options.requireWorkspace && !workspaceId) {
        return NextResponse.json(
          { error: 'ワークスペースIDが必要です' },
          { status: 400 }
        );
      }
      
      // メインハンドラーを実行
      const response = await handler(req, context);
      
      // 成功イベントをログ
      if (options.successEvent) {
        await logSystemEvent({
          eventType: options.successEvent,
          title: options.eventTitle || `API成功: ${req.url}`,
          severity: 'info',
          workspaceId,
          metadata: {
            method: req.method,
            url: req.url,
            duration_ms: Date.now() - startTime,
            status: response.status
          }
        });
      }
      
      // メトリクスを記録
      await recordMetric({
        workspaceId,
        metricType: 'api_latency',
        value: Date.now() - startTime,
        unit: 'ms',
        endpoint: req.url,
        operation: req.method
      });
      
      // 成功率メトリクス
      if (response.status < 400) {
        await recordMetric({
          workspaceId,
          metricType: 'success_rate',
          value: 1,
          endpoint: req.url
        });
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // エラーイベントをログ
      await logSystemEvent({
        eventType: options.failureEvent || 'api_error',
        title: options.eventTitle 
          ? `エラー: ${options.eventTitle}` 
          : `APIエラー: ${req.url}`,
        description: error instanceof Error ? error.message : String(error),
        severity: 'error',
        workspaceId,
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: {
          method: req.method,
          url: req.url,
          duration_ms: duration
        }
      });
      
      // エラー率メトリクス
      await recordMetric({
        workspaceId,
        metricType: 'error_rate',
        value: 1,
        endpoint: req.url
      });
      
      // エラーレスポンスを返す
      console.error(`[API Error] ${req.url}:`, error);
      
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      
      return NextResponse.json(
        { error: 'サーバーエラーが発生しました' },
        { status: 500 }
      );
    }
  };
}

/**
 * カスタムAPIエラークラス
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 一般的なエラーレスポンスヘルパー
 */
export const ApiResponses = {
  unauthorized: () => 
    NextResponse.json({ error: '認証が必要です' }, { status: 401 }),
  
  forbidden: () => 
    NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 }),
  
  notFound: (resource: string = 'リソース') => 
    NextResponse.json({ error: `${resource}が見つかりません` }, { status: 404 }),
  
  badRequest: (message: string = '不正なリクエストです') => 
    NextResponse.json({ error: message }, { status: 400 }),
  
  serverError: (message: string = 'サーバーエラーが発生しました') => 
    NextResponse.json({ error: message }, { status: 500 }),
  
  success: <T>(data: T, message?: string) => 
    NextResponse.json({ success: true, message, data }),
  
  created: <T>(data: T, message: string = 'リソースを作成しました') => 
    NextResponse.json({ success: true, message, data }, { status: 201 }),
  
  noContent: () => 
    new NextResponse(null, { status: 204 })
};

/**
 * レート制限チェック
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 60,
  window: number = 3600
): Promise<boolean> {
  // Redisまたはメモリベースのレート制限実装
  // 簡易実装の例
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  
  // TODO: 実際の実装では、Redisやupstashを使用
  return true;
}

/**
 * リトライロジック
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      onRetry?.(attempt, lastError);
      
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}