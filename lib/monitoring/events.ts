import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export type EventType = 
  | 'post_success' | 'post_failure' | 'post_scheduled'
  | 'reply_success' | 'reply_failure' | 'reply_queued'
  | 'rate_limit_hit' | 'api_error' | 'system_error'
  | 'webhook_received' | 'webhook_failed'
  | 'cron_executed' | 'cron_failed'
  | 'auth_success' | 'auth_failure';

export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

interface LogEventParams {
  eventType: EventType;
  title: string;
  description?: string;
  severity?: EventSeverity;
  workspaceId?: string;
  metadata?: Record<string, any>;
  userId?: string;
  postId?: string;
  commentId?: string;
  ruleId?: string;
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
}

/**
 * システムイベントをログに記録
 */
export async function logSystemEvent(params: LogEventParams): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('system_events')
      .insert({
        event_type: params.eventType,
        title: params.title,
        description: params.description,
        severity: params.severity || 'info',
        workspace_id: params.workspaceId,
        metadata: params.metadata,
        user_id: params.userId,
        post_id: params.postId,
        comment_id: params.commentId,
        rule_id: params.ruleId,
        error_code: params.errorCode,
        error_message: params.errorMessage,
        stack_trace: params.stackTrace,
        occurred_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('システムイベントログエラー:', error);
      return null;
    }

    // 重要なイベントは通知キューに追加
    if (params.severity === 'error' || params.severity === 'critical') {
      await queueNotification({
        workspaceId: params.workspaceId!,
        eventType: params.eventType,
        subject: params.title,
        body: params.description || params.title,
        eventId: data.id
      });
    }

    return data.id;
  } catch (error) {
    console.error('システムイベントログエラー:', error);
    return null;
  }
}

/**
 * 通知をキューに追加
 */
export async function queueNotification(params: {
  workspaceId: string;
  eventType: EventType;
  subject: string;
  body: string;
  eventId?: string;
}): Promise<void> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 通知設定を取得
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('workspace_id', params.workspaceId);

    if (!settings || settings.length === 0) {
      return;
    }

    for (const setting of settings) {
      let shouldNotify = false;

      // イベントタイプに応じた通知判定
      switch (params.eventType) {
        case 'post_success':
          shouldNotify = setting.notify_post_success;
          break;
        case 'post_failure':
          shouldNotify = setting.notify_post_failure;
          break;
        case 'reply_success':
          shouldNotify = setting.notify_reply_success;
          break;
        case 'reply_failure':
          shouldNotify = setting.notify_reply_failure;
          break;
        case 'rate_limit_hit':
          shouldNotify = setting.notify_rate_limit;
          break;
        case 'system_error':
        case 'api_error':
          shouldNotify = setting.notify_system_error;
          break;
      }

      if (!shouldNotify) continue;

      // 静音時間チェック
      if (setting.quiet_hours_start && setting.quiet_hours_end) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = setting.quiet_hours_start.split(':').map(Number);
        const [endHour, endMin] = setting.quiet_hours_end.split(':').map(Number);
        const quietStart = startHour * 60 + startMin;
        const quietEnd = endHour * 60 + endMin;

        if (quietStart <= quietEnd) {
          if (currentTime >= quietStart && currentTime <= quietEnd) continue;
        } else {
          if (currentTime >= quietStart || currentTime <= quietEnd) continue;
        }
      }

      // メール通知
      if (setting.email_enabled) {
        await supabase
          .from('notification_queue')
          .insert({
            workspace_id: params.workspaceId,
            recipient_user_id: setting.user_id,
            channel: 'email',
            subject: params.subject,
            body: params.body,
            event_id: params.eventId,
            scheduled_at: new Date().toISOString()
          });
      }

      // Webhook通知
      if (setting.webhook_enabled && setting.webhook_url) {
        await supabase
          .from('notification_queue')
          .insert({
            workspace_id: params.workspaceId,
            recipient_user_id: setting.user_id,
            channel: 'webhook',
            subject: params.subject,
            body: params.body,
            event_id: params.eventId,
            metadata: { webhook_url: setting.webhook_url },
            scheduled_at: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    console.error('通知キューエラー:', error);
  }
}

/**
 * メトリクスを記録
 */
export async function recordMetric(params: {
  workspaceId?: string;
  metricType: 'api_latency' | 'db_latency' | 'queue_depth' | 'success_rate' | 'error_rate' | 'throughput';
  value: number;
  unit?: string;
  endpoint?: string;
  operation?: string;
}): Promise<void> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    await supabase
      .from('system_metrics')
      .insert({
        workspace_id: params.workspaceId,
        metric_type: params.metricType,
        value: params.value,
        unit: params.unit,
        endpoint: params.endpoint,
        operation: params.operation,
        measured_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('メトリクス記録エラー:', error);
  }
}

/**
 * APIレスポンスにイベントログを追加するデコレーター
 */
export function withEventLogging<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  eventConfig: {
    successEvent?: EventType;
    failureEvent?: EventType;
    getTitle: (args: Parameters<T>) => string;
    getWorkspaceId?: (args: Parameters<T>) => string | undefined;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    let workspaceId: string | undefined;

    try {
      workspaceId = eventConfig.getWorkspaceId?.(args);
      const result = await handler(...args);
      
      // 成功イベントをログ
      if (eventConfig.successEvent) {
        await logSystemEvent({
          eventType: eventConfig.successEvent,
          title: eventConfig.getTitle(args),
          severity: 'info',
          workspaceId,
          metadata: {
            duration_ms: Date.now() - startTime
          }
        });
      }

      // レイテンシーメトリクスを記録
      await recordMetric({
        workspaceId,
        metricType: 'api_latency',
        value: Date.now() - startTime,
        unit: 'ms',
        operation: eventConfig.successEvent
      });

      return result;
    } catch (error) {
      // エラーイベントをログ
      if (eventConfig.failureEvent) {
        await logSystemEvent({
          eventType: eventConfig.failureEvent,
          title: `エラー: ${eventConfig.getTitle(args)}`,
          description: error instanceof Error ? error.message : String(error),
          severity: 'error',
          workspaceId,
          errorMessage: error instanceof Error ? error.message : String(error),
          stackTrace: error instanceof Error ? error.stack : undefined,
          metadata: {
            duration_ms: Date.now() - startTime
          }
        });
      }

      throw error;
    }
  }) as T;
}