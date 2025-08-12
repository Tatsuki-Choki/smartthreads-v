const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (\!supabaseUrl || \!supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('📊 workspacesテーブルの構造を確認中...\n');
  
  try {
    // workspacesテーブルから1行取得してカラムを確認
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('エラー:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('workspacesテーブルのカラム:');
      console.log(Object.keys(data[0]));
      console.log('\nサンプルデータ:');
      console.log(data[0]);
    } else {
      console.log('workspacesテーブルは存在しますが、データがありません');
    }
    
  } catch (e) {
    console.error('予期しないエラー:', e);
  }
}

checkTableStructure();
EOF < /dev/null