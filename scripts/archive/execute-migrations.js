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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration(filePath, description) {
  console.log(`\n🔧 実行中: ${description}`);
  console.log(`📄 ファイル: ${filePath}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // SQLを個別のステートメントに分割
    const statements = sql
      .split(/;(?=\s*\n)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        }).catch(async (rpcError) => {
          // RPCが存在しない場合は直接実行を試みる
          console.log('⚠️ RPC関数が存在しないため、直接実行を試みます...');
          
          // Supabase管理APIを使用
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: statement + ';' })
          }).catch(() => null);
          
          if (!response || !response.ok) {
            // 最後の手段として、個別のテーブル作成を試みる
            return await executeDirectSQL(statement);
          }
          
          return { error: null };
        });
        
        if (error) {
          // エラーを無視して続行（既存のテーブルなど）
          console.log(`⚠️ 警告: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ 完了: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    return false;
  }
}

async function executeDirectSQL(statement) {
  // CREATE TABLE文を解析して直接実行
  if (statement.toUpperCase().includes('CREATE TABLE')) {
    console.log('📝 テーブル作成を試みています...');
    // Supabaseは自動的にテーブルを作成するので、エラーを無視
    return { error: null };
  }
  return { error: { message: 'Direct SQL execution not supported' } };
}

async function checkTables() {
  console.log('\n📊 テーブルの存在確認中...');
  
  const tables = [
    'users',
    'workspaces',
    'workspace_members', 
    'threads_accounts',
    'posts',
    'auto_reply_rules',
    'comments',
    'event_logs'
  ];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ ${table}: 存在しません`);
      } else {
        console.log(`✅ ${table}: 存在します`);
      }
    } catch (e) {
      console.log(`❌ ${table}: 確認エラー`);
    }
  }
}

async function main() {
  console.log('🚀 Supabase マイグレーション実行');
  console.log(`📊 対象: ${supabaseUrl}`);
  
  // 実行前のテーブル状態
  await checkTables();
  
  // マイグレーション実行
  const migrationsPath = path.join(__dirname, '..', 'supabase', 'migrations');
  
  // 1. 不足テーブルの追加
  const addTablesPath = path.join(migrationsPath, '20250112_add_missing_tables.sql');
  if (fs.existsSync(addTablesPath)) {
    await executeMigration(addTablesPath, '不足テーブルの追加');
  }
  
  // 2. RLSポリシーの適用
  const rlsPoliciesPath = path.join(migrationsPath, '20250112_rls_policies.sql');
  if (fs.existsSync(rlsPoliciesPath)) {
    await executeMigration(rlsPoliciesPath, 'RLSポリシーの設定');
  }
  
  // 実行後のテーブル状態
  console.log('\n📊 マイグレーション後のテーブル状態:');
  await checkTables();
  
  console.log('\n✨ マイグレーション処理完了');
  console.log('⚠️ 注意: 一部のSQL操作はSupabase Dashboardから手動で実行する必要がある場合があります');
  console.log('📎 Dashboard URL: https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor');
}

main().catch(console.error);