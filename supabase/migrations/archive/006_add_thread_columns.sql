-- ツリー投稿機能用のカラムをpostsテーブルに追加

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES posts(id),
ADD COLUMN IF NOT EXISTS thread_root_id UUID REFERENCES posts(id),
ADD COLUMN IF NOT EXISTS thread_position INTEGER DEFAULT 0;

-- インデックスを追加してパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_root_id ON posts(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_position ON posts(thread_root_id, thread_position);