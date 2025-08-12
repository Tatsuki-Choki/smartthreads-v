import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.THREADS_WEBHOOK_SECRET || 'default_secret';

// Webhook署名検証
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Threads Webhookの署名検証
  // Format: sha256=<hash>
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const hash = signature.substring(7); // Remove 'sha256=' prefix
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // タイミング攻撃を防ぐために定数時間比較を使用
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}

// GET: Webhook検証用（Threadsがエンドポイントを確認）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Webhook検証リクエストの処理
  if (mode === 'subscribe' && token === webhookSecret) {
    console.log('Webhook検証成功');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: 'Webhook検証失敗' },
    { status: 403 }
  );
}

// POST: Webhookイベント受信
export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';

    // 署名検証（本番環境でのみ）
    if (process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('Webhook署名検証失敗');
        return NextResponse.json(
          { error: '署名検証失敗' },
          { status: 401 }
        );
      }
    }

    // JSONパース
    const payload = JSON.parse(rawBody);
    console.log('Webhook受信:', JSON.stringify(payload, null, 2));

    // Supabaseクライアント作成（サービスロールキーで）
    const supabase = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey
    );

    // イベントタイプごとの処理
    const { entry } = payload;
    if (!entry || entry.length === 0) {
      return NextResponse.json({ received: true });
    }

    for (const item of entry) {
      // コメントイベントの処理
      if (item.changes) {
        for (const change of item.changes) {
          if (change.field === 'comments' && change.value) {
            await processCommentWebhook(supabase, change.value, item.id);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhookエラー:', error);
    return NextResponse.json(
      { error: 'Webhook処理エラー' },
      { status: 500 }
    );
  }
}

// コメントWebhook処理
async function processCommentWebhook(
  supabase: any,
  commentData: any,
  threadsAccountId: string
) {
  try {
    console.log('コメント処理開始:', commentData);

    // Threadsアカウント情報を取得
    const { data: threadsAccount } = await supabase
      .from('threads_accounts')
      .select('workspace_id')
      .eq('threads_user_id', threadsAccountId)
      .single();

    if (!threadsAccount) {
      console.error('Threadsアカウントが見つかりません:', threadsAccountId);
      return;
    }

    // コメントデータを保存
    const { data: savedComment, error: saveError } = await supabase
      .from('comments')
      .insert({
        workspace_id: threadsAccount.workspace_id,
        threads_comment_id: commentData.id,
        threads_post_id: commentData.media?.id || commentData.parent_id,
        threads_user_id: commentData.from?.id || 'unknown',
        threads_parent_comment_id: commentData.parent_id || null,
        username: commentData.from?.username || 'unknown',
        display_name: commentData.from?.name || null,
        profile_picture_url: commentData.from?.profile_picture_url || null,
        content: commentData.text || '',
        media_urls: commentData.media_url ? [commentData.media_url] : [],
        raw_data: commentData,
        created_at: commentData.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('コメント保存エラー:', saveError);
      return;
    }

    console.log('コメント保存成功:', savedComment.id);

    // 自動返信ルールのマッチング処理
    await processAutoReplyRules(supabase, savedComment, threadsAccount.workspace_id);

  } catch (error) {
    console.error('コメント処理エラー:', error);
  }
}

// 自動返信ルールマッチング処理
async function processAutoReplyRules(
  supabase: any,
  comment: any,
  workspaceId: string
) {
  try {
    console.log('ルールマッチング開始:', comment.id);

    // アクティブなルールを優先度順で取得
    const { data: rules, error: rulesError } = await supabase
      .from('auto_reply_rules')
      .select(`
        *,
        reply_templates (
          id,
          name,
          content
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError || !rules || rules.length === 0) {
      console.log('アクティブなルールがありません');
      return;
    }

    // 各ルールをチェック
    for (const rule of rules) {
      // キーワードマッチング
      const { data: matchResult } = await supabase
        .rpc('check_keyword_match', {
          p_content: comment.content,
          p_keywords: rule.trigger_keywords,
          p_exclude_keywords: rule.exclude_keywords,
          p_match_mode: rule.match_mode
        });

      if (!matchResult) {
        continue;
      }

      console.log('ルールマッチ:', rule.name);

      // レート制限チェック
      const { data: rateLimitOk } = await supabase
        .rpc('check_auto_reply_rate_limit', {
          p_workspace_id: workspaceId,
          p_threads_account_id: rule.threads_account_id,
          p_rule_id: rule.id,
          p_threads_user_id: comment.threads_user_id
        });

      if (!rateLimitOk) {
        console.log('レート制限に達しています:', rule.name);
        continue;
      }

      // 返信内容を生成
      let replyContent = rule.reply_content;
      if (rule.reply_template_id && rule.reply_templates) {
        replyContent = rule.reply_templates.content;
      }

      // 変数置換
      replyContent = replyContent
        .replace(/\{\{username\}\}/g, comment.username)
        .replace(/\{\{comment\}\}/g, comment.content)
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('ja-JP'));

      // 返信をキューに追加
      const scheduledFor = new Date();
      scheduledFor.setSeconds(scheduledFor.getSeconds() + rule.reply_delay_seconds);

      const { data: queueItem, error: queueError } = await supabase
        .from('reply_queue')
        .insert({
          workspace_id: workspaceId,
          comment_id: comment.id,
          rule_id: rule.id,
          reply_content: replyContent,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (queueError) {
        console.error('キュー追加エラー:', queueError);
        continue;
      }

      // コメントにマッチしたルールを記録
      await supabase
        .from('comments')
        .update({
          matched_rule_id: rule.id
        })
        .eq('id', comment.id);

      // イベントログ記録
      await supabase
        .from('auto_reply_logs')
        .insert({
          workspace_id: workspaceId,
          comment_id: comment.id,
          rule_id: rule.id,
          threads_account_id: rule.threads_account_id,
          event_type: 'rule_matched',
          event_details: {
            rule_name: rule.name,
            match_mode: rule.match_mode,
            keywords: rule.trigger_keywords,
            queue_id: queueItem.id
          }
        });

      console.log('返信キューに追加:', queueItem.id);

      // 最初にマッチしたルールで処理を終了
      break;
    }

  } catch (error) {
    console.error('ルールマッチングエラー:', error);
  }
}