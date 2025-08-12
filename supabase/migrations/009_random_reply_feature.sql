-- 自動返信ランダム返信機能
-- ============================================

-- 返信プールテーブル（ランダム返信用）
CREATE TABLE IF NOT EXISTS reply_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE CASCADE NOT NULL,
    
    -- 返信内容
    content TEXT NOT NULL,
    weight INTEGER DEFAULT 1 CHECK (weight >= 0 AND weight <= 100), -- 重み（0-100）
    
    -- メディア
    media_urls TEXT[],
    media_type TEXT CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO')),
    
    -- 使用統計
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- 状態
    is_active BOOLEAN DEFAULT true,
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- auto_reply_rulesテーブルにランダム返信関連カラムを追加
ALTER TABLE auto_reply_rules
ADD COLUMN IF NOT EXISTS use_random_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS random_selection_mode TEXT DEFAULT 'weighted' CHECK (random_selection_mode IN ('weighted', 'equal', 'least_used')),
ADD COLUMN IF NOT EXISTS avoid_recent_duplicates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS duplicate_window_hours INTEGER DEFAULT 24;

-- 返信選択履歴テーブル
CREATE TABLE IF NOT EXISTS reply_selection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE CASCADE NOT NULL,
    pool_id UUID REFERENCES reply_pools(id) ON DELETE CASCADE NOT NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- 選択情報
    selected_at TIMESTAMPTZ DEFAULT NOW(),
    selection_method TEXT, -- 'weighted', 'equal', 'least_used'
    
    -- コンテキスト
    comment_author TEXT,
    comment_content TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSポリシー追加
-- ============================================

-- reply_pools
ALTER TABLE reply_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reply_pools_workspace_isolation" ON reply_pools
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- reply_selection_history
ALTER TABLE reply_selection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reply_selection_history_workspace_isolation" ON reply_selection_history
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- 便利な関数
-- ============================================

-- ランダム返信を選択する関数
CREATE OR REPLACE FUNCTION select_random_reply(
    p_rule_id UUID,
    p_workspace_id UUID,
    p_comment_author TEXT DEFAULT NULL
) RETURNS TABLE (
    pool_id UUID,
    content TEXT,
    media_urls TEXT[],
    media_type TEXT
) AS $$
DECLARE
    v_selection_mode TEXT;
    v_avoid_duplicates BOOLEAN;
    v_duplicate_window INTEGER;
    v_selected_pool_id UUID;
BEGIN
    -- ルール設定を取得
    SELECT 
        random_selection_mode,
        avoid_recent_duplicates,
        duplicate_window_hours
    INTO 
        v_selection_mode,
        v_avoid_duplicates,
        v_duplicate_window
    FROM auto_reply_rules
    WHERE id = p_rule_id;
    
    -- アクティブなプールを取得
    CREATE TEMP TABLE temp_pools AS
    SELECT 
        p.id,
        p.content,
        p.media_urls,
        p.media_type,
        p.weight,
        p.usage_count,
        p.last_used_at
    FROM reply_pools p
    WHERE p.rule_id = p_rule_id
    AND p.is_active = true;
    
    -- 重複回避が有効な場合、最近使用されたものを除外
    IF v_avoid_duplicates THEN
        DELETE FROM temp_pools
        WHERE id IN (
            SELECT DISTINCT pool_id
            FROM reply_selection_history
            WHERE rule_id = p_rule_id
            AND selected_at > NOW() - INTERVAL '1 hour' * v_duplicate_window
            AND (p_comment_author IS NULL OR comment_author = p_comment_author)
        );
    END IF;
    
    -- プールが空の場合は全プールから選択
    IF NOT EXISTS (SELECT 1 FROM temp_pools) THEN
        INSERT INTO temp_pools
        SELECT 
            p.id,
            p.content,
            p.media_urls,
            p.media_type,
            p.weight,
            p.usage_count,
            p.last_used_at
        FROM reply_pools p
        WHERE p.rule_id = p_rule_id
        AND p.is_active = true;
    END IF;
    
    -- 選択モードに応じて返信を選択
    CASE v_selection_mode
        WHEN 'weighted' THEN
            -- 重み付きランダム選択
            WITH weighted_pools AS (
                SELECT 
                    id,
                    SUM(weight) OVER (ORDER BY id) AS cumulative_weight,
                    SUM(weight) OVER () AS total_weight
                FROM temp_pools
            )
            SELECT id INTO v_selected_pool_id
            FROM weighted_pools
            WHERE cumulative_weight >= (random() * total_weight)
            ORDER BY cumulative_weight
            LIMIT 1;
            
        WHEN 'equal' THEN
            -- 均等ランダム選択
            SELECT id INTO v_selected_pool_id
            FROM temp_pools
            ORDER BY random()
            LIMIT 1;
            
        WHEN 'least_used' THEN
            -- 最も使用回数が少ないものを選択
            SELECT id INTO v_selected_pool_id
            FROM temp_pools
            ORDER BY usage_count, random()
            LIMIT 1;
            
        ELSE
            -- デフォルトは均等ランダム
            SELECT id INTO v_selected_pool_id
            FROM temp_pools
            ORDER BY random()
            LIMIT 1;
    END CASE;
    
    -- 選択されたプールの情報を返す
    RETURN QUERY
    SELECT 
        p.id,
        p.content,
        p.media_urls,
        p.media_type
    FROM reply_pools p
    WHERE p.id = v_selected_pool_id;
    
    -- 使用統計を更新
    UPDATE reply_pools
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = v_selected_pool_id;
    
    DROP TABLE IF EXISTS temp_pools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 返信プールの重み正規化関数
CREATE OR REPLACE FUNCTION normalize_reply_weights(
    p_rule_id UUID
) RETURNS VOID AS $$
DECLARE
    v_total_weight INTEGER;
BEGIN
    -- 総重みを計算
    SELECT SUM(weight) INTO v_total_weight
    FROM reply_pools
    WHERE rule_id = p_rule_id
    AND is_active = true;
    
    -- 0除算を避ける
    IF v_total_weight IS NULL OR v_total_weight = 0 THEN
        -- すべて均等に設定
        UPDATE reply_pools
        SET weight = 10
        WHERE rule_id = p_rule_id
        AND is_active = true;
    ELSIF v_total_weight != 100 THEN
        -- 100になるように正規化
        UPDATE reply_pools
        SET weight = ROUND((weight::NUMERIC / v_total_weight) * 100)
        WHERE rule_id = p_rule_id
        AND is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- インデックス追加
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reply_pools_rule ON reply_pools(rule_id);
CREATE INDEX IF NOT EXISTS idx_reply_pools_workspace ON reply_pools(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reply_pools_active ON reply_pools(rule_id, is_active);
CREATE INDEX IF NOT EXISTS idx_reply_selection_history_rule ON reply_selection_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_reply_selection_history_selected_at ON reply_selection_history(selected_at);