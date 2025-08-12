import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// アカウント統計の取得
export async function GET(req: NextRequest) {
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

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // アカウント一覧を取得
    const { data: accounts, error: accountsError } = await supabase
      .from('threads_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (accountsError) {
      throw accountsError;
    }

    // 各アカウントの統計情報を取得
    const accountsWithStats = await Promise.all(
      (accounts || []).map(async (account) => {
        // 統計情報を取得
        const { data: stats } = await supabase
          .from('account_usage_stats')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('account_id', account.id)
          .single();

        // 本日の返信数をリセット（日付が変わった場合）
        if (stats && stats.last_reply_at) {
          const lastReplyDate = new Date(stats.last_reply_at).toDateString();
          const today = new Date().toDateString();
          
          if (lastReplyDate !== today) {
            stats.replies_today = 0;
          }
        }

        // 直近1時間の返信数を計算
        if (stats && stats.last_reply_at) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const lastReply = new Date(stats.last_reply_at);
          
          if (lastReply < oneHourAgo) {
            stats.replies_this_hour = 0;
          }
        }

        return {
          ...account,
          stats: stats || {
            total_replies: 0,
            replies_today: 0,
            replies_this_hour: 0,
            last_reply_at: null
          }
        };
      })
    );

    return NextResponse.json({
      accounts: accountsWithStats,
      totalAccounts: accounts?.length || 0
    });

  } catch (error) {
    console.error('アカウント統計取得エラー:', error);
    return NextResponse.json(
      { error: 'アカウント統計の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// アカウントローテーション設定の更新
export async function PUT(req: NextRequest) {
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

    const { ruleId, accountIds, rotationMode } = await req.json();

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // ルールが存在し、ワークスペースに属していることを確認
    const { data: rule, error: ruleError } = await supabase
      .from('auto_reply_rules')
      .select('id')
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json(
        { error: 'ルールが見つかりません' },
        { status: 404 }
      );
    }

    // アカウントがすべてワークスペースに属していることを確認
    if (accountIds && accountIds.length > 0) {
      const { data: validAccounts, error: accountError } = await supabase
        .from('threads_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .in('id', accountIds);

      if (accountError || validAccounts?.length !== accountIds.length) {
        return NextResponse.json(
          { error: '無効なアカウントが含まれています' },
          { status: 400 }
        );
      }
    }

    // ルールを更新
    const { error: updateError } = await supabase
      .from('auto_reply_rules')
      .update({
        account_ids: accountIds || [],
        rotation_mode: rotationMode || 'random',
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'アカウント設定を更新しました'
    });

  } catch (error) {
    console.error('アカウント設定更新エラー:', error);
    return NextResponse.json(
      { error: 'アカウント設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// アカウント使用統計のリセット
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

    const { accountId, resetType } = await req.json();

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // アカウントがワークスペースに属していることを確認
    const { data: account, error: accountError } = await supabase
      .from('threads_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('workspace_id', workspaceId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'アカウントが見つかりません' },
        { status: 404 }
      );
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (resetType) {
      case 'hourly':
        updateData.replies_this_hour = 0;
        break;
      case 'daily':
        updateData.replies_today = 0;
        updateData.replies_this_hour = 0;
        break;
      case 'all':
        updateData.total_replies = 0;
        updateData.replies_today = 0;
        updateData.replies_this_hour = 0;
        updateData.last_reply_at = null;
        break;
      default:
        return NextResponse.json(
          { error: '無効なリセットタイプです' },
          { status: 400 }
        );
    }

    // 統計をリセット
    const { error: updateError } = await supabase
      .from('account_usage_stats')
      .update(updateData)
      .eq('workspace_id', workspaceId)
      .eq('account_id', accountId);

    if (updateError && updateError.code !== 'PGRST116') {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: `統計をリセットしました（${resetType}）`
    });

  } catch (error) {
    console.error('統計リセットエラー:', error);
    return NextResponse.json(
      { error: '統計のリセットに失敗しました' },
      { status: 500 }
    );
  }
}