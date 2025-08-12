const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function createTablesSequentially() {
  console.log('🚀 テーブル作成を開始します\n');

  // 1. Usersテーブル
  console.log('📝 1/4: usersテーブルを作成中...');
  try {
    // Supabase JavaScriptクライアントは管理者権限でも直接DDL実行できないため
    // テーブルの存在確認のみ行う
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log('❌ usersテーブルが存在しません - 手動作成が必要です');
    } else if (!error) {
      console.log('✅ usersテーブルは既に存在します');
    }
  } catch (e) {
    console.log('⚠️ usersテーブルの確認に失敗');
  }

  // 2. auto_reply_rulesテーブル
  console.log('📝 2/4: auto_reply_rulesテーブルを作成中...');
  try {
    const { data, error } = await supabase.from('auto_reply_rules').select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log('❌ auto_reply_rulesテーブルが存在しません - 手動作成が必要です');
    } else if (!error) {
      console.log('✅ auto_reply_rulesテーブルは既に存在します');
    }
  } catch (e) {
    console.log('⚠️ auto_reply_rulesテーブルの確認に失敗');
  }

  // 3. commentsテーブル
  console.log('📝 3/4: commentsテーブルを作成中...');
  try {
    const { data, error } = await supabase.from('comments').select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log('❌ commentsテーブルが存在しません - 手動作成が必要です');
    } else if (!error) {
      console.log('✅ commentsテーブルは既に存在します');
    }
  } catch (e) {
    console.log('⚠️ commentsテーブルの確認に失敗');
  }

  // 4. event_logsテーブル
  console.log('📝 4/4: event_logsテーブルを作成中...');
  try {
    const { data, error } = await supabase.from('event_logs').select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log('❌ event_logsテーブルが存在しません - 手動作成が必要です');
    } else if (!error) {
      console.log('✅ event_logsテーブルは既に存在します');
    }
  } catch (e) {
    console.log('⚠️ event_logsテーブルの確認に失敗');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 マイグレーション実行方法\n');
  console.log('Supabase JavaScriptクライアントではDDL操作ができないため、');
  console.log('以下のいずれかの方法でマイグレーションを実行してください：\n');
  
  console.log('【方法1】ブラウザで実行（推奨）');
  console.log('1. Supabase Dashboardを開く:');
  console.log('   https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor\n');
  console.log('2. SQL Editorで以下のファイルの内容を実行:');
  console.log('   - /supabase/migrations/20250112_add_missing_tables.sql');
  console.log('   - /supabase/migrations/20250112_rls_policies.sql\n');
  
  console.log('【方法2】簡易版SQLを実行');
  console.log('以下のSQLをSQL Editorにコピー＆ペーストして実行:\n');
  
  const simpleSql = `
-- 1. Usersテーブル
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 自動返信ルール
CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_account_id UUID REFERENCES threads_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL,
  reply_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. コメント
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  threads_comment_id TEXT UNIQUE,
  threads_user_id TEXT,
  username TEXT,
  content TEXT,
  replied BOOLEAN DEFAULT false,
  reply_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. イベントログ
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;`;

  console.log(simpleSql);
  console.log('\n' + '='.repeat(60));
}

createTablesSequentially().catch(console.error);