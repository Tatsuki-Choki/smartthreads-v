-- ワークスペースプランとアカウント上限機能
-- ============================================

-- workspacesテーブルにプラン関連のカラムを追加
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'vip')),
ADD COLUMN IF NOT EXISTS max_threads_accounts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS plan_notes TEXT;

-- 既存のワークスペースのmax_threads_accountsを設定
UPDATE workspaces
SET max_threads_accounts = CASE 
    WHEN plan_type = 'vip' THEN 10
    ELSE 3
END
WHERE max_threads_accounts IS NULL;

-- プラン変更履歴テーブル
CREATE TABLE IF NOT EXISTS workspace_plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    previous_plan TEXT,
    new_plan TEXT NOT NULL,
    previous_max_accounts INTEGER,
    new_max_accounts INTEGER NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_workspace_plan_history_workspace 
ON workspace_plan_history(workspace_id, created_at DESC);

-- アカウント数チェック関数
CREATE OR REPLACE FUNCTION check_threads_account_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
    workspace_plan TEXT;
BEGIN
    -- 現在のアカウント数を取得
    SELECT COUNT(*) INTO current_count
    FROM threads_accounts
    WHERE workspace_id = NEW.workspace_id
    AND is_active = true
    AND id != COALESCE(NEW.id, gen_random_uuid());
    
    -- ワークスペースのプランと上限を取得
    SELECT plan_type, max_threads_accounts INTO workspace_plan, max_allowed
    FROM workspaces
    WHERE id = NEW.workspace_id;
    
    -- 新規追加または有効化の場合のみチェック
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false)) THEN
        IF current_count >= max_allowed THEN
            RAISE EXCEPTION 'Threadsアカウント数が上限（%個）に達しています。プラン: %', max_allowed, workspace_plan;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
DROP TRIGGER IF EXISTS check_threads_account_limit_trigger ON threads_accounts;
CREATE TRIGGER check_threads_account_limit_trigger
BEFORE INSERT OR UPDATE ON threads_accounts
FOR EACH ROW
EXECUTE FUNCTION check_threads_account_limit();

-- プラン情報を取得するビュー
CREATE OR REPLACE VIEW v_workspace_plan_status AS
SELECT 
    w.id,
    w.name,
    w.plan_type,
    w.max_threads_accounts,
    w.plan_expires_at,
    COUNT(ta.id) FILTER (WHERE ta.is_active = true) as active_accounts_count,
    w.max_threads_accounts - COUNT(ta.id) FILTER (WHERE ta.is_active = true) as remaining_slots,
    CASE 
        WHEN w.plan_expires_at IS NULL THEN 'active'
        WHEN w.plan_expires_at > NOW() THEN 'active'
        ELSE 'expired'
    END as plan_status
FROM workspaces w
LEFT JOIN threads_accounts ta ON w.id = ta.workspace_id
GROUP BY w.id, w.name, w.plan_type, w.max_threads_accounts, w.plan_expires_at;

-- VIPプランへのアップグレード関数（管理者用）
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

-- フリープランへのダウングレード関数
CREATE OR REPLACE FUNCTION downgrade_workspace_to_free(
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
    
    -- プランをフリーに更新
    UPDATE workspaces
    SET 
        plan_type = 'free',
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
        'free',
        v_current_max,
        3,
        p_admin_user_id,
        p_reason
    );
    
    -- アクティブアカウントが3個を超えている場合の警告
    IF v_active_accounts > 3 THEN
        RETURN QUERY SELECT 
            true, 
            format('フリープランにダウングレードしました。%s個のアカウントを無効化する必要があります', v_active_accounts - 3)::TEXT,
            3,
            v_active_accounts - 3;
    ELSE
        RETURN QUERY SELECT true, 'フリープランにダウングレードしました'::TEXT, 3, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- RLSポリシー
ALTER TABLE workspace_plan_history ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧可能
CREATE POLICY "workspace_plan_history_select_policy" ON workspace_plan_history
FOR SELECT
USING (
    workspace_id IN (
        SELECT id FROM workspaces 
        WHERE owner_id = auth.uid()
    )
    OR 
    EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = workspace_plan_history.workspace_id 
        AND user_id = auth.uid()
        AND role = 'admin'
    )
);

-- システム管理者用のプラン管理テーブル（将来の拡張用）
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"manage_plans": true}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id)
);

-- システム管理者チェック関数
CREATE OR REPLACE FUNCTION is_system_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM system_admins 
        WHERE user_id = p_user_id 
        AND is_active = true
        AND (permissions->>'manage_plans')::BOOLEAN = true
    );
END;
$$ LANGUAGE plpgsql;

-- プラン期限チェック関数（Cronジョブで定期実行）
CREATE OR REPLACE FUNCTION check_expired_vip_plans()
RETURNS TABLE(
    workspace_id UUID,
    workspace_name TEXT,
    expired_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- 期限切れのVIPプランを自動的にフリープランに戻す
    UPDATE workspaces
    SET 
        plan_type = 'free',
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