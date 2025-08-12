-- postsテーブルのスレッド投稿フィールドが不足しているため追加
-- CLAUDE.mdに記載された設計仕様に基づく

DO $$ 
BEGIN
    -- parent_post_id: 存在確認してから追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'parent_post_id'
    ) THEN
        ALTER TABLE posts ADD COLUMN parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
    END IF;

    -- thread_root_id: 存在確認してから追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'thread_root_id'
    ) THEN
        ALTER TABLE posts ADD COLUMN thread_root_id UUID REFERENCES posts(id) ON DELETE SET NULL;
    END IF;

    -- thread_position: 存在確認してから追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'thread_position'
    ) THEN
        ALTER TABLE posts ADD COLUMN thread_position INTEGER DEFAULT 0;
    END IF;
END $$;

-- 新しいインデックスを追加（存在しない場合のみ）
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_root_id ON posts(thread_root_id);