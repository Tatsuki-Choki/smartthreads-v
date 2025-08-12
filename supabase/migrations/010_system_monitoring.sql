-- システム監視・通知機能
-- ============================================

-- 通知設定テーブル
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- 通知チャンネル
    email_enabled BOOLEAN DEFAULT true,
    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url TEXT,
    
    -- 通知タイプ設定
    notify_post_success BOOLEAN DEFAULT false,
    notify_post_failure BOOLEAN DEFAULT true,
    notify_reply_success BOOLEAN DEFAULT false,
    notify_reply_failure BOOLEAN DEFAULT true,
    notify_rate_limit BOOLEAN DEFAULT true,
    notify_system_error BOOLEAN DEFAULT true,
    notify_daily_summary BOOLEAN DEFAULT true,
    
    -- 通知頻度制御
    min_interval_minutes INTEGER DEFAULT 5, -- 同じタイプの通知の最小間隔
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone TEXT DEFAULT 'Asia/Tokyo',
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, user_id)
);

-- システムイベントログテーブル
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- イベント情報
    event_type TEXT NOT NULL CHECK (event_type IN (
        'post_success', 'post_failure', 'post_scheduled',
        'reply_success', 'reply_failure', 'reply_queued',
        'rate_limit_hit', 'api_error', 'system_error',
        'webhook_received', 'webhook_failed',
        'cron_executed', 'cron_failed',
        'auth_success', 'auth_failure'
    )),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    
    -- イベント詳細
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    
    -- 関連エンティティ
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
    
    -- エラー情報
    error_code TEXT,
    error_message TEXT,
    stack_trace TEXT,
    
    -- タイムスタンプ
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 通知状態
    notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ
);

-- 通知キューテーブル
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    
    -- 通知情報
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'in_app')),
    
    -- コンテンツ
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB,
    
    -- 関連イベント
    event_id UUID REFERENCES system_events(id) ON DELETE SET NULL,
    
    -- 処理状態
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- スケジューリング
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- システムヘルスメトリクステーブル
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- メトリクス種別
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'api_latency', 'db_latency', 'queue_depth',
        'success_rate', 'error_rate', 'throughput'
    )),
    
    -- 値
    value DECIMAL NOT NULL,
    unit TEXT,
    
    -- コンテキスト
    endpoint TEXT,
    operation TEXT,
    
    -- タイムスタンプ
    measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- デイリーサマリーテーブル
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    summary_date DATE NOT NULL,
    
    -- 統計
    total_posts INTEGER DEFAULT 0,
    successful_posts INTEGER DEFAULT 0,
    failed_posts INTEGER DEFAULT 0,
    
    total_replies INTEGER DEFAULT 0,
    successful_replies INTEGER DEFAULT 0,
    failed_replies INTEGER DEFAULT 0,
    
    total_comments_received INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    total_api_calls INTEGER DEFAULT 0,
    
    -- パフォーマンス
    avg_post_time_ms DECIMAL,
    avg_reply_time_ms DECIMAL,
    uptime_percentage DECIMAL,
    
    -- 生成情報
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    
    UNIQUE(workspace_id, summary_date)
);

-- RLSポリシー追加
-- ============================================

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_settings_user_access" ON notification_settings
    FOR ALL
    USING (user_id = auth.uid() OR workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_events_workspace_isolation" ON system_events
    FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_queue_workspace_isolation" ON notification_queue
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_metrics_workspace_isolation" ON system_metrics
    FOR SELECT
    USING (workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_summaries_workspace_isolation" ON daily_summaries
    FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- 便利な関数
-- ============================================

-- システムイベントを記録する関数
CREATE OR REPLACE FUNCTION log_system_event(
    p_event_type TEXT,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'info',
    p_workspace_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO system_events (
        workspace_id,
        event_type,
        severity,
        title,
        description,
        metadata,
        occurred_at
    ) VALUES (
        p_workspace_id,
        p_event_type,
        p_severity,
        p_title,
        p_description,
        p_metadata,
        NOW()
    ) RETURNING id INTO v_event_id;
    
    -- 重要なイベントは通知キューに追加
    IF p_severity IN ('error', 'critical') THEN
        PERFORM queue_notification(
            p_workspace_id,
            p_event_type,
            p_title,
            p_description,
            v_event_id
        );
    END IF;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 通知をキューに追加する関数
CREATE OR REPLACE FUNCTION queue_notification(
    p_workspace_id UUID,
    p_event_type TEXT,
    p_subject TEXT,
    p_body TEXT,
    p_event_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_settings RECORD;
    v_should_notify BOOLEAN := false;
BEGIN
    -- 通知設定を取得
    FOR v_settings IN 
        SELECT * FROM notification_settings 
        WHERE workspace_id = p_workspace_id
    LOOP
        -- イベントタイプに応じた通知判定
        CASE p_event_type
            WHEN 'post_failure' THEN
                v_should_notify := v_settings.notify_post_failure;
            WHEN 'reply_failure' THEN
                v_should_notify := v_settings.notify_reply_failure;
            WHEN 'rate_limit_hit' THEN
                v_should_notify := v_settings.notify_rate_limit;
            WHEN 'system_error' THEN
                v_should_notify := v_settings.notify_system_error;
            ELSE
                v_should_notify := false;
        END CASE;
        
        IF v_should_notify THEN
            -- メール通知
            IF v_settings.email_enabled THEN
                INSERT INTO notification_queue (
                    workspace_id,
                    recipient_user_id,
                    channel,
                    subject,
                    body,
                    event_id
                ) VALUES (
                    p_workspace_id,
                    v_settings.user_id,
                    'email',
                    p_subject,
                    p_body,
                    p_event_id
                );
            END IF;
            
            -- Webhook通知
            IF v_settings.webhook_enabled AND v_settings.webhook_url IS NOT NULL THEN
                INSERT INTO notification_queue (
                    workspace_id,
                    recipient_user_id,
                    channel,
                    subject,
                    body,
                    event_id,
                    metadata
                ) VALUES (
                    p_workspace_id,
                    v_settings.user_id,
                    'webhook',
                    p_subject,
                    p_body,
                    p_event_id,
                    jsonb_build_object('webhook_url', v_settings.webhook_url)
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- デイリーサマリーを生成する関数
CREATE OR REPLACE FUNCTION generate_daily_summary(
    p_workspace_id UUID,
    p_date DATE DEFAULT CURRENT_DATE - 1
) RETURNS UUID AS $$
DECLARE
    v_summary_id UUID;
    v_stats RECORD;
BEGIN
    -- 統計を集計
    WITH stats AS (
        SELECT
            COUNT(CASE WHEN event_type = 'post_success' THEN 1 END) AS successful_posts,
            COUNT(CASE WHEN event_type = 'post_failure' THEN 1 END) AS failed_posts,
            COUNT(CASE WHEN event_type = 'reply_success' THEN 1 END) AS successful_replies,
            COUNT(CASE WHEN event_type = 'reply_failure' THEN 1 END) AS failed_replies,
            COUNT(CASE WHEN severity = 'error' OR severity = 'critical' THEN 1 END) AS total_errors
        FROM system_events
        WHERE workspace_id = p_workspace_id
        AND DATE(occurred_at) = p_date
    )
    SELECT * INTO v_stats FROM stats;
    
    -- サマリーを作成または更新
    INSERT INTO daily_summaries (
        workspace_id,
        summary_date,
        successful_posts,
        failed_posts,
        successful_replies,
        failed_replies,
        total_errors,
        generated_at
    ) VALUES (
        p_workspace_id,
        p_date,
        v_stats.successful_posts,
        v_stats.failed_posts,
        v_stats.successful_replies,
        v_stats.failed_replies,
        v_stats.total_errors,
        NOW()
    )
    ON CONFLICT (workspace_id, summary_date)
    DO UPDATE SET
        successful_posts = EXCLUDED.successful_posts,
        failed_posts = EXCLUDED.failed_posts,
        successful_replies = EXCLUDED.successful_replies,
        failed_replies = EXCLUDED.failed_replies,
        total_errors = EXCLUDED.total_errors,
        generated_at = NOW()
    RETURNING id INTO v_summary_id;
    
    RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- インデックス追加
-- ============================================

CREATE INDEX IF NOT EXISTS idx_system_events_workspace ON system_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_events_occurred_at ON system_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_system_metrics_workspace ON system_metrics(workspace_id, metric_type, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_workspace_date ON daily_summaries(workspace_id, summary_date);