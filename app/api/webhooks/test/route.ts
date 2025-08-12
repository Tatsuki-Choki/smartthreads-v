import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const webhookSecret = process.env.THREADS_WEBHOOK_SECRET || 'default_secret';

// POST: テスト用Webhookシミュレータ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // テストデータのバリデーション
    if (!body.test_comment || !body.threads_post_id || !body.threads_account_id) {
      return NextResponse.json(
        { 
          error: '必須パラメータが不足しています',
          required: ['test_comment', 'threads_post_id', 'threads_account_id']
        },
        { status: 400 }
      );
    }

    // Threadsからのコメントペイロードを模擬
    const mockPayload = {
      entry: [
        {
          id: body.threads_account_id, // Threadsアカウント識別子
          time: Math.floor(Date.now() / 1000),
          changes: [
            {
              field: 'comments',
              value: {
                id: `test_comment_${Date.now()}`,
                text: body.test_comment,
                from: {
                  id: body.test_user_id || 'test_user_123',
                  username: body.test_username || 'testuser',
                  name: body.test_display_name || 'テストユーザー',
                  profile_picture_url: 'https://example.com/profile.jpg'
                },
                media: {
                  id: body.threads_post_id
                },
                parent_id: body.parent_comment_id || null,
                timestamp: new Date().toISOString(),
                created_time: Math.floor(Date.now() / 1000)
              }
            }
          ]
        }
      ],
      object: 'threads'
    };

    // ペイロードをJSON文字列化
    const payloadString = JSON.stringify(mockPayload);

    // 署名を生成（実際のWebhookと同じ形式）
    const signature = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    console.log('テストWebhook送信:', {
      comment: body.test_comment,
      post_id: body.threads_post_id,
      account_id: body.threads_account_id
    });

    // 実際のWebhookエンドポイントを呼び出し
    const webhookUrl = new URL('/api/webhooks/threads', request.url);
    const response = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: payloadString
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook処理失敗: ${errorText}`);
    }

    const result = await response.json();

    // テスト結果を返す
    return NextResponse.json({
      success: true,
      message: 'テストWebhookを送信しました',
      test_data: {
        comment_id: mockPayload.entry[0].changes[0].value.id,
        comment_text: body.test_comment,
        post_id: body.threads_post_id,
        account_id: body.threads_account_id,
        username: mockPayload.entry[0].changes[0].value.from.username
      },
      webhook_response: result,
      payload_sent: mockPayload
    });

  } catch (error) {
    console.error('テストWebhookエラー:', error);
    return NextResponse.json(
      { 
        error: 'テストWebhook送信失敗',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}