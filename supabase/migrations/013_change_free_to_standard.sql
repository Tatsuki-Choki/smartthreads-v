-- プラン名をfreeからstandardに変更
-- ============================================

-- 1. 既存のfreeプランをstandardに変更
UPDATE workspaces 
SET plan_type = 'standard' 
WHERE plan_type = 'free';

-- 2. チェック制約を更新
ALTER TABLE workspaces 
DROP CONSTRAINT IF EXISTS workspaces_plan_type_check;

ALTER TABLE workspaces 
ADD CONSTRAINT workspaces_plan_type_check 
CHECK (plan_type IN ('standard', 'vip', 'ultra_vip'));

-- 3. デフォルト値を変更
ALTER TABLE workspaces 
ALTER COLUMN plan_type SET DEFAULT 'standard';

-- 4. max_threads_accountsのデフォルト値も更新（standardプラン用）
ALTER TABLE workspaces 
ALTER COLUMN max_threads_accounts SET DEFAULT 3;

-- 5. 関数内の参照も更新
CREATE OR REPLACE FUNCTION upgrade_workspace_to_vip(
    p_workspace_id UUID,
    p_admin_user_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_max_accounts INTEGER
) AS $$
DECLARE
    v_current_plan TEXT;
    v_current_max INTEGER;
BEGIN
    -- 現在のプランを取得
    SELECT plan_type, max_threads_accounts 
    INTO v_current_plan, v_current_max
    FROM workspaces
    WHERE id = p_workspace_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'ワークスペースが見つかりません'::TEXT, 0;
        RETURN;
    END IF;
    
    -- プランをVIPに更新
    UPDATE workspaces
    SET 
        plan_type = 'vip',
        max_threads_accounts = 10,
        plan_expires_at = p_expires_at,
        plan_notes = p_reason,
        updated_at = NOW()
    WHERE id = p_workspace_id;
    
    -- 履歴を記録
    INSERT INTO workspace_plan_history (
        workspace_id,
        previous_plan,
        new_plan,
        previous_max_accounts,
        new_max_accounts,
        changed_by,
        change_reason
    ) VALUES (
        p_workspace_id,
        v_current_plan,
        'vip',
        v_current_max,
        10,
        p_admin_user_id,
        p_reason
    );
    
    RETURN QUERY SELECT true, 'VIPプランにアップグレードしました'::TEXT, 10;
END;
$$ LANGUAGE plpgsql;

-- 6. ダウングレード関数も更新
CREATE OR REPLACE FUNCTION downgrade_workspace_to_standard(
    p_workspace_id UUID,
    p_admin_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_max_accounts INTEGER,
    accounts_to_disable INTEGER
) AS $$
DECLARE
    v_current_plan TEXT;
    v_current_max INTEGER;
    v_active_accounts INTEGER;
BEGIN
    -- 現在のプランとアクティブアカウント数を取得
    SELECT 
        w.plan_type, 
        w.max_threads_accounts,
        COUNT(ta.id) FILTER (WHERE ta.is_active = true)
    INTO v_current_plan, v_current_max, v_active_accounts
    FROM workspaces w
    LEFT JOIN threads_accounts ta ON w.id = ta.workspace_id
    WHERE w.id = p_workspace_id
    GROUP BY w.plan_type, w.max_threads_accounts;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'ワークスペースが見つかりません'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- プランをスタンダードに更新
    UPDATE workspaces
    SET 
        plan_type = 'standard',
        max_threads_accounts = 3,
        plan_expires_at = NULL,
        plan_notes = p_reason,
        updated_at = NOW()
    WHERE id = p_workspace_id;
    
    -- 履歴を記録
    INSERT INTO workspace_plan_history (
        workspace_id,
        previous_plan,
        new_plan,
        previous_max_accounts,
        new_max_accounts,
        changed_by,
        change_reason
    ) VALUES (
        p_workspace_id,
        v_current_plan,
        'standard',
        v_current_max,
        3,
        p_admin_user_id,
        p_reason
    );
    
    -- アクティブアカウントが3個を超えている場合の警告
    IF v_active_accounts > 3 THEN
        RETURN QUERY SELECT 
            true, 
            format('スタンダードプランにダウングレードしました。%s個のアカウントを無効化する必要があります', v_active_accounts - 3)::TEXT,
            3,
            v_active_accounts - 3;
    ELSE
        RETURN QUERY SELECT true, 'スタンダードプランにダウングレードしました'::TEXT, 3, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. 期限切れチェック関数も更新
CREATE OR REPLACE FUNCTION check_expired_vip_plans()
RETURNS TABLE(
    workspace_id UUID,
    workspace_name TEXT,
    expired_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- 期限切れのVIPプランを自動的にスタンダードプランに戻す
    UPDATE workspaces
    SET 
        plan_type = 'standard',
        max_threads_accounts = 3,
        updated_at = NOW()
    WHERE 
        plan_type = 'vip' 
        AND plan_expires_at IS NOT NULL 
        AND plan_expires_at < NOW();
    
    -- 期限切れワークスペースのリストを返す
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.plan_expires_at
    FROM workspaces w
    WHERE 
        w.plan_type = 'vip' 
        AND w.plan_expires_at IS NOT NULL 
        AND w.plan_expires_at < NOW() + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 8. ultraVIPプランへのアップグレード関数
CREATE OR REPLACE FUNCTION upgrade_workspace_to_ultra_vip(
    p_workspace_id UUID,
    p_admin_user_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_max_accounts INTEGER
) AS $$
DECLARE
    v_current_plan TEXT;
    v_current_max INTEGER;
BEGIN
    -- 現在のプランを取得
    SELECT plan_type, max_threads_accounts 
    INTO v_current_plan, v_current_max
    FROM workspaces
    WHERE id = p_workspace_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'ワークスペースが見つかりません'::TEXT, 0;
        RETURN;
    END IF;
    
    -- プランをultraVIPに更新
    UPDATE workspaces
    SET 
        plan_type = 'ultra_vip',
        max_threads_accounts = 20,
        plan_expires_at = p_expires_at,
        plan_notes = p_reason,
        updated_at = NOW()
    WHERE id = p_workspace_id;
    
    -- 履歴を記録
    INSERT INTO workspace_plan_history (
        workspace_id,
        previous_plan,
        new_plan,
        previous_max_accounts,
        new_max_accounts,
        changed_by,
        change_reason
    ) VALUES (
        p_workspace_id,
        v_current_plan,
        'ultra_vip',
        v_current_max,
        20,
        p_admin_user_id,
        p_reason
    );
    
    RETURN QUERY SELECT true, 'UltraVIPプランにアップグレードしました'::TEXT, 20;
END;
$$ LANGUAGE plpgsql;

-- 9. プラン判定用のヘルパー関数
CREATE OR REPLACE FUNCTION get_plan_max_accounts(p_plan_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE p_plan_type
        WHEN 'standard' THEN 3
        WHEN 'vip' THEN 10
        WHEN 'ultra_vip' THEN 20
        ELSE 3
    END;
END;
$$ LANGUAGE plpgsql;

-- 10. 期限切れチェック関数を更新（ultra_vipも含める）
CREATE OR REPLACE FUNCTION check_expired_vip_plans()
RETURNS TABLE(
    workspace_id UUID,
    workspace_name TEXT,
    expired_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- 期限切れのVIP/UltraVIPプランを自動的にスタンダードプランに戻す
    UPDATE workspaces
    SET 
        plan_type = 'standard',
        max_threads_accounts = 3,
        updated_at = NOW()
    WHERE 
        plan_type IN ('vip', 'ultra_vip')
        AND plan_expires_at IS NOT NULL 
        AND plan_expires_at < NOW();
    
    -- 期限切れワークスペースのリストを返す
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.plan_expires_at
    FROM workspaces w
    WHERE 
        w.plan_type IN ('vip', 'ultra_vip')
        AND w.plan_expires_at IS NOT NULL 
        AND w.plan_expires_at < NOW() + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 11. 古いdowngrade_workspace_to_free関数を削除（存在する場合）
DROP FUNCTION IF EXISTS downgrade_workspace_to_free(UUID, UUID, TEXT);