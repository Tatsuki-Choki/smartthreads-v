-- ====================================
-- SmartThreads V - 自動返信機能
-- 作成日: 2025-08-12
-- 目的: コメント自動返信機能のためのデータベース構造追加
-- ====================================

-- ====================================
-- フェーズ1: reply_templatesテーブル（返信テンプレート）
-- ====================================

CREATE TABLE IF NOT EXISTS reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL, -- テンプレート内容（変数を含む）
    variables JSONB DEFAULT '{}'::jsonb, -- 使用可能な変数定義
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[], -- 添付メディアURL配列
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- reply_templatesテーブルのインデックス
CREATE INDEX idx_reply_templates_workspace ON reply_templates(workspace_id);
CREATE INDEX idx_reply_templates_active ON reply_templates(is_active);

-- ====================================
-- フェーズ2: auto_reply_rulesテーブル（自動返信ルール）
-- ====================================

CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    threads_account_id UUID NOT NULL REFERENCES threads_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- トリガー条件
    trigger_keywords TEXT[] NOT NULL, -- トリガーキーワード配列
    exclude_keywords TEXT[] DEFAULT ARRAY[]::TEXT[], -- 除外キーワード配列
    match_mode TEXT DEFAULT 'any' CHECK (match_mode IN ('any', 'all', 'exact')), -- マッチモード
    
    -- 返信設定
    reply_template_id UUID REFERENCES reply_templates(id) ON DELETE SET NULL, -- テンプレートID
    reply_content TEXT NOT NULL, -- 返信内容（テンプレートまたは直接入力）
    reply_delay_seconds INTEGER DEFAULT 0 CHECK (reply_delay_seconds >= 0 AND reply_delay_seconds <= 30),
    
    -- 制限設定
    max_replies_per_hour INTEGER DEFAULT 10 CHECK (max_replies_per_hour > 0 AND max_replies_per_hour <= 100),
    max_replies_per_user INTEGER DEFAULT 3 CHECK (max_replies_per_user > 0 AND max_replies_per_user <= 10),
    
    -- ステータスと優先度
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- 優先度（数値が高いほど優先）
    
    -- メタデータ
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- auto_reply_rulesテーブルのインデックス
CREATE INDEX idx_auto_reply_rules_workspace ON auto_reply_rules(workspace_id);
CREATE INDEX idx_auto_reply_rules_threads_account ON auto_reply_rules(threads_account_id);
CREATE INDEX idx_auto_reply_rules_active ON auto_reply_rules(is_active);
CREATE INDEX idx_auto_reply_rules_priority ON auto_reply_rules(priority DESC);

-- ====================================
-- フェーズ3: commentsテーブル（コメント管理）
-- ====================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Threadsデータ
    threads_comment_id TEXT UNIQUE NOT NULL, -- Threads上のコメントID
    threads_post_id TEXT NOT NULL, -- コメント対象の投稿ID
    threads_user_id TEXT NOT NULL, -- コメント投稿者のThreadsユーザーID
    threads_parent_comment_id TEXT, -- 親コメントID（コメントへの返信の場合）
    
    -- ユーザー情報
    username TEXT NOT NULL, -- コメント投稿者のユーザー名
    display_name TEXT, -- 表示名
    profile_picture_url TEXT, -- プロフィール画像URL
    
    -- コメント内容
    content TEXT NOT NULL, -- コメント内容
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[], -- 添付メディア
    
    -- 返信管理
    replied BOOLEAN DEFAULT false, -- 返信済みフラグ
    reply_post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- 返信投稿ID
    matched_rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE SET NULL, -- マッチしたルールID
    reply_sent_at TIMESTAMP WITH TIME ZONE, -- 返信送信日時
    reply_error TEXT, -- 返信エラーメッセージ
    
    -- 生データとメタデータ
    raw_data JSONB, -- Webhookから受信した生データ
    is_spam BOOLEAN DEFAULT false, -- スパムフラグ
    sentiment TEXT, -- 感情分析結果（positive, negative, neutral）
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- commentsテーブルのインデックス
CREATE INDEX idx_comments_workspace ON comments(workspace_id);
CREATE INDEX idx_comments_threads_post ON comments(threads_post_id);
CREATE INDEX idx_comments_threads_comment ON comments(threads_comment_id);
CREATE INDEX idx_comments_threads_user ON comments(threads_user_id);
CREATE INDEX idx_comments_replied ON comments(replied);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_matched_rule ON comments(matched_rule_id);

-- ====================================
-- フェーズ4: reply_queueテーブル（返信キュー）
-- ====================================

CREATE TABLE IF NOT EXISTS reply_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES auto_reply_rules(id) ON DELETE CASCADE,
    
    -- キュー管理
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL, -- 送信予定時刻
    processed_at TIMESTAMP WITH TIME ZONE, -- 処理完了時刻
    
    -- 返信内容
    reply_content TEXT NOT NULL, -- 生成された返信内容
    reply_media_urls TEXT[] DEFAULT ARRAY[]::TEXT[], -- 添付メディア
    
    -- エラー管理
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- reply_queueテーブルのインデックス
CREATE INDEX idx_reply_queue_workspace ON reply_queue(workspace_id);
CREATE INDEX idx_reply_queue_status ON reply_queue(status);
CREATE INDEX idx_reply_queue_scheduled ON reply_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reply_queue_comment ON reply_queue(comment_id);

-- ====================================
-- フェーズ5: auto_reply_logsテーブル（自動返信ログ）
-- ====================================

CREATE TABLE IF NOT EXISTS auto_reply_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- 関連データ
    comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
    threads_account_id UUID REFERENCES threads_accounts(id) ON DELETE SET NULL,
    
    -- ログデータ
    event_type TEXT NOT NULL, -- 'rule_matched', 'reply_sent', 'reply_failed', 'rate_limited'
    event_details JSONB DEFAULT '{}'::jsonb, -- イベント詳細
    
    -- パフォーマンスメトリクス
    processing_time_ms INTEGER, -- 処理時間（ミリ秒）
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- auto_reply_logsテーブルのインデックス
CREATE INDEX idx_auto_reply_logs_workspace ON auto_reply_logs(workspace_id);
CREATE INDEX idx_auto_reply_logs_event_type ON auto_reply_logs(event_type);
CREATE INDEX idx_auto_reply_logs_created_at ON auto_reply_logs(created_at DESC);
CREATE INDEX idx_auto_reply_logs_rule ON auto_reply_logs(rule_id);

-- ====================================
-- フェーズ6: 既存テーブルの拡張
-- ====================================

-- postsテーブルにコメント関連フィールドを追加
DO $$ 
BEGIN
    -- comment_count: コメント数
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'comment_count'
    ) THEN
        ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0;
    END IF;

    -- last_comment_at: 最新コメント時刻
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'last_comment_at'
    ) THEN
        ALTER TABLE posts ADD COLUMN last_comment_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- auto_reply_enabled: 自動返信有効フラグ
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'auto_reply_enabled'
    ) THEN
        ALTER TABLE posts ADD COLUMN auto_reply_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

-- postsテーブルの新しいインデックス
CREATE INDEX IF NOT EXISTS idx_posts_comment_count ON posts(comment_count);
CREATE INDEX IF NOT EXISTS idx_posts_last_comment_at ON posts(last_comment_at DESC) WHERE last_comment_at IS NOT NULL;

-- ====================================
-- フェーズ7: RLSポリシー設定
-- ====================================

-- RLS有効化
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_logs ENABLE ROW LEVEL SECURITY;

-- reply_templatesテーブルのRLSポリシー
CREATE POLICY "Users can manage reply templates in their workspaces" ON reply_templates
FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- auto_reply_rulesテーブルのRLSポリシー
CREATE POLICY "Users can manage auto reply rules in their workspaces" ON auto_reply_rules
FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- commentsテーブルのRLSポリシー
CREATE POLICY "Users can view comments in their workspaces" ON comments
FOR SELECT USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- システムからのコメント挿入を許可
CREATE POLICY "System can insert comments" ON comments
FOR INSERT WITH CHECK (true);

-- reply_queueテーブルのRLSポリシー
CREATE POLICY "Users can manage reply queue in their workspaces" ON reply_queue
FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- auto_reply_logsテーブルのRLSポリシー
CREATE POLICY "Users can view logs in their workspaces" ON auto_reply_logs
FOR SELECT USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- システムからのログ挿入を許可
CREATE POLICY "System can insert logs" ON auto_reply_logs
FOR INSERT WITH CHECK (true);

-- ====================================
-- フェーズ8: トリガー設定
-- ====================================

-- updated_atトリガーを追加
CREATE TRIGGER update_reply_templates_updated_at 
    BEFORE UPDATE ON reply_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_reply_rules_updated_at 
    BEFORE UPDATE ON auto_reply_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_queue_updated_at 
    BEFORE UPDATE ON reply_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- フェーズ9: ヘルパー関数
-- ====================================

-- キーワードマッチング関数
CREATE OR REPLACE FUNCTION check_keyword_match(
    p_content TEXT,
    p_keywords TEXT[],
    p_exclude_keywords TEXT[],
    p_match_mode TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    content_lower TEXT;
    keyword TEXT;
    match_count INTEGER := 0;
BEGIN
    -- コンテンツを小文字に変換
    content_lower := LOWER(p_content);
    
    -- 除外キーワードチェック
    IF p_exclude_keywords IS NOT NULL AND array_length(p_exclude_keywords, 1) > 0 THEN
        FOREACH keyword IN ARRAY p_exclude_keywords
        LOOP
            IF content_lower LIKE '%' || LOWER(keyword) || '%' THEN
                RETURN FALSE;
            END IF;
        END LOOP;
    END IF;
    
    -- トリガーキーワードチェック
    IF p_keywords IS NOT NULL AND array_length(p_keywords, 1) > 0 THEN
        FOREACH keyword IN ARRAY p_keywords
        LOOP
            IF content_lower LIKE '%' || LOWER(keyword) || '%' THEN
                match_count := match_count + 1;
                
                -- 'any'モードの場合、1つでもマッチしたらtrue
                IF p_match_mode = 'any' THEN
                    RETURN TRUE;
                END IF;
            END IF;
        END LOOP;
        
        -- 'all'モードの場合、すべてマッチする必要がある
        IF p_match_mode = 'all' THEN
            RETURN match_count = array_length(p_keywords, 1);
        END IF;
        
        -- 'exact'モードの場合、完全一致
        IF p_match_mode = 'exact' THEN
            RETURN content_lower = LOWER(p_keywords[1]);
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- レート制限チェック関数
CREATE OR REPLACE FUNCTION check_auto_reply_rate_limit(
    p_workspace_id UUID,
    p_threads_account_id UUID,
    p_rule_id UUID,
    p_threads_user_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    hour_count INTEGER;
    user_count INTEGER;
    rule_config RECORD;
BEGIN
    -- ルール設定を取得
    SELECT max_replies_per_hour, max_replies_per_user 
    INTO rule_config
    FROM auto_reply_rules 
    WHERE id = p_rule_id;
    
    -- 過去1時間の返信数をチェック
    SELECT COUNT(*) INTO hour_count
    FROM comments
    WHERE workspace_id = p_workspace_id
      AND matched_rule_id = p_rule_id
      AND replied = true
      AND reply_sent_at >= NOW() - INTERVAL '1 hour';
    
    IF hour_count >= rule_config.max_replies_per_hour THEN
        RETURN FALSE;
    END IF;
    
    -- 同一ユーザーへの返信数をチェック
    SELECT COUNT(*) INTO user_count
    FROM comments
    WHERE workspace_id = p_workspace_id
      AND matched_rule_id = p_rule_id
      AND threads_user_id = p_threads_user_id
      AND replied = true;
    
    IF user_count >= rule_config.max_replies_per_user THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- フェーズ10: 初期データとサンプル
-- ====================================

-- デフォルトテンプレートの例（コメントアウト、必要に応じて使用）
/*
INSERT INTO reply_templates (workspace_id, name, description, content, variables) VALUES
(
    (SELECT id FROM workspaces LIMIT 1),
    'お礼テンプレート',
    'コメントへの感謝を伝えるテンプレート',
    'こんにちは、{{username}}さん！コメントありがとうございます😊\nご意見とても参考になります！',
    '{"username": "コメント投稿者名"}'::jsonb
),
(
    (SELECT id FROM workspaces LIMIT 1),
    '質問への案内',
    '詳細な質問への案内テンプレート',
    '{{username}}さん、ご質問ありがとうございます。\n詳しくはDMまたはプロフィールのリンクからお問い合わせください。',
    '{"username": "コメント投稿者名"}'::jsonb
);
*/

-- ====================================
-- 完了ログ
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE '自動返信機能データベース構築完了';
    RAISE NOTICE '======================================';
    RAISE NOTICE 'テーブル作成: reply_templates, auto_reply_rules, comments, reply_queue, auto_reply_logs';
    RAISE NOTICE 'RLSポリシー: 全テーブルに設定完了';
    RAISE NOTICE 'インデックス: パフォーマンス最適化済み';
    RAISE NOTICE 'ヘルパー関数: キーワードマッチング、レート制限チェック';
    RAISE NOTICE '完了時刻: %', NOW();
    RAISE NOTICE '======================================';
END $$;