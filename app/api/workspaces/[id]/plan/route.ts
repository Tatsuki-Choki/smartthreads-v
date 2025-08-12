import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { withApiHandler, ApiError } from '@/lib/api/middleware';

// ワークスペースのプラン情報を取得
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('認証が必要です', 401);
    }

    // ワークスペースのプラン情報を取得
    const { data: workspace, error } = await supabase
      .from('v_workspace_plan_status')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !workspace) {
      throw new ApiError('ワークスペースが見つかりません', 404);
    }

    // アクセス権限チェック
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!membership && workspace.owner_id !== user.id) {
      throw new ApiError('このワークスペースへのアクセス権限がありません', 403);
    }

    return NextResponse.json({
      success: true,
      data: workspace
    });
  }, {
    requireAuth: true,
    successEvent: 'api_success',
    eventTitle: 'ワークスペースプラン情報取得'
  });
}

// アカウント上限チェック（新しいアカウント追加前の確認用）
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('認証が必要です', 401);
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'check_account_limit') {
      // ワークスペースのプラン状況を確認
      const { data: planStatus, error } = await supabase
        .from('v_workspace_plan_status')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !planStatus) {
        throw new ApiError('ワークスペースが見つかりません', 404);
      }

      const canAddAccount = planStatus.remaining_slots > 0;
      const needsUpgrade = !canAddAccount && planStatus.plan_type === 'free';

      return NextResponse.json({
        success: true,
        data: {
          can_add_account: canAddAccount,
          needs_upgrade: needsUpgrade,
          plan_type: planStatus.plan_type,
          active_accounts: planStatus.active_accounts_count,
          max_accounts: planStatus.max_threads_accounts,
          remaining_slots: planStatus.remaining_slots
        }
      });
    }

    throw new ApiError('無効なアクションです', 400);
  }, {
    requireAuth: true,
    successEvent: 'api_success',
    eventTitle: 'アカウント上限チェック'
  });
}