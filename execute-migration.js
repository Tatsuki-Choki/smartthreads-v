#!/usr/bin/env node

/**
 * データベースマイグレーション実行スクリプト
 * postsテーブルにメディア関連カラムを追加
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase Admin クライアントを作成
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function executeMigration() {
  console.log('=====================================');
  console.log('メディアカラム追加マイグレーション実行');
  console.log('=====================================\n');

  try {
    // まず現在のテーブル構造を確認
    console.log('1. 現在のpostsテーブル構造を確認...');
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .limit(0);

    if (columnsError) {
      console.error('❌ テーブル構造確認エラー:', columnsError);
      return;
    }

    console.log('✅ postsテーブルが存在します');

    // SQLを実行
    console.log('\n2. マイグレーションSQLを実行...');
    
    const migrationSQL = `
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
    `;

    const { data, error } = await supabaseAdmin.rpc('execute_sql', { 
      sql: migrationSQL 
    });

    if (error) {
      // RPCが存在しない場合は、直接テーブルを更新
      console.log('⚠️ execute_sql RPCが存在しません。代替方法を試みます...');
      
      // テスト用に1行挿入してカラムの存在を確認
      const testData = {
        workspace_id: '00000000-0000-0000-0000-000000000000',
        threads_account_id: '00000000-0000-0000-0000-000000000000',
        content: 'マイグレーションテスト',
        status: 'draft',
        media_type: 'TEXT',
        media_urls: [],
        carousel_items: []
      };

      const { data: testInsert, error: insertError } = await supabaseAdmin
        .from('posts')
        .insert(testData)
        .select();

      if (insertError) {
        if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
          console.log('❌ メディアカラムがまだ存在しません');
          console.log('   Supabase Studioで手動でマイグレーションを実行してください');
          console.log('\n手動実行手順:');
          console.log('1. http://localhost:54323 にアクセス');
          console.log('2. SQL Editorを開く');
          console.log('3. 以下のSQLを実行:');
          console.log('---');
          console.log(migrationSQL);
          console.log('---');
        } else {
          console.error('❌ テスト挿入エラー:', insertError);
        }
      } else {
        console.log('✅ メディアカラムは既に存在します！');
        
        // テストデータを削除
        if (testInsert && testInsert[0]) {
          await supabaseAdmin
            .from('posts')
            .delete()
            .eq('id', testInsert[0].id);
        }
      }
    } else {
      console.log('✅ マイグレーションSQL実行成功');
    }

    // 3. 結果を確認
    console.log('\n3. マイグレーション結果を確認...');
    
    // 新しいカラムでテストクエリを実行
    const { data: testQuery, error: queryError } = await supabaseAdmin
      .from('posts')
      .select('id, content, media_type, media_urls, carousel_items')
      .limit(1);

    if (queryError) {
      console.error('❌ 確認クエリエラー:', queryError);
      console.log('\nマイグレーションが完全に適用されていない可能性があります。');
    } else {
      console.log('✅ メディアカラムが正常に追加されました！');
      console.log('\n追加されたカラム:');
      console.log('  - media_type (投稿タイプ)');
      console.log('  - media_urls (メディアURL配列)');
      console.log('  - carousel_items (カルーセルアイテム)');
    }

    console.log('\n=====================================');
    console.log('マイグレーション処理完了');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    console.log('\nSupabase Studioで手動実行してください:');
    console.log('http://localhost:54323');
  }
}

// 実行
executeMigration();