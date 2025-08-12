require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

// プロジェクトIDを抽出
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      }
    });
    
    // まず接続確認
    if (response.ok) {
      console.log('✅ Supabase接続確認OK');
    }
    
    // SQL実行用のエンドポイントを使用
    const sqlResponse = await fetch(`https://${projectId}.supabase.co/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    if (!sqlResponse.ok) {
      const errorText = await sqlResponse.text();
      console.log(`⚠️ SQL実行エラー（無視可能）: ${errorText}`);
    }
    
    return sqlResponse.ok;
  } catch (error) {
    console.log(`⚠️ 実行エラー: ${error.message}`);
    return false;
  }
}

async function createTables() {
  console.log('🚀 テーブル作成開始\n');

  // 1. Users テーブル
  console.log('📝 usersテーブルを作成中...');
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT auth.uid(),
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Auto Reply Rules テーブル
  console.log('📝 auto_reply_rulesテーブルを作成中...');
  await executeSQL(`
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
  `);

  // 3. Comments テーブル
  console.log('📝 commentsテーブルを作成中...');
  await executeSQL(`
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
  `);

  // 4. Event Logs テーブル
  console.log('📝 event_logsテーブルを作成中...');
  await executeSQL(`
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
  `);

  console.log('\n✨ テーブル作成処理完了');
  console.log('\n⚠️ 重要: Supabase Dashboardで手動でSQLを実行することを推奨します');
  console.log('📎 Dashboard URL: https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor');
  console.log('\n以下のファイルの内容をSQL Editorで実行してください:');
  console.log('1. /supabase/migrations/20250112_add_missing_tables.sql');
  console.log('2. /supabase/migrations/20250112_rls_policies.sql');
}

createTables().catch(console.error);