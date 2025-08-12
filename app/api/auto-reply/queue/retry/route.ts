import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    const { itemId } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'アイテムIDが必要です' },
        { status: 400 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // キューアイテムを取得（ワークスペースの所有権を確認）
    const { data: queueItem, error: fetchError } = await supabase
      .from('reply_queue')
      .select('*')
      .eq('id', itemId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !queueItem) {
      return NextResponse.json(
        { error: 'キューアイテムが見つかりません' },
        { status: 404 }
      );
    }

    // 失敗したアイテムのみリトライ可能
    if (queueItem.status !== 'failed') {
      return NextResponse.json(
        { error: '失敗したアイテムのみリトライ可能です' },
        { status: 400 }
      );
    }

    // リトライ回数の上限チェック
    if (queueItem.retry_count >= 3) {
      return NextResponse.json(
        { error: 'リトライ回数の上限に達しています' },
        { status: 400 }
      );
    }

    // リトライ用に更新
    const { error: updateError } = await supabase
      .from('reply_queue')
      .update({
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('リトライ設定エラー:', updateError);
      return NextResponse.json(
        { error: 'リトライの設定に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'リトライをスケジュールしました'
    });

  } catch (error) {
    console.error('リトライAPIエラー:', error);
    return NextResponse.json(
      { error: 'リトライ処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}