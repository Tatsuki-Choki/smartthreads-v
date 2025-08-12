import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { withApiHandler, ApiError } from '@/lib/api/middleware';

// 管理者用：ワークスペースのプラン管理
export async function GET(req: NextRequest) {
  return withApiHandler(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('認証が必要です', 401);
    }

    // システム管理者権限チェック
    const { data: isAdmin } = await supabase
      .rpc('is_system_admin', { p_user_id: user.id });

    if (!isAdmin) {
      throw new ApiError('管理者権限が必要です', 403);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const planType = searchParams.get('plan_type') || '';

    let query = supabase
      .from('v_workspace_plan_status')
      .select('*');

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (planType && ['standard', 'vip', 'ultra_vip'].includes(planType)) {
      query = query.eq('plan_type', planType);
    }

    const { data: workspaces, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      throw new ApiError('ワークスペースの取得に失敗しました', 500);
    }

    // 統計情報も取得
    const { data: stats } = await supabase
      .from('v_workspace_plan_status')
      .select('plan_type');

    const planCounts = stats?.reduce((acc, workspace) => {
      acc[workspace.plan_type] = (acc[workspace.plan_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      success: true,
      data: {
        workspaces,
        stats: {
          total: workspaces?.length || 0,
          standard: planCounts['standard'] || 0,
          vip: planCounts['vip'] || 0,
          ultra_vip: planCounts['ultra_vip'] || 0
        }
      }
    });
  }, {
    requireAuth: true,
    successEvent: 'api_success',
    eventTitle: '管理者プラン一覧取得'
  });
}

// ワークスペースのプラン変更
export async function PUT(req: NextRequest) {
  return withApiHandler(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('認証が必要です', 401);
    }

    // システム管理者権限チェック
    const { data: isAdmin } = await supabase
      .rpc('is_system_admin', { p_user_id: user.id });

    if (!isAdmin) {
      throw new ApiError('管理者権限が必要です', 403);
    }

    const body = await req.json();
    const { 
      workspace_id, 
      action, 
      reason, 
      expires_at 
    } = body;

    if (!workspace_id || !action) {
      throw new ApiError('必要なパラメータが不足しています', 400);
    }

    let result;
    
    if (action === 'upgrade_to_vip') {
      const { data, error } = await supabase
        .rpc('upgrade_workspace_to_vip', {
          p_workspace_id: workspace_id,
          p_admin_user_id: user.id,
          p_reason: reason,
          p_expires_at: expires_at
        })
        .single();

      if (error) {
        throw new ApiError('VIPプランへのアップグレードに失敗しました', 500);
      }
      result = data;
    } else if (action === 'upgrade_to_ultra_vip') {
      const { data, error } = await supabase
        .rpc('upgrade_workspace_to_ultra_vip', {
          p_workspace_id: workspace_id,
          p_admin_user_id: user.id,
          p_reason: reason,
          p_expires_at: expires_at
        })
        .single();

      if (error) {
        throw new ApiError('UltraVIPプランへのアップグレードに失敗しました', 500);
      }
      result = data;
    } else if (action === 'downgrade_to_standard') {
      const { data, error } = await supabase
        .rpc('downgrade_workspace_to_standard', {
          p_workspace_id: workspace_id,
          p_admin_user_id: user.id,
          p_reason: reason
        })
        .single();

      if (error) {
        throw new ApiError('スタンダードプランへのダウングレードに失敗しました', 500);
      }
      result = data;
    } else {
      throw new ApiError('無効なアクションです', 400);
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'プランを変更しました'
    });
  }, {
    requireAuth: true,
    successEvent: 'api_success',
    eventTitle: 'ワークスペースプラン変更'
  });
}

// プラン変更履歴の取得
export async function POST(req: NextRequest) {
  return withApiHandler(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('認証が必要です', 401);
    }

    // システム管理者権限チェック
    const { data: isAdmin } = await supabase
      .rpc('is_system_admin', { p_user_id: user.id });

    if (!isAdmin) {
      throw new ApiError('管理者権限が必要です', 403);
    }

    const body = await req.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      throw new ApiError('ワークスペースIDが必要です', 400);
    }

    const { data: history, error } = await supabase
      .from('workspace_plan_history')
      .select(`
        *,
        changed_by_user:auth.users!changed_by(email)
      `)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ApiError('履歴の取得に失敗しました', 500);
    }

    return NextResponse.json({
      success: true,
      data: history
    });
  }, {
    requireAuth: true,
    successEvent: 'api_success',
    eventTitle: 'プラン変更履歴取得'
  });
}