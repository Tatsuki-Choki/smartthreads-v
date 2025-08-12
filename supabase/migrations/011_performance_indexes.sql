-- パフォーマンス最適化のためのインデックス追加
-- ============================================

-- 複合インデックス
-- ============================================

-- posts: よく使われるクエリパターン用
CREATE INDEX IF NOT EXISTS idx_posts_workspace_status_scheduled 
ON posts(workspace_id, status, scheduled_at DESC)
WHERE status IN ('scheduled', 'pending');

CREATE INDEX IF NOT EXISTS idx_posts_workspace_created 
ON posts(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_account_status 
ON posts(threads_account_id, status);

-- comments: 返信処理の高速化
CREATE INDEX IF NOT EXISTS idx_comments_workspace_replied 
ON comments(workspace_id, is_replied, created_at DESC)
WHERE is_replied = false;

CREATE INDEX IF NOT EXISTS idx_comments_post_created 
ON comments(threads_post_id, created_at DESC);

-- auto_reply_rules: アクティブルールの高速検索
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_active_priority 
ON auto_reply_rules(workspace_id, is_active, priority DESC)
WHERE is_active = true;

-- reply_queue: キュー処理の最適化
CREATE INDEX IF NOT EXISTS idx_reply_queue_processing 
ON reply_queue(status, scheduled_at)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_reply_queue_workspace_status 
ON reply_queue(workspace_id, status, created_at DESC);

-- reply_pools: ランダム選択の高速化
CREATE INDEX IF NOT EXISTS idx_reply_pools_rule_active_weight 
ON reply_pools(rule_id, is_active, weight DESC)
WHERE is_active = true;

-- threads_accounts: アクティブアカウントの検索
CREATE INDEX IF NOT EXISTS idx_threads_accounts_workspace_active 
ON threads_accounts(workspace_id, is_active)
WHERE is_active = true;

-- media_uploads: メディア管理の最適化
CREATE INDEX IF NOT EXISTS idx_media_uploads_workspace_ready 
ON media_uploads(workspace_id, status, created_at DESC)
WHERE status = 'ready';

-- system_events: ログ検索の高速化
CREATE INDEX IF NOT EXISTS idx_system_events_workspace_type_time 
ON system_events(workspace_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_error_time 
ON system_events(severity, occurred_at DESC)
WHERE severity IN ('error', 'critical');

-- notification_queue: 通知処理の最適化
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending_scheduled 
ON notification_queue(status, scheduled_at)
WHERE status = 'pending';

-- 部分インデックス（特定条件での高速化）
-- ============================================

-- 未処理の予約投稿
CREATE INDEX IF NOT EXISTS idx_posts_unprocessed_scheduled 
ON posts(scheduled_at)
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- アクティブな自動返信ルール
CREATE INDEX IF NOT EXISTS idx_active_reply_rules 
ON auto_reply_rules(workspace_id, priority DESC)
WHERE is_active = true AND use_random_reply = true;

-- 失敗した返信キュー
CREATE INDEX IF NOT EXISTS idx_failed_reply_queue 
ON reply_queue(workspace_id, created_at DESC)
WHERE status = 'failed';

-- GINインデックス（JSON/配列検索用）
-- ============================================

-- JSONBフィールドの検索最適化
CREATE INDEX IF NOT EXISTS idx_posts_metadata_gin 
ON posts USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_system_events_metadata_gin 
ON system_events USING gin(metadata);

-- 配列フィールドの検索最適化
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_keywords_gin 
ON auto_reply_rules USING gin(trigger_keywords);

CREATE INDEX IF NOT EXISTS idx_reply_pools_media_urls_gin 
ON reply_pools USING gin(media_urls);

-- 統計情報の更新
-- ============================================

-- PostgreSQLの統計情報を更新して、クエリプランナーを最適化
ANALYZE posts;
ANALYZE comments;
ANALYZE auto_reply_rules;
ANALYZE reply_queue;
ANALYZE reply_pools;
ANALYZE threads_accounts;
ANALYZE system_events;
ANALYZE notification_queue;

-- ビューの作成（よく使うクエリの最適化）
-- ============================================

-- アクティブな投稿統計ビュー
CREATE OR REPLACE VIEW v_active_post_stats AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_count,
    COUNT(CASE WHEN p.status = 'scheduled' THEN 1 END) as scheduled_count,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count,
    COUNT(CASE WHEN p.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d_count
FROM workspaces w
LEFT JOIN posts p ON w.id = p.workspace_id
GROUP BY w.id, w.name;

-- 自動返信パフォーマンスビュー
CREATE OR REPLACE VIEW v_reply_performance AS
SELECT 
    r.workspace_id,
    r.id as rule_id,
    r.name as rule_name,
    COUNT(DISTINCT c.id) as total_comments,
    COUNT(DISTINCT CASE WHEN c.is_replied THEN c.id END) as replied_comments,
    COUNT(DISTINCT q.id) as queued_replies,
    COUNT(DISTINCT CASE WHEN q.status = 'completed' THEN q.id END) as successful_replies,
    COUNT(DISTINCT CASE WHEN q.status = 'failed' THEN q.id END) as failed_replies,
    AVG(EXTRACT(EPOCH FROM (q.processed_at - q.created_at))) as avg_reply_time_seconds
FROM auto_reply_rules r
LEFT JOIN comments c ON c.matched_rule_id = r.id
LEFT JOIN reply_queue q ON q.rule_id = r.id
WHERE r.is_active = true
GROUP BY r.workspace_id, r.id, r.name;

-- マテリアライズドビュー（重い集計の高速化）
-- ============================================

-- 日次統計のマテリアライズドビュー
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats AS
SELECT 
    workspace_id,
    DATE(created_at) as date,
    COUNT(*) as total_posts,
    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_posts
FROM posts
GROUP BY workspace_id, DATE(created_at);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_mv_daily_stats_workspace_date 
ON mv_daily_stats(workspace_id, date DESC);

-- リフレッシュ関数
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats;
END;
$$ LANGUAGE plpgsql;

-- 定期的なリフレッシュのためのトリガー設定（必要に応じて）
-- Supabaseのpg_cronを使用する場合：
-- SELECT cron.schedule('refresh-mv-daily-stats', '0 1 * * *', 'SELECT refresh_materialized_views();');