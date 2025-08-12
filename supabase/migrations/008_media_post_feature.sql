-- メディア投稿機能の拡張
-- ============================================

-- postsテーブルにメディア関連カラムを追加
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
ADD COLUMN IF NOT EXISTS media_urls TEXT[],
ADD COLUMN IF NOT EXISTS media_metadata JSONB,
ADD COLUMN IF NOT EXISTS carousel_items JSONB[],
ADD COLUMN IF NOT EXISTS alt_text TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- メディアアップロード管理テーブル
CREATE TABLE IF NOT EXISTS media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    
    -- メディア情報
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    thumbnail_url TEXT,
    
    -- メタデータ
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER, -- 動画の場合
    metadata JSONB,
    
    -- 状態管理
    status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
    error_message TEXT,
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投稿テンプレートテーブル（定型投稿用）
CREATE TABLE IF NOT EXISTS post_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    
    -- テンプレート情報
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    
    -- コンテンツ
    content TEXT NOT NULL,
    media_type TEXT CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
    media_urls TEXT[],
    carousel_items JSONB[],
    variables JSONB, -- {variable_name: default_value}
    
    -- 設定
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 繰り返し投稿スケジュールテーブル
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    
    -- スケジュール情報
    name TEXT NOT NULL,
    description TEXT,
    
    -- 繰り返し設定
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
    interval_value INTEGER DEFAULT 1, -- 例: 3日ごと、2週間ごと
    days_of_week INTEGER[], -- 0=日曜, 1=月曜...6=土曜
    days_of_month INTEGER[], -- 1-31
    time_of_day TIME NOT NULL,
    timezone TEXT DEFAULT 'Asia/Tokyo',
    
    -- コンテンツ設定
    template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL,
    content_pattern TEXT, -- 変数を含むパターン
    rotate_content BOOLEAN DEFAULT false,
    content_pool JSONB[], -- ローテーション用コンテンツプール
    
    -- 期間設定
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- 状態
    is_active BOOLEAN DEFAULT true,
    last_execution_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投稿下書きテーブル
CREATE TABLE IF NOT EXISTS post_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    
    -- 下書き内容
    title TEXT,
    content TEXT NOT NULL,
    media_type TEXT CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
    media_urls TEXT[],
    carousel_items JSONB[],
    
    -- メタデータ
    tags TEXT[],
    notes TEXT,
    version INTEGER DEFAULT 1,
    
    -- 状態
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, title)
);

-- RLSポリシー追加
-- ============================================

-- media_uploads
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_uploads_workspace_isolation" ON media_uploads
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- post_templates
ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_templates_workspace_isolation" ON post_templates
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- recurring_schedules
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_schedules_workspace_isolation" ON recurring_schedules
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- post_drafts
ALTER TABLE post_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_drafts_workspace_isolation" ON post_drafts
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- 便利な関数
-- ============================================

-- 次回実行時刻を計算する関数
CREATE OR REPLACE FUNCTION calculate_next_execution(
    p_schedule_id UUID
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_schedule RECORD;
    v_next_execution TIMESTAMPTZ;
    v_current_time TIMESTAMPTZ;
BEGIN
    -- スケジュール情報を取得
    SELECT * INTO v_schedule
    FROM recurring_schedules
    WHERE id = p_schedule_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- 現在時刻（タイムゾーン考慮）
    v_current_time := NOW() AT TIME ZONE v_schedule.timezone;
    
    -- 最後の実行時刻がない場合は開始日時を基準にする
    IF v_schedule.last_execution_at IS NULL THEN
        v_next_execution := v_schedule.start_date + v_schedule.time_of_day;
    ELSE
        -- 頻度に応じて次回実行時刻を計算
        CASE v_schedule.frequency
            WHEN 'daily' THEN
                v_next_execution := v_schedule.last_execution_at + INTERVAL '1 day' * v_schedule.interval_value;
            WHEN 'weekly' THEN
                v_next_execution := v_schedule.last_execution_at + INTERVAL '1 week' * v_schedule.interval_value;
            WHEN 'monthly' THEN
                v_next_execution := v_schedule.last_execution_at + INTERVAL '1 month' * v_schedule.interval_value;
            ELSE
                -- カスタムロジック
                v_next_execution := v_schedule.last_execution_at + INTERVAL '1 day';
        END CASE;
    END IF;
    
    -- 終了日を超えていないか確認
    IF v_schedule.end_date IS NOT NULL AND v_next_execution > v_schedule.end_date + v_schedule.time_of_day THEN
        RETURN NULL;
    END IF;
    
    RETURN v_next_execution;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- メディアアップロード完了処理
CREATE OR REPLACE FUNCTION process_media_upload(
    p_upload_id UUID,
    p_public_url TEXT,
    p_metadata JSONB
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE media_uploads
    SET 
        status = 'ready',
        public_url = p_public_url,
        metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata,
        updated_at = NOW()
    WHERE id = p_upload_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- インデックス追加
-- ============================================

CREATE INDEX IF NOT EXISTS idx_media_uploads_workspace ON media_uploads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_status ON media_uploads(status);
CREATE INDEX IF NOT EXISTS idx_post_templates_workspace ON post_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_post_templates_active ON post_templates(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_workspace ON recurring_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_execution ON recurring_schedules(next_execution_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_post_drafts_workspace ON post_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_post_drafts_status ON post_drafts(workspace_id, status);