import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: テンプレート一覧取得
export async function GET(request: NextRequest) {
  try {
    // ヘッダーから認証情報とワークスペースIDを取得
    const authHeader = request.headers.get('authorization');
    const workspaceId = request.headers.get('x-workspace-id');

    if (!authHeader || !workspaceId) {
      return NextResponse.json(
        { error: '認証情報またはワークスペースIDが不足しています' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Supabaseクライアント作成（ユーザートークンで）
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

    // テンプレート一覧を取得
    const { data: templates, error } = await supabase
      .from('reply_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('テンプレート取得エラー:', error);
      return NextResponse.json(
        { error: 'テンプレートの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST: テンプレート作成
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
    if (!body.name || !body.content) {
      return NextResponse.json(
        { error: 'テンプレート名と内容は必須です' },
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

    // テンプレートを作成
    const { data: template, error } = await supabase
      .from('reply_templates')
      .insert({
        workspace_id: workspaceId,
        name: body.name,
        description: body.description || null,
        content: body.content,
        variables: body.variables || {},
        media_urls: body.media_urls || [],
        is_active: body.is_active !== undefined ? body.is_active : true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('テンプレート作成エラー:', error);
      return NextResponse.json(
        { error: 'テンプレートの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// PUT: テンプレート更新
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
        { error: 'テンプレートIDが必要です' },
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
    if (body.content !== undefined) updateData.content = body.content;
    if (body.variables !== undefined) updateData.variables = body.variables;
    if (body.media_urls !== undefined) updateData.media_urls = body.media_urls;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // テンプレートを更新
    const { data: template, error } = await supabase
      .from('reply_templates')
      .update(updateData)
      .eq('id', body.id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('テンプレート更新エラー:', error);
      return NextResponse.json(
        { error: 'テンプレートの更新に失敗しました' },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// DELETE: テンプレート削除
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const workspaceId = request.headers.get('x-workspace-id');
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!authHeader || !workspaceId) {
      return NextResponse.json(
        { error: '認証情報またはワークスペースIDが不足しています' },
        { status: 401 }
      );
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'テンプレートIDが必要です' },
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

    // テンプレートを削除
    const { error } = await supabase
      .from('reply_templates')
      .delete()
      .eq('id', templateId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('テンプレート削除エラー:', error);
      return NextResponse.json(
        { error: 'テンプレートの削除に失敗しました' },
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