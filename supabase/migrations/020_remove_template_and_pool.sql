-- ====================================
-- テンプレートと返信プール機能の削除
-- 作成日: 2025-08-12
-- 目的: 不要になったテンプレートと返信プール関連の機能を削除
-- ====================================

-- ====================================
-- 1. 外部キー制約を持つカラムの削除
-- ====================================

-- auto_reply_rulesテーブルからreply_template_id参照を削除
ALTER TABLE auto_reply_rules 
DROP COLUMN IF EXISTS reply_template_id;

-- ====================================
-- 2. 返信プール関連テーブルの削除
-- ====================================

-- reply_poolsテーブルが存在する場合は削除
DROP TABLE IF EXISTS reply_pools CASCADE;

-- reply_pool_itemsテーブルが存在する場合は削除
DROP TABLE IF EXISTS reply_pool_items CASCADE;

-- random_reply_poolsテーブルが存在する場合は削除
DROP TABLE IF EXISTS random_reply_pools CASCADE;

-- random_reply_itemsテーブルが存在する場合は削除  
DROP TABLE IF EXISTS random_reply_items CASCADE;

-- ====================================
-- 3. テンプレートテーブルの削除
-- ====================================

-- reply_templatesテーブルを削除
DROP TABLE IF EXISTS reply_templates CASCADE;

-- ====================================
-- 4. 関連インデックスの削除（既に削除されているが念のため）
-- ====================================

DROP INDEX IF EXISTS idx_reply_templates_workspace;
DROP INDEX IF EXISTS idx_reply_templates_active;
DROP INDEX IF EXISTS idx_reply_pools_workspace;
DROP INDEX IF EXISTS idx_random_reply_pools_workspace;

-- ====================================
-- 5. 関連する関数の削除（もしあれば）
-- ====================================

DROP FUNCTION IF EXISTS get_random_reply_from_pool(UUID);
DROP FUNCTION IF EXISTS process_template_variables(TEXT, JSONB);

-- ====================================
-- 完了ログ
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '======================================';
    RAISE NOTICE 'テンプレートと返信プール機能の削除完了';
    RAISE NOTICE '======================================';
    RAISE NOTICE '削除されたテーブル:';
    RAISE NOTICE '  - reply_templates';
    RAISE NOTICE '  - reply_pools（存在した場合）';
    RAISE NOTICE '  - reply_pool_items（存在した場合）';
    RAISE NOTICE '  - random_reply_pools（存在した場合）';
    RAISE NOTICE '  - random_reply_items（存在した場合）';
    RAISE NOTICE '';
    RAISE NOTICE '更新されたテーブル:';
    RAISE NOTICE '  - auto_reply_rules（reply_template_id カラムを削除）';
    RAISE NOTICE '';
    RAISE NOTICE '完了時刻: %', NOW();
    RAISE NOTICE '======================================';
END $$;