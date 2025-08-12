-- ====================================
-- メディアアップロード管理テーブルの作成
-- 作成日: 2025-08-13
-- 目的: アップロードされたメディアファイルの管理
-- ====================================

-- media_uploadsテーブルの作成
CREATE TABLE IF NOT EXISTS media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    public_url TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'media',
    media_type TEXT DEFAULT 'threads', -- threads, avatar, cover, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_media_uploads_user ON media_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_workspace ON media_uploads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_created_at ON media_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_uploads_media_type ON media_uploads(media_type);

-- RLSを有効化
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のアップロードを管理できる
CREATE POLICY "Users can manage their own uploads" ON media_uploads
FOR ALL USING (user_id = auth.uid());

-- RLSポリシー: ワークスペースメンバーはワークスペースのアップロードを閲覧できる
CREATE POLICY "Workspace members can view workspace uploads" ON media_uploads
FOR SELECT USING (
    workspace_id IS NULL OR
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- updated_atの自動更新トリガー
CREATE TRIGGER update_media_uploads_updated_at 
    BEFORE UPDATE ON media_uploads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- Storageバケットの設定（手動で実行が必要）
-- ====================================
-- 注意: Supabase StorageのバケットはSQLでは作成できません。
-- Supabaseダッシュボードから以下の設定で作成してください：
-- 
-- 1. バケット名: media
-- 2. Public: Yes（公開バケット）
-- 3. File size limit: 10MB
-- 4. Allowed MIME types: image/*, video/mp4, video/quicktime

-- ====================================
-- 完了ログ
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE 'メディアアップロードテーブルの作成完了';
    RAISE NOTICE '======================================';
    RAISE NOTICE '作成されたテーブル:';
    RAISE NOTICE '  - media_uploads';
    RAISE NOTICE '';
    RAISE NOTICE 'RLSポリシー:';
    RAISE NOTICE '  - ユーザー自身のアップロード管理';
    RAISE NOTICE '  - ワークスペースメンバーの閲覧権限';
    RAISE NOTICE '';
    RAISE NOTICE '重要: Supabaseダッシュボードから';
    RAISE NOTICE '      "media"バケットを作成してください';
    RAISE NOTICE '';
    RAISE NOTICE '完了時刻: %', NOW();
    RAISE NOTICE '======================================';
END $$;