import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST: ルールテスト実行
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const workspaceId = request.headers.get('x-workspace-id');

    if (!authHeader || !workspaceId) {
      return NextResponse.json(
        { error: '認証情報またはワークスペースIDが不足しています' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const body = await request.json();

    // 必須フィールドの検証
    if (!body.test_comment) {
      return NextResponse.json(
        { error: 'テスト用コメントが必要です' },
        { status: 400 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // アクティブなルールを優先度順で取得
    let query = supabase
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

    // 特定のルールIDが指定されている場合
    if (body.rule_id) {
      query = query.eq('id', body.rule_id);
    }

    const { data: rules, error } = await query;

    if (error) {
      console.error('ルール取得エラー:', error);
      return NextResponse.json(
        { error: 'ルールの取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json(
        { 
          matched: false,
          message: 'アクティブなルールが見つかりません',
          test_comment: body.test_comment
        }
      );
    }

    // コメントをキーワードマッチング関数でテスト
    for (const rule of rules) {
      // Supabaseの関数を呼び出してマッチングをテスト
      const { data: matchResult, error: matchError } = await supabase
        .rpc('check_keyword_match', {
          p_content: body.test_comment,
          p_keywords: rule.trigger_keywords,
          p_exclude_keywords: rule.exclude_keywords,
          p_match_mode: rule.match_mode
        });

      if (matchError) {
        console.error('マッチング関数エラー:', matchError);
        continue;
      }

      if (matchResult) {
        // テンプレートを使用する場合
        let replyContent = rule.reply_content;
        
        if (rule.reply_template_id && rule.reply_templates) {
          replyContent = rule.reply_templates.content;
        }

        // 変数置換（簡易版 - 実際の実装では更に詳細に）
        replyContent = replyContent.replace('{{username}}', body.test_username || 'テストユーザー');
        replyContent = replyContent.replace('{{comment}}', body.test_comment);

        return NextResponse.json({
          matched: true,
          matched_rule: {
            id: rule.id,
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            match_mode: rule.match_mode,
            trigger_keywords: rule.trigger_keywords,
            exclude_keywords: rule.exclude_keywords
          },
          reply_content: replyContent,
          reply_delay_seconds: rule.reply_delay_seconds,
          test_comment: body.test_comment,
          test_username: body.test_username || 'テストユーザー'
        });
      }
    }

    // どのルールにもマッチしなかった場合
    return NextResponse.json({
      matched: false,
      message: 'どのルールにもマッチしませんでした',
      test_comment: body.test_comment,
      tested_rules_count: rules.length
    });

  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}