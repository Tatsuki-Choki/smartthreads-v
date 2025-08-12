const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration(filename, description) {
  console.log(`\n📝 実行中: ${description}`);
  console.log(`ファイル: ${filename}`);
  
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', filename),
      'utf-8'
    );

    // SQLを個別のステートメントに分割（簡易的な方法）
    const statements = sql
      .split(/;\s*$/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      // コメントのみの行はスキップ
      if (statement.match(/^--.*$/)) continue;
      
      try {
        // RPC経由でSQLを実行
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement
        }).catch(async (rpcError) => {
          // RPCが存在しない場合は、直接実行を試みる
          // 注: これは制限があるため、すべてのSQLが実行できるわけではない
          console.log('⚠️  RPC実行失敗、別の方法を試行中...');
          
          // 特定のクエリパターンを認識して処理
          if (statement.includes('CREATE TABLE')) {
            console.log('  テーブル作成クエリは手動実行が必要です');
            return { error: 'Manual execution required' };
          }
          
          return { error: rpcError };
        });

        if (error) {
          console.log(`  ⚠️  スキップ: ${error.message || error}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.log(`  ⚠️  エラー: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`  ✅ 完了: ${successCount}個成功, ${errorCount}個スキップ/エラー`);
    return true;
  } catch (error) {
    console.error(`  ❌ ファイル読み込みエラー: ${error.message}`);
    return false;
  }
}

async function executeSQLDirectly() {
  console.log('\n🔧 Supabase Dashboard経由での実行が必要です\n');
  
  const migrations = [
    {
      file: '20250112_add_missing_tables.sql',
      description: '不足しているテーブルの追加'
    },
    {
      file: '20250112_rls_policies.sql', 
      description: 'RLSポリシーの設定'
    }
  ];

  console.log('📋 以下のSQLファイルをSupabase Dashboardで実行してください：\n');
  console.log('1. Supabase Dashboardにアクセス:');
  console.log('   https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor\n');
  console.log('2. SQL Editorを開く\n');
  console.log('3. 以下のファイルの内容を順番にコピー＆ペーストして実行:\n');
  
  migrations.forEach((migration, index) => {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migration.file);
    console.log(`   ${index + 1}. ${migration.file}`);
    console.log(`      説明: ${migration.description}`);
    console.log(`      パス: ${filePath}\n`);
  });

  console.log('💡 ヒント: 各SQLファイルを開いて、内容をSQL Editorにコピー＆ペーストしてください。');
  console.log('   大きなSQLは複数のステートメントに分けて実行する必要がある場合があります。\n');

  // ファイルの内容を表示するオプション
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('SQLファイルの内容を表示しますか？ (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      migrations.forEach(migration => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📄 ${migration.file}`);
        console.log('='.repeat(60));
        try {
          const content = fs.readFileSync(
            path.join(__dirname, '..', 'supabase', 'migrations', migration.file),
            'utf-8'
          );
          console.log(content);
        } catch (err) {
          console.log(`エラー: ${err.message}`);
        }
      });
    }
    
    console.log('\n✨ 実行後、アプリケーションを再起動してください。');
    rl.close();
  });
}

// メイン実行
async function main() {
  console.log('🚀 Supabase マイグレーション実行ツール\n');
  console.log(`📊 対象プロジェクト: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);
  
  // Supabase CLIが使えないため、手動実行の案内を表示
  await executeSQLDirectly();
}

main().catch(console.error);