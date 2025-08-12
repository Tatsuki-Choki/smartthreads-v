import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

interface QueueItem {
  id: string;
  comment_id: string;
  workspace_id: string;
  account_id: string;
  reply_content: string;
  status: string;
  retry_count: number;
  scheduled_at: string;
  processed_at: string | null;
  error_message: string | null;
  comments: {
    id: string;
    threads_comment_id: string;
    content: string;
    author_username: string;
  };
  threads_accounts: {
    id: string;
    access_token: string;
    username: string;
  };
}

// Cronジョブから呼び出されるエンドポイント
export async function POST(req: NextRequest) {
  try {
    // Cronシークレットの検証
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 処理対象のキューアイテムを取得
    const { data: queueItems, error: fetchError } = await supabase
      .from('reply_queue')
      .select(`
        *,
        comments (
          id,
          threads_comment_id,
          content,
          author_username
        ),
        threads_accounts (
          id,
          access_token,
          username
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .lt('retry_count', MAX_RETRIES)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('キューアイテムの取得に失敗:', fetchError);
      return NextResponse.json(
        { error: 'キューアイテムの取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        message: '処理対象のアイテムがありません',
        processed: 0
      });
    }

    const results = {
      successful: 0,
      failed: 0,
      retried: 0
    };

    // 各アイテムを処理
    for (const item of queueItems as QueueItem[]) {
      const result = await processQueueItem(supabase, item);
      
      if (result.success) {
        results.successful++;
      } else if (result.retry) {
        results.retried++;
      } else {
        results.failed++;
      }
    }

    return NextResponse.json({
      message: 'キュー処理が完了しました',
      results
    });

  } catch (error) {
    console.error('キュー処理エラー:', error);
    return NextResponse.json(
      { error: 'キュー処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 個別のキューアイテムを処理
async function processQueueItem(
  supabase: any,
  item: QueueItem
): Promise<{ success: boolean; retry: boolean }> {
  try {
    // レート制限チェック
    const canReply = await checkRateLimit(supabase, item.workspace_id, item.account_id);
    if (!canReply) {
      // レート制限により延期
      await postponeQueueItem(supabase, item.id, '1 hour');
      return { success: false, retry: true };
    }

    // Threads APIで返信を投稿
    const replyResult = await postReplyToThreads(
      item.comments.threads_comment_id,
      item.reply_content,
      item.threads_accounts.access_token
    );

    if (replyResult.success) {
      // 成功: キューアイテムを完了状態に更新
      await supabase
        .from('reply_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          threads_reply_id: replyResult.replyId
        })
        .eq('id', item.id);

      // コメントの返信状態を更新
      await supabase
        .from('comments')
        .update({
          is_replied: true,
          replied_at: new Date().toISOString()
        })
        .eq('id', item.comments.id);

      // 返信履歴に記録
      await supabase
        .from('reply_history')
        .insert({
          workspace_id: item.workspace_id,
          comment_id: item.comments.id,
          rule_id: item.rule_id,
          reply_content: item.reply_content,
          threads_reply_id: replyResult.replyId,
          created_at: new Date().toISOString()
        });

      return { success: true, retry: false };

    } else {
      // エラー処理
      const isTemporary = isTemporaryError(replyResult.error);
      
      if (isTemporary && item.retry_count < MAX_RETRIES - 1) {
        // 一時的エラー: リトライ
        await retryQueueItem(supabase, item.id, item.retry_count, replyResult.error);
        return { success: false, retry: true };
      } else {
        // 永続的エラー: 失敗として記録
        await failQueueItem(supabase, item.id, replyResult.error);
        return { success: false, retry: false };
      }
    }

  } catch (error) {
    console.error(`キューアイテム ${item.id} の処理エラー:`, error);
    await failQueueItem(supabase, item.id, String(error));
    return { success: false, retry: false };
  }
}

// Threads APIで返信を投稿
async function postReplyToThreads(
  commentId: string,
  replyContent: string,
  accessToken: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    // Step 1: 返信コンテナを作成
    const createResponse = await fetch(
      `${THREADS_API_BASE}/me/threads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: replyContent,
          reply_to_id: commentId,
          media_type: 'TEXT'
        })
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      return { 
        success: false, 
        error: `返信作成エラー: ${createResponse.status} - ${error}` 
      };
    }

    const createData = await createResponse.json();
    const containerId = createData.id;

    // Step 2: 返信を公開
    const publishResponse = await fetch(
      `${THREADS_API_BASE}/me/threads_publish`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: containerId
        })
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      return { 
        success: false, 
        error: `返信公開エラー: ${publishResponse.status} - ${error}` 
      };
    }

    const publishData = await publishResponse.json();
    return { 
      success: true, 
      replyId: publishData.id 
    };

  } catch (error) {
    return { 
      success: false, 
      error: `API呼び出しエラー: ${String(error)}` 
    };
  }
}

// レート制限チェック
async function checkRateLimit(
  supabase: any,
  workspaceId: string,
  accountId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_auto_reply_rate_limit', {
      p_workspace_id: workspaceId,
      p_account_id: accountId
    });

  if (error) {
    console.error('レート制限チェックエラー:', error);
    return false;
  }

  return data === true;
}

// キューアイテムを延期
async function postponeQueueItem(
  supabase: any,
  itemId: string,
  delay: string
): Promise<void> {
  const newScheduledAt = new Date();
  if (delay === '1 hour') {
    newScheduledAt.setHours(newScheduledAt.getHours() + 1);
  }

  await supabase
    .from('reply_queue')
    .update({
      scheduled_at: newScheduledAt.toISOString(),
      status: 'postponed'
    })
    .eq('id', itemId);
}

// キューアイテムをリトライ
async function retryQueueItem(
  supabase: any,
  itemId: string,
  currentRetryCount: number,
  errorMessage: string
): Promise<void> {
  // エクスポネンシャルバックオフ
  const delayMinutes = Math.pow(2, currentRetryCount + 1) * 5;
  const newScheduledAt = new Date();
  newScheduledAt.setMinutes(newScheduledAt.getMinutes() + delayMinutes);

  await supabase
    .from('reply_queue')
    .update({
      retry_count: currentRetryCount + 1,
      scheduled_at: newScheduledAt.toISOString(),
      error_message: errorMessage,
      status: 'pending'
    })
    .eq('id', itemId);
}

// キューアイテムを失敗として記録
async function failQueueItem(
  supabase: any,
  itemId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('reply_queue')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      error_message: errorMessage
    })
    .eq('id', itemId);
}

// 一時的エラーかどうか判定
function isTemporaryError(error: string): boolean {
  const temporaryErrorPatterns = [
    'rate limit',
    'timeout',
    'network',
    '500',
    '502',
    '503',
    '504',
    'temporary'
  ];

  const errorLower = error.toLowerCase();
  return temporaryErrorPatterns.some(pattern => errorLower.includes(pattern));
}

// 手動実行用エンドポイント（開発・デバッグ用）
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  // キューの状態を取得
  const { data: stats, error } = await supabase
    .from('reply_queue')
    .select('status')
    .in('status', ['pending', 'processing', 'completed', 'failed']);

  if (error) {
    return NextResponse.json(
      { error: 'キュー状態の取得に失敗しました' },
      { status: 500 }
    );
  }

  const statusCounts = stats?.reduce((acc: any, item: any) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    message: 'キュー処理状態',
    stats: statusCounts || {},
    nextProcessTime: new Date(Date.now() + 60000).toISOString()
  });
}