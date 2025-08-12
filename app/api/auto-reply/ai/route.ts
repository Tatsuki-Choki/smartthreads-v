import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// AI生成のためのプロンプトテンプレート
const TONE_DESCRIPTIONS = {
  friendly: 'フレンドリーで親しみやすい',
  professional: 'プロフェッショナルで丁寧な',
  casual: 'カジュアルで軽い',
  formal: 'フォーマルで礼儀正しい'
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { 
      commentContent, 
      commentAuthor,
      aiPrompt, 
      aiTone = 'friendly', 
      aiMaxLength = 280,
      variables = {}
    } = await req.json();

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // AI生成プロンプトの作成
    const systemPrompt = `あなたはThreadsの自動返信システムです。
以下の条件に従って、コメントに対する返信を生成してください：

1. トーン: ${TONE_DESCRIPTIONS[aiTone as keyof typeof TONE_DESCRIPTIONS]}口調
2. 最大文字数: ${aiMaxLength}文字以内
3. 言語: 日本語で返信
4. 禁止事項: 
   - 個人情報の要求や共有
   - 攻撃的な表現
   - スパムや宣伝的な内容
5. 必須要素:
   - 相手への感謝や共感を示す
   - 簡潔で的確な返信`;

    let userPrompt = aiPrompt || '適切な返信を生成してください。';
    
    // 変数の置換
    userPrompt = userPrompt
      .replace(/\{comment_content\}/g, commentContent)
      .replace(/\{comment_author\}/g, commentAuthor);
    
    // その他のカスタム変数を置換
    Object.entries(variables).forEach(([key, value]) => {
      userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    });

    // ここで実際のAI APIを呼び出す（例: OpenAI, Claude API等）
    // 現時点ではモックレスポンスを返す
    const generatedContent = await generateAIResponse(
      systemPrompt,
      userPrompt,
      commentContent,
      commentAuthor,
      aiTone,
      aiMaxLength
    );

    // 生成履歴を保存
    const { error: historyError } = await supabase
      .from('ai_generation_history')
      .insert({
        workspace_id: workspaceId,
        prompt: userPrompt,
        generated_content: generatedContent,
        model_used: 'mock-model', // 実際のモデル名に置き換え
        tokens_used: generatedContent.length, // 実際のトークン数に置き換え
        generation_time_ms: 100, // 実際の生成時間に置き換え
        created_by: user.id
      });

    if (historyError) {
      console.error('AI生成履歴の保存エラー:', historyError);
    }

    return NextResponse.json({
      success: true,
      generatedContent,
      metadata: {
        tone: aiTone,
        maxLength: aiMaxLength,
        actualLength: generatedContent.length
      }
    });

  } catch (error) {
    console.error('AI生成エラー:', error);
    return NextResponse.json(
      { error: 'AI生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// AI応答生成関数（モック実装）
async function generateAIResponse(
  systemPrompt: string,
  userPrompt: string,
  commentContent: string,
  commentAuthor: string,
  tone: string,
  maxLength: number
): Promise<string> {
  // 実際のAI API実装に置き換える
  // 例: OpenAI GPT, Claude API, Google Gemini等
  
  // モックレスポンスの生成
  const templates = {
    friendly: [
      `@${commentAuthor} さん、コメントありがとうございます！😊 ${commentContent.substring(0, 20)}について、とても共感します！`,
      `素敵なコメントですね！@${commentAuthor} さんのご意見、参考になります✨`,
      `@${commentAuthor} さん、ありがとうございます！お役に立てて嬉しいです🎉`
    ],
    professional: [
      `@${commentAuthor} 様、貴重なご意見をありがとうございます。${commentContent.substring(0, 20)}に関して、承知いたしました。`,
      `ご連絡ありがとうございます。@${commentAuthor} 様のご指摘を真摯に受け止めます。`,
      `@${commentAuthor} 様、コメントいただきありがとうございます。今後の参考にさせていただきます。`
    ],
    casual: [
      `@${commentAuthor} おお、いいね！${commentContent.substring(0, 15)}って感じだよね〜`,
      `まじか！@${commentAuthor} のコメント最高！`,
      `@${commentAuthor} それな！めっちゃわかる〜`
    ],
    formal: [
      `@${commentAuthor} 様、この度はコメントを賜り誠にありがとうございます。`,
      `@${commentAuthor} 様のご意見を拝読いたしました。貴重なご指摘として承ります。`,
      `@${commentAuthor} 様、お言葉を頂戴し光栄に存じます。`
    ]
  };

  const toneTemplates = templates[tone as keyof typeof templates] || templates.friendly;
  const response = toneTemplates[Math.floor(Math.random() * toneTemplates.length)];
  
  // 最大長を超える場合は切り詰める
  if (response.length > maxLength) {
    return response.substring(0, maxLength - 3) + '...';
  }
  
  return response;
}

// AI生成のプレビュー（テスト用）
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  // テスト用のサンプルデータ
  return NextResponse.json({
    message: 'AI生成APIエンドポイント',
    availableTones: Object.keys(TONE_DESCRIPTIONS),
    toneDescriptions: TONE_DESCRIPTIONS,
    exampleRequest: {
      commentContent: 'これは素晴らしい投稿ですね！',
      commentAuthor: 'test_user',
      aiPrompt: '@{comment_author}さんのコメント「{comment_content}」に対して感謝の返信を生成',
      aiTone: 'friendly',
      aiMaxLength: 280
    }
  });
}