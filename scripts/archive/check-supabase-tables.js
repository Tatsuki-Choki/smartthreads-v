const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('🔍 Supabaseのテーブル構造を確認中...\n');

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
        console.log(`❌ ${table}: テーブルが存在しません`);
      } else {
        console.log(`✅ ${table}: テーブルが存在します`);
      }
    } catch (err) {
      console.log(`❌ ${table}: エラー - ${err.message}`);
    }
  }

  // RLSの状態を確認
  console.log('\n🔒 Row Level Security (RLS)の状態を確認中...\n');
  
  const { data: rlsStatus, error: rlsError } = await supabase.rpc('get_rls_status', {});
  
  if (rlsError) {
    console.log('RLS状態の取得に失敗（関数が存在しない可能性があります）');
  } else if (rlsStatus) {
    console.log('RLS状態:', rlsStatus);
  }

  console.log('\n📊 現在のSupabaseプロジェクト:');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
}

checkTables().catch(console.error);