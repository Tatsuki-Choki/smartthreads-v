-- ツリー投稿機能のためのフィールドを追加

-- postsテーブルにツリー投稿用のフィールドを追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id uuid;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thread_root_id uuid;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thread_position integer DEFAULT 0;

-- 外部キー制約を追加（親投稿は同じテーブル内の投稿を参照）
ALTER TABLE posts ADD CONSTRAINT fk_posts_parent_post_id 
  FOREIGN KEY (parent_post_id) REFERENCES posts(id) ON DELETE SET NULL;

-- スレッドルートは同じテーブル内の投稿（スレッドの最初の投稿）を参照
ALTER TABLE posts ADD CONSTRAINT fk_posts_thread_root_id 
  FOREIGN KEY (thread_root_id) REFERENCES posts(id) ON DELETE SET NULL;

-- インデックスを追加してパフォーマンス向上
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_root_id ON posts(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_position ON posts(thread_position);

-- RLS ポリシーの更新は不要（既存のワークスペースベースのポリシーが適用される）