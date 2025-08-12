import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Cronジョブ: 自動返信キューの処理
 * Vercel Cronから5分ごとに実行される
 */
export async function GET(request: NextRequest) {
  console.log('=== 自動返信キュー処理Cronジョブ開始 ===')
  
  // Cronシークレットの検証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Cron認証失敗: 無効なシークレット')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      rateLimited: 0,
      errors: [] as any[]
    }

    // 処理予定の返信を取得
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from('reply_queue')
      .select(`
        *,
        comments (
          id,
          threads_comment_id,
          threads_post_id,
          threads_user_id,
          username
        ),
        auto_reply_rules (
          id,
          name,
          threads_account_id,
          max_replies_per_hour,
          max_replies_per_user
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10) // 一度に処理する最大数

    if (fetchError) {
      console.error('返信キューの取得エラー:', fetchError)
      return NextResponse.json({ 
        error: '返信キューの取得に失敗しました',
        details: fetchError 
      }, { status: 500 })
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('処理予定の返信はありません')
      return NextResponse.json({ 
        message: '処理予定の返信はありません',
        results 
      })
    }

    console.log(`${queueItems.length}件の返信を処理します`)

    // 各返信を処理
    for (const item of queueItems) {
      results.processed++
      
      try {
        // ステータスを処理中に更新
        await supabaseAdmin
          .from('reply_queue')
          .update({
            status: 'processing',
            updated_at: now.toISOString()
          })
          .eq('id', item.id)

        // レート制限チェック
        const rateLimitOk = await checkRateLimit(
          item.workspace_id,
          item.rule_id,
          item.comments?.threads_user_id
        )

        if (!rateLimitOk) {
          // レート制限に達した
          await supabaseAdmin
            .from('reply_queue')
            .update({
              status: 'failed',
              last_error: 'レート制限に達しました',
              updated_at: now.toISOString()
            })
            .eq('id', item.id)

          results.rateLimited++
          console.log(`レート制限: ${item.id}`)
          continue
        }

        // Threadsアカウント情報を取得
        const { data: threadsAccount, error: accountError } = await supabaseAdmin
          .from('threads_accounts')
          .select('*')
          .eq('id', item.auto_reply_rules?.threads_account_id)
          .single()

        if (accountError || !threadsAccount) {
          throw new Error('Threadsアカウントが見つかりません')
        }

        // Threads APIへの返信送信
        const replyResult = await sendReplyToThreads(
          item.comments?.threads_comment_id,
          item.reply_content,
          threadsAccount.threads_user_id,
          threadsAccount.access_token,
          item.reply_media_urls
        )

        if (replyResult.success) {
          // 返信成功
          await supabaseAdmin
            .from('reply_queue')
            .update({
              status: 'completed',
              processed_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', item.id)

          // コメントテーブルを更新
          await supabaseAdmin
            .from('comments')
            .update({
              replied: true,
              reply_sent_at: now.toISOString(),
              matched_rule_id: item.rule_id
            })
            .eq('id', item.comment_id)

          // ログを記録
          await supabaseAdmin
            .from('auto_reply_logs')
            .insert({
              workspace_id: item.workspace_id,
              comment_id: item.comment_id,
              rule_id: item.rule_id,
              threads_account_id: threadsAccount.id,
              event_type: 'reply_sent',
              event_details: {
                reply_id: replyResult.replyId,
                content: item.reply_content.substring(0, 100)
              },
              processing_time_ms: Date.now() - now.getTime()
            })

          results.sent++
          console.log(`返信成功: ${item.id} -> Reply ID: ${replyResult.replyId}`)
        } else {
          // 返信失敗
          await supabaseAdmin
            .from('reply_queue')
            .update({
              status: 'failed',
              last_error: replyResult.error,
              retry_count: item.retry_count + 1,
              updated_at: now.toISOString()
            })
            .eq('id', item.id)

          // エラーログを記録
          await supabaseAdmin
            .from('auto_reply_logs')
            .insert({
              workspace_id: item.workspace_id,
              comment_id: item.comment_id,
              rule_id: item.rule_id,
              threads_account_id: threadsAccount.id,
              event_type: 'reply_failed',
              event_details: {
                error: replyResult.error,
                retry_count: item.retry_count + 1
              }
            })

          results.failed++
          results.errors.push({
            queueId: item.id,
            error: replyResult.error
          })
          console.error(`返信失敗: ${item.id}`, replyResult.error)
        }
      } catch (error) {
        // エラー処理
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        await supabaseAdmin
          .from('reply_queue')
          .update({
            status: 'failed',
            last_error: errorMessage,
            retry_count: item.retry_count + 1,
            updated_at: now.toISOString()
          })
          .eq('id', item.id)

        results.failed++
        results.errors.push({
          queueId: item.id,
          error: errorMessage
        })
        console.error(`返信処理エラー: ${item.id}`, error)
      }

      // レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('=== 自動返信キュー処理Cronジョブ完了 ===', results)

    return NextResponse.json({
      message: '自動返信の処理が完了しました',
      results
    })

  } catch (error) {
    console.error('Cronジョブエラー:', error)
    return NextResponse.json({ 
      error: 'Cronジョブの実行に失敗しました',
      details: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}

/**
 * レート制限チェック
 */
async function checkRateLimit(
  workspaceId: string,
  ruleId: string,
  threadsUserId?: string
): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    // ルールの設定を取得
    const { data: rule } = await supabaseAdmin
      .from('auto_reply_rules')
      .select('max_replies_per_hour, max_replies_per_user')
      .eq('id', ruleId)
      .single()

    if (!rule) return false

    // 過去1時間の返信数をチェック
    const { count: hourCount } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('matched_rule_id', ruleId)
      .eq('replied', true)
      .gte('reply_sent_at', oneHourAgo.toISOString())

    if (hourCount && hourCount >= rule.max_replies_per_hour) {
      console.log(`時間あたりの返信制限に達しました: ${hourCount}/${rule.max_replies_per_hour}`)
      return false
    }

    // 同一ユーザーへの返信数をチェック
    if (threadsUserId) {
      const { count: userCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('matched_rule_id', ruleId)
        .eq('threads_user_id', threadsUserId)
        .eq('replied', true)

      if (userCount && userCount >= rule.max_replies_per_user) {
        console.log(`ユーザーあたりの返信制限に達しました: ${userCount}/${rule.max_replies_per_user}`)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('レート制限チェックエラー:', error)
    return false
  }
}

/**
 * Threads APIに返信を送信
 */
async function sendReplyToThreads(
  commentId: string,
  replyText: string,
  userId: string,
  accessToken: string,
  mediaUrls?: string[]
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`Threads APIへの返信送信: Comment ${commentId}`)
    
    // 返信の作成
    const url = `https://graph.threads.net/v1.0/${userId}/threads`
    
    const params = new URLSearchParams({
      access_token: accessToken,
      text: replyText,
      reply_to_id: commentId,
      media_type: 'TEXT'
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Threads API エラー:', data)
      return {
        success: false,
        error: data.error?.message || 'Threads APIエラー'
      }
    }

    // 返信の公開
    const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`
    
    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: data.id
    })

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams.toString()
    })

    const publishData = await publishResponse.json()

    if (!publishResponse.ok) {
      console.error('Threads 公開エラー:', publishData)
      return {
        success: false,
        error: publishData.error?.message || '返信の公開に失敗しました'
      }
    }

    return {
      success: true,
      replyId: publishData.id
    }

  } catch (error) {
    console.error('Threads API呼び出しエラー:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Threads API呼び出しエラー'
    }
  }
}