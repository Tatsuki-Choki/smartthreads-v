-- ====================================
-- 投稿テーブルにメディア関連カラムを追加
-- 作成日: 2025-08-13
-- 目的: 画像、動画、カルーセル投稿をサポート
-- ====================================

-- postsテーブルにメディア関連カラムを追加
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'TEXT' CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS carousel_items JSONB DEFAULT '[]'::jsonb;

-- インデックスの追加
CREATE INDEX IF NOT EXISTS idx_posts_media_type ON posts(media_type);

-- コメント追加
COMMENT ON COLUMN posts.media_type IS '投稿タイプ: TEXT(テキストのみ), IMAGE(画像付き), VIDEO(動画付き), CAROUSEL(カルーセル)';
COMMENT ON COLUMN posts.media_urls IS 'メディアファイルのURL配列';
COMMENT ON COLUMN posts.carousel_items IS 'カルーセル投稿の各アイテム情報（JSON配列）';

-- ====================================
-- 完了ログ
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE 'メディア関連カラムの追加完了';
    RAISE NOTICE '======================================';
    RAISE NOTICE '追加されたカラム:';
    RAISE NOTICE '  - media_type (投稿タイプ)';
    RAISE NOTICE '  - media_urls (メディアURL配列)';
    RAISE NOTICE '  - carousel_items (カルーセルアイテム)';
    RAISE NOTICE '';
    RAISE NOTICE '完了時刻: %', NOW();
    RAISE NOTICE '======================================';
END $$;