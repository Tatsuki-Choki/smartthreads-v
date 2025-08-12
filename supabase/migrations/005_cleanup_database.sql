-- データベースの細かい問題を解消するマイグレーション
-- 1. 重複ポリシーの削除
-- 2. 重複外部キー制約の削除  
-- 3. threads_accountsテーブルの拡張

-- ====================================
-- フェーズ1: 重複ポリシーの削除
-- ====================================

-- workspace_membersテーブルの重複INSERTポリシーを削除
DROP POLICY IF EXISTS "Users can insert themselves as workspace members" ON workspace_members;

-- 重複SELECTポリシーがあるかチェックして削除（あれば）
DROP POLICY IF EXISTS "Users can view workspace members of their workspaces" ON workspace_members;

-- ====================================
-- フェーズ2: 重複外部キー制約の削除
-- ====================================

-- postsテーブルの重複外部キー制約を削除
ALTER TABLE posts DROP CONSTRAINT IF EXISTS "fk_posts_parent_post_id";
ALTER TABLE posts DROP CONSTRAINT IF EXISTS "fk_posts_thread_root_id";

-- ====================================  
-- フェーズ3: threads_accountsテーブルの拡張
-- ====================================

-- threads_accountsテーブルに不足しているフィールドを追加
DO $$ 
BEGIN
    -- display_name: 表示名
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'threads_accounts' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE threads_accounts ADD COLUMN display_name TEXT;
    END IF;

    -- profile_picture_url: プロフィール画像URL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'threads_accounts' AND column_name = 'profile_picture_url'
    ) THEN
        ALTER TABLE threads_accounts ADD COLUMN profile_picture_url TEXT;
    END IF;

    -- status: アカウント状態
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'threads_accounts' AND column_name = 'status'
    ) THEN
        ALTER TABLE threads_accounts ADD COLUMN status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'invalid', 'error', 'suspended'));
    END IF;

    -- expires_at: トークン有効期限
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'threads_accounts' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE threads_accounts ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- threads_accountsテーブルの新しいインデックス追加
CREATE INDEX IF NOT EXISTS idx_threads_accounts_status ON threads_accounts(status);
CREATE INDEX IF NOT EXISTS idx_threads_accounts_expires_at ON threads_accounts(expires_at) WHERE expires_at IS NOT NULL;

-- ====================================
-- フェーズ4: データ整合性の向上
-- ====================================

-- 既存のアクティブなアカウントのstatusをactiveに設定
UPDATE threads_accounts 
SET status = 'active' 
WHERE status IS NULL;

-- ====================================
-- 完了ログ
-- ====================================

-- 修正完了のログ出力
DO $$
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE 'データベースクリーンアップ完了';
    RAISE NOTICE '======================================';
    RAISE NOTICE '重複ポリシー削除: 完了';
    RAISE NOTICE '重複外部キー制約削除: 完了';
    RAISE NOTICE 'threads_accountsテーブル拡張: 完了';
    RAISE NOTICE '完了時刻: %', NOW();
    RAISE NOTICE '======================================';
END $$;