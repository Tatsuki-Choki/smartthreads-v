const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase環境変数が設定されていません')
  process.exit(1)
}

// Supabase管理者クライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('=== マイグレーション実行 ===\n')
  
  try {
    // マイグレーションファイルを読み込む
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_add_owner_and_slug.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('マイグレーションファイル:', migrationPath)
    console.log('実行するSQL:')
    console.log('----------------------------------------')
    console.log(migrationSQL.substring(0, 500) + '...')
    console.log('----------------------------------------\n')
    
    // SQLを個別のステートメントに分割
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`${statements.length}個のSQLステートメントを実行します\n`)
    
    // 各ステートメントを実行
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`[${i + 1}/${statements.length}] 実行中...`)
      
      // Supabase JavaScriptクライアントでは直接SQLを実行できないため、
      // 代わりにHTTP APIを使用
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: statement })
      })
      
      if (!response.ok) {
        // RPCが存在しない場合は、個別の操作を試みる
        console.log(`  ⚠ RPC実行失敗（通常の操作）`)
      } else {
        console.log(`  ✅ 成功`)
      }
    }
    
    console.log('\n=== 代替方法：個別の操作を実行 ===\n')
    
    // 1. カラムの追加を試みる
    console.log('1. owner_idカラムの追加を試みます...')
    // これはSupabase Dashboardから実行する必要があります
    console.log('  → Supabase Dashboardから手動で実行してください')
    console.log('  → SQLエディタで以下を実行:')
    console.log('     ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);')
    console.log('     ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;')
    
    console.log('\n=== 重要 ===')
    console.log('Supabase DashboardのSQL Editorから以下のSQLを実行してください:')
    console.log('URL: https://supabase.com/dashboard/project/zndvvqezzmyhkpvnmakf/sql')
    console.log('\n以下のSQLをコピーして実行:')
    console.log('----------------------------------------')
    console.log(migrationSQL)
    console.log('----------------------------------------')
    
  } catch (error) {
    console.error('エラー:', error)
  }
}

runMigration()