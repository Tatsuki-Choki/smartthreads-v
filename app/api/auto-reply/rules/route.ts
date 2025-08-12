import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: ルール一覧取得
export async function GET(request: NextRequest) {
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

    // ルール一覧を優先度順で取得
    const { data: rules, error } = await supabase
      .from('auto_reply_rules')
      .select(`
        *,
        reply_templates (
          id,
          name,
          content
        ),
        threads_accounts (
          id,
          username,
          display_name
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ルール取得エラー:', error);
      return NextResponse.json(
        { error: 'ルールの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST: ルール作成
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
    if (!body.name || !body.threads_account_id || !body.trigger_keywords || !body.reply_content) {
      return NextResponse.json(
        { error: 'ルール名、アカウントID、トリガーキーワード、返信内容は必須です' },
        { status: 400 }
      );
    }

    // trigger_keywordsが配列であることを確認
    if (!Array.isArray(body.trigger_keywords) || body.trigger_keywords.length === 0) {
      return NextResponse.json(
        { error: 'トリガーキーワードは配列で1つ以上必要です' },
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

    // ユーザー情報を取得
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 最大優先度を取得
    const { data: maxPriorityRule } = await supabase
      .from('auto_reply_rules')
      .select('priority')
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    const newPriority = maxPriorityRule ? maxPriorityRule.priority + 1 : 1;

    // ルールを作成
    const { data: rule, error } = await supabase
      .from('auto_reply_rules')
      .insert({
        workspace_id: workspaceId,
        threads_account_id: body.threads_account_id,
        name: body.name,
        description: body.description || null,
        trigger_keywords: body.trigger_keywords,
        exclude_keywords: body.exclude_keywords || [],
        match_mode: body.match_mode || 'any',
        reply_template_id: body.reply_template_id || null,
        reply_content: body.reply_content,
        reply_delay_seconds: body.reply_delay_seconds || 0,
        max_replies_per_hour: body.max_replies_per_hour || 10,
        max_replies_per_user: body.max_replies_per_user || 3,
        is_active: body.is_active !== undefined ? body.is_active : true,
        priority: body.priority !== undefined ? body.priority : newPriority,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('ルール作成エラー:', error);
      return NextResponse.json(
        { error: 'ルールの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// PUT: ルール更新
export async function PUT(request: NextRequest) {
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

    if (!body.id) {
      return NextResponse.json(
        { error: 'ルールIDが必要です' },
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

    // 更新データを準備
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.threads_account_id !== undefined) updateData.threads_account_id = body.threads_account_id;
    if (body.trigger_keywords !== undefined) updateData.trigger_keywords = body.trigger_keywords;
    if (body.exclude_keywords !== undefined) updateData.exclude_keywords = body.exclude_keywords;
    if (body.match_mode !== undefined) updateData.match_mode = body.match_mode;
    if (body.reply_template_id !== undefined) updateData.reply_template_id = body.reply_template_id;
    if (body.reply_content !== undefined) updateData.reply_content = body.reply_content;
    if (body.reply_delay_seconds !== undefined) updateData.reply_delay_seconds = body.reply_delay_seconds;
    if (body.max_replies_per_hour !== undefined) updateData.max_replies_per_hour = body.max_replies_per_hour;
    if (body.max_replies_per_user !== undefined) updateData.max_replies_per_user = body.max_replies_per_user;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.priority !== undefined) updateData.priority = body.priority;

    // ルールを更新
    const { data: rule, error } = await supabase
      .from('auto_reply_rules')
      .update(updateData)
      .eq('id', body.id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('ルール更新エラー:', error);
      return NextResponse.json(
        { error: 'ルールの更新に失敗しました' },
        { status: 500 }
      );
    }

    if (!rule) {
      return NextResponse.json(
        { error: 'ルールが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// DELETE: ルール削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const workspaceId = request.headers.get('x-workspace-id');
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!authHeader || !workspaceId) {
      return NextResponse.json(
        { error: '認証情報またはワークスペースIDが不足しています' },
        { status: 401 }
      );
    }

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ルールIDが必要です' },
        { status: 400 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

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

    // ルールを削除
    const { error } = await supabase
      .from('auto_reply_rules')
      .delete()
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('ルール削除エラー:', error);
      return NextResponse.json(
        { error: 'ルールの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}