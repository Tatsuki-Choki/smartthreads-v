import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// 返信プール一覧取得
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

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('ruleId');

    let query = supabase
      .from('reply_pools')
      .select(`
        *,
        auto_reply_rules (
          id,
          name
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('weight', { ascending: false });

    if (ruleId) {
      query = query.eq('rule_id', ruleId);
    }

    const { data: pools, error } = await query;

    if (error) {
      console.error('返信プール取得エラー:', error);
      return NextResponse.json(
        { error: '返信プールの取得に失敗しました' },
        { status: 500 }
      );
    }

    // ルールごとにグループ化
    const poolsByRule: Record<string, any[]> = {};
    pools?.forEach(pool => {
      const ruleId = pool.rule_id;
      if (!poolsByRule[ruleId]) {
        poolsByRule[ruleId] = [];
      }
      poolsByRule[ruleId].push(pool);
    });

    // 各ルールの総重みを計算
    Object.keys(poolsByRule).forEach(ruleId => {
      const totalWeight = poolsByRule[ruleId].reduce((sum, pool) => sum + (pool.weight || 0), 0);
      poolsByRule[ruleId].forEach(pool => {
        pool.weightPercentage = totalWeight > 0 ? ((pool.weight || 0) / totalWeight) * 100 : 0;
      });
    });

    return NextResponse.json({
      pools: pools || [],
      poolsByRule,
      total: pools?.length || 0
    });

  } catch (error) {
    console.error('返信プール取得エラー:', error);
    return NextResponse.json(
      { error: '返信プール取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 返信プール作成
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

    const body = await req.json();
    const {
      ruleId,
      content,
      weight = 10,
      mediaUrls,
      mediaType = 'TEXT'
    } = body;

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // 必須フィールドチェック
    if (!ruleId || !content) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // ルールが存在し、ワークスペースに属していることを確認
    const { data: rule, error: ruleError } = await supabase
      .from('auto_reply_rules')
      .select('id, use_random_reply')
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json(
        { error: 'ルールが見つかりません' },
        { status: 404 }
      );
    }

    // 返信プールを作成
    const { data: pool, error } = await supabase
      .from('reply_pools')
      .insert({
        workspace_id: workspaceId,
        rule_id: ruleId,
        content,
        weight: Math.min(100, Math.max(0, weight)),
        media_urls: mediaUrls,
        media_type: mediaType,
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('返信プール作成エラー:', error);
      return NextResponse.json(
        { error: '返信プールの作成に失敗しました' },
        { status: 500 }
      );
    }

    // ルールのランダム返信フラグを有効化
    if (!rule.use_random_reply) {
      await supabase
        .from('auto_reply_rules')
        .update({ use_random_reply: true })
        .eq('id', ruleId);
    }

    // 重みを正規化
    await supabase.rpc('normalize_reply_weights', {
      p_rule_id: ruleId
    });

    return NextResponse.json({
      success: true,
      pool
    });

  } catch (error) {
    console.error('返信プール作成エラー:', error);
    return NextResponse.json(
      { error: '返信プール作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 返信プール更新
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

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'プールIDが必要です' },
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

    // プールが存在し、ワークスペースに属していることを確認
    const { data: existingPool, error: fetchError } = await supabase
      .from('reply_pools')
      .select('id, rule_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !existingPool) {
      return NextResponse.json(
        { error: '返信プールが見つかりません' },
        { status: 404 }
      );
    }

    // 重みの範囲チェック
    if (updateData.weight !== undefined) {
      updateData.weight = Math.min(100, Math.max(0, updateData.weight));
    }

    // プールを更新
    const { data: pool, error } = await supabase
      .from('reply_pools')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('返信プール更新エラー:', error);
      return NextResponse.json(
        { error: '返信プールの更新に失敗しました' },
        { status: 500 }
      );
    }

    // 重みが変更された場合は正規化
    if (updateData.weight !== undefined) {
      await supabase.rpc('normalize_reply_weights', {
        p_rule_id: existingPool.rule_id
      });
    }

    return NextResponse.json({
      success: true,
      pool
    });

  } catch (error) {
    console.error('返信プール更新エラー:', error);
    return NextResponse.json(
      { error: '返信プール更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 返信プール削除
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const poolId = searchParams.get('id');

    if (!poolId) {
      return NextResponse.json(
        { error: 'プールIDが必要です' },
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

    // プールを取得してルールIDを取得
    const { data: pool, error: fetchError } = await supabase
      .from('reply_pools')
      .select('rule_id')
      .eq('id', poolId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !pool) {
      return NextResponse.json(
        { error: '返信プールが見つかりません' },
        { status: 404 }
      );
    }

    // プールを削除
    const { error } = await supabase
      .from('reply_pools')
      .delete()
      .eq('id', poolId);

    if (error) {
      console.error('返信プール削除エラー:', error);
      return NextResponse.json(
        { error: '返信プールの削除に失敗しました' },
        { status: 500 }
      );
    }

    // 残りのプールの重みを正規化
    await supabase.rpc('normalize_reply_weights', {
      p_rule_id: pool.rule_id
    });

    // プールがなくなった場合はルールのランダム返信フラグを無効化
    const { count } = await supabase
      .from('reply_pools')
      .select('*', { count: 'exact', head: true })
      .eq('rule_id', pool.rule_id)
      .eq('is_active', true);

    if (count === 0) {
      await supabase
        .from('auto_reply_rules')
        .update({ use_random_reply: false })
        .eq('id', pool.rule_id);
    }

    return NextResponse.json({
      success: true,
      message: '返信プールを削除しました'
    });

  } catch (error) {
    console.error('返信プール削除エラー:', error);
    return NextResponse.json(
      { error: '返信プール削除中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 重み調整エンドポイント
export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { ruleId, weights } = body; // weights: { poolId: weight }

    if (!ruleId || !weights) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
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

    // 各プールの重みを更新
    for (const [poolId, weight] of Object.entries(weights)) {
      await supabase
        .from('reply_pools')
        .update({
          weight: Math.min(100, Math.max(0, Number(weight))),
          updated_at: new Date().toISOString()
        })
        .eq('id', poolId)
        .eq('workspace_id', workspaceId);
    }

    // 重みを正規化
    await supabase.rpc('normalize_reply_weights', {
      p_rule_id: ruleId
    });

    // 更新後のプールを取得
    const { data: pools, error } = await supabase
      .from('reply_pools')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('workspace_id', workspaceId)
      .order('weight', { ascending: false });

    if (error) {
      console.error('プール取得エラー:', error);
      return NextResponse.json(
        { error: 'プールの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pools
    });

  } catch (error) {
    console.error('重み調整エラー:', error);
    return NextResponse.json(
      { error: '重み調整中にエラーが発生しました' },
      { status: 500 }
    );
  }
}