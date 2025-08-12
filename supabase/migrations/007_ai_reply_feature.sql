-- AI返信生成機能のための拡張
-- ============================================

-- auto_reply_rulesテーブルにAI関連カラムを追加
ALTER TABLE auto_reply_rules
ADD COLUMN IF NOT EXISTS use_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_tone TEXT CHECK (ai_tone IN ('friendly', 'professional', 'casual', 'formal')),
ADD COLUMN IF NOT EXISTS ai_max_length INTEGER DEFAULT 280;

-- AI生成履歴テーブル
CREATE TABLE IF NOT EXISTS ai_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- AI生成情報
    prompt TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    model_used TEXT,
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    
    -- メタデータ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 複数アカウント対応のための拡張
-- ============================================

-- auto_reply_rulesテーブルに複数アカウント対応を追加
ALTER TABLE auto_reply_rules
ADD COLUMN IF NOT EXISTS account_ids UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN IF NOT EXISTS rotation_mode TEXT DEFAULT 'random' CHECK (rotation_mode IN ('random', 'round_robin', 'least_used'));

-- アカウント使用統計テーブル
CREATE TABLE IF NOT EXISTS account_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES threads_accounts(id) ON DELETE CASCADE NOT NULL,
    
    -- 統計情報
    total_replies INTEGER DEFAULT 0,
    replies_today INTEGER DEFAULT 0,
    replies_this_hour INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    
    -- 更新情報
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, account_id)
);

-- 分析用データテーブル
-- ============================================

-- コメント分析テーブル
CREATE TABLE IF NOT EXISTS comment_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
    
    -- 分析データ
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    sentiment_score DECIMAL(3,2),
    language TEXT,
    topics TEXT[],
    entities TEXT[],
    
    -- 応答データ
    response_time_seconds INTEGER,
    was_auto_replied BOOLEAN DEFAULT false,
    manual_intervention BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(comment_id)
);

-- 返信パフォーマンステーブル
CREATE TABLE IF NOT EXISTS reply_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE CASCADE,
    
    -- パフォーマンスデータ
    period_date DATE NOT NULL,
    total_replies INTEGER DEFAULT 0,
    successful_replies INTEGER DEFAULT 0,
    failed_replies INTEGER DEFAULT 0,
    avg_response_time_seconds DECIMAL(10,2),
    
    -- エンゲージメント
    total_likes INTEGER DEFAULT 0,
    total_replies_received INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, rule_id, period_date)
);

-- RLSポリシー追加
-- ============================================

-- ai_generation_history
ALTER TABLE ai_generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_generation_history_workspace_isolation" ON ai_generation_history
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- account_usage_stats
ALTER TABLE account_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_usage_stats_workspace_isolation" ON account_usage_stats
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- comment_analytics
ALTER TABLE comment_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_analytics_workspace_isolation" ON comment_analytics
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- reply_performance
ALTER TABLE reply_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reply_performance_workspace_isolation" ON reply_performance
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- 便利な関数
-- ============================================

-- アカウントローテーション関数
CREATE OR REPLACE FUNCTION get_next_account_for_reply(
    p_workspace_id UUID,
    p_rule_id UUID
) RETURNS UUID AS $$
DECLARE
    v_account_ids UUID[];
    v_rotation_mode TEXT;
    v_selected_account_id UUID;
BEGIN
    -- ルールの設定を取得
    SELECT account_ids, rotation_mode
    INTO v_account_ids, v_rotation_mode
    FROM auto_reply_rules
    WHERE id = p_rule_id;
    
    -- アカウントが指定されていない場合はデフォルトアカウントを使用
    IF v_account_ids IS NULL OR array_length(v_account_ids, 1) IS NULL THEN
        SELECT id INTO v_selected_account_id
        FROM threads_accounts
        WHERE workspace_id = p_workspace_id
        AND is_active = true
        ORDER BY created_at
        LIMIT 1;
        
        RETURN v_selected_account_id;
    END IF;
    
    -- ローテーションモードに応じて選択
    CASE v_rotation_mode
        WHEN 'random' THEN
            -- ランダムに選択
            v_selected_account_id := v_account_ids[1 + floor(random() * array_length(v_account_ids, 1))];
            
        WHEN 'round_robin' THEN
            -- ラウンドロビンで選択（最も古い使用から選択）
            SELECT account_id INTO v_selected_account_id
            FROM account_usage_stats
            WHERE workspace_id = p_workspace_id
            AND account_id = ANY(v_account_ids)
            ORDER BY last_reply_at NULLS FIRST
            LIMIT 1;
            
            -- 統計がない場合は最初のアカウントを使用
            IF v_selected_account_id IS NULL THEN
                v_selected_account_id := v_account_ids[1];
            END IF;
            
        WHEN 'least_used' THEN
            -- 最も使用回数が少ないアカウントを選択
            SELECT account_id INTO v_selected_account_id
            FROM account_usage_stats
            WHERE workspace_id = p_workspace_id
            AND account_id = ANY(v_account_ids)
            ORDER BY replies_today, total_replies
            LIMIT 1;
            
            -- 統計がない場合は最初のアカウントを使用
            IF v_selected_account_id IS NULL THEN
                v_selected_account_id := v_account_ids[1];
            END IF;
            
        ELSE
            -- デフォルトは最初のアカウント
            v_selected_account_id := v_account_ids[1];
    END CASE;
    
    RETURN v_selected_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- アカウント使用統計更新関数
CREATE OR REPLACE FUNCTION update_account_usage_stats(
    p_workspace_id UUID,
    p_account_id UUID
) RETURNS VOID AS $$
BEGIN
    INSERT INTO account_usage_stats (
        workspace_id,
        account_id,
        total_replies,
        replies_today,
        replies_this_hour,
        last_reply_at
    ) VALUES (
        p_workspace_id,
        p_account_id,
        1,
        1,
        1,
        NOW()
    )
    ON CONFLICT (workspace_id, account_id)
    DO UPDATE SET
        total_replies = account_usage_stats.total_replies + 1,
        replies_today = CASE 
            WHEN DATE(account_usage_stats.last_reply_at) = CURRENT_DATE 
            THEN account_usage_stats.replies_today + 1 
            ELSE 1 
        END,
        replies_this_hour = CASE 
            WHEN account_usage_stats.last_reply_at > NOW() - INTERVAL '1 hour' 
            THEN account_usage_stats.replies_this_hour + 1 
            ELSE 1 
        END,
        last_reply_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- インデックス追加
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_generation_history_workspace ON ai_generation_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_history_rule ON ai_generation_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_account_usage_stats_workspace ON account_usage_stats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comment_analytics_workspace ON comment_analytics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comment_analytics_sentiment ON comment_analytics(sentiment);
CREATE INDEX IF NOT EXISTS idx_reply_performance_workspace_date ON reply_performance(workspace_id, period_date);