import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Cronジョブ: 予約投稿の自動送信
 * Vercel Cronから5分ごとに実行される
 */
export async function GET(request: NextRequest) {
  console.log('=== 予約投稿Cronジョブ開始 ===')
  
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
      published: 0,
      failed: 0,
      errors: [] as any[]
    }

    // 送信予定の投稿を取得（現在時刻を過ぎた予約投稿）
    const { data: scheduledPosts, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        threads_accounts (
          id,
          username,
          threads_user_id,
          access_token
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10) // 一度に処理する最大数

    if (fetchError) {
      console.error('予約投稿の取得エラー:', fetchError)
      return NextResponse.json({ 
        error: '予約投稿の取得に失敗しました',
        details: fetchError 
      }, { status: 500 })
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log('送信予定の投稿はありません')
      return NextResponse.json({ 
        message: '送信予定の投稿はありません',
        results 
      })
    }

    console.log(`${scheduledPosts.length}件の予約投稿を処理します`)

    // 各投稿を処理
    for (const post of scheduledPosts) {
      results.processed++
      
      try {
        // アクセストークンの復号化（必要に応じて実装）
        const accessToken = post.threads_accounts?.access_token
        
        if (!accessToken) {
          throw new Error('アクセストークンが見つかりません')
        }

        // Threads APIへの投稿処理
        const publishResult = await publishToThreads(post, accessToken)

        if (publishResult.success) {
          // 投稿成功
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'published',
              published_at: now.toISOString(),
              threads_post_id: publishResult.postId,
              updated_at: now.toISOString()
            })
            .eq('id', post.id)

          results.published++
          console.log(`投稿成功: ${post.id} -> Threads ID: ${publishResult.postId}`)
        } else {
          // 投稿失敗
          await supabaseAdmin
            .from('posts')
            .update({
              status: 'failed',
              error_message: publishResult.error,
              updated_at: now.toISOString()
            })
            .eq('id', post.id)

          results.failed++
          results.errors.push({
            postId: post.id,
            error: publishResult.error
          })
          console.error(`投稿失敗: ${post.id}`, publishResult.error)
        }
      } catch (error) {
        // エラー処理
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        await supabaseAdmin
          .from('posts')
          .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: now.toISOString()
          })
          .eq('id', post.id)

        results.failed++
        results.errors.push({
          postId: post.id,
          error: errorMessage
        })
        console.error(`投稿処理エラー: ${post.id}`, error)
      }

      // レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('=== 予約投稿Cronジョブ完了 ===', results)

    return NextResponse.json({
      message: '予約投稿の処理が完了しました',
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
 * Threads APIに投稿を送信
 */
async function publishToThreads(
  post: any,
  accessToken: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log(`Threads APIへの投稿開始: ${post.id}`)
    
    // メディアコンテナの作成（画像/動画がある場合）
    let mediaContainerId: string | null = null
    
    if (post.media_type !== 'TEXT' && post.media_urls?.length > 0) {
      // メディアコンテナ作成
      const mediaResponse = await createMediaContainer(
        post.threads_accounts.threads_user_id,
        accessToken,
        post.media_type,
        post.media_urls[0], // 最初のメディアURLを使用
        post.content
      )
      
      if (!mediaResponse.success) {
        return { success: false, error: mediaResponse.error }
      }
      
      mediaContainerId = mediaResponse.containerId || null
      
      // メディアのアップロード完了を待つ
      await waitForMediaProcessing(mediaContainerId!, accessToken)
    }

    // 投稿の作成
    const createUrl = `https://graph.threads.net/v1.0/${post.threads_accounts.threads_user_id}/threads`
    
    const params = new URLSearchParams({
      access_token: accessToken
    })

    if (mediaContainerId) {
      // メディア付き投稿
      params.append('media_container_id', mediaContainerId)
    } else {
      // テキストのみの投稿
      params.append('text', post.content)
      params.append('media_type', 'TEXT')
    }

    const response = await fetch(createUrl, {
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

    // 投稿の公開
    const publishUrl = `https://graph.threads.net/v1.0/${post.threads_accounts.threads_user_id}/threads_publish`
    
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
        error: publishData.error?.message || '投稿の公開に失敗しました'
      }
    }

    return {
      success: true,
      postId: publishData.id
    }

  } catch (error) {
    console.error('Threads API呼び出しエラー:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Threads API呼び出しエラー'
    }
  }
}

/**
 * メディアコンテナの作成
 */
async function createMediaContainer(
  userId: string,
  accessToken: string,
  mediaType: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  try {
    const url = `https://graph.threads.net/v1.0/${userId}/threads`
    
    const params = new URLSearchParams({
      access_token: accessToken,
      media_type: mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE'
    })

    if (mediaType === 'IMAGE') {
      params.append('image_url', mediaUrl)
    } else if (mediaType === 'VIDEO') {
      params.append('video_url', mediaUrl)
    }

    if (caption) {
      params.append('text', caption)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'メディアコンテナの作成に失敗しました'
      }
    }

    return {
      success: true,
      containerId: data.id
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'メディアコンテナ作成エラー'
    }
  }
}

/**
 * メディア処理の完了を待つ
 */
async function waitForMediaProcessing(
  containerId: string,
  accessToken: string,
  maxAttempts: number = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const url = `https://graph.threads.net/v1.0/${containerId}?fields=status&access_token=${accessToken}`
    
    try {
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'FINISHED') {
        return true
      } else if (data.status === 'ERROR') {
        console.error('メディア処理エラー:', data)
        return false
      }
      
      // 2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error('メディアステータス確認エラー:', error)
      return false
    }
  }
  
  console.error('メディア処理タイムアウト')
  return false
}