const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase環境変数が設定されていません')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkDatabase() {
  console.log('=== Supabaseデータベース状態確認 ===\n')
  
  try {
    // 1. 現在のテーブル一覧を確認
    console.log('1. 現在のテーブル一覧:')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      // 別の方法で試す
      const { data, error } = await supabase.rpc('get_tables', {})
      if (error) {
        console.log('  テーブル一覧の取得に失敗しました')
      } else {
        console.log('  ', data)
      }
    } else {
      tables?.forEach(t => console.log('  -', t.table_name))
    }
    
    // 2. workspacesテーブルの存在確認
    console.log('\n2. workspacesテーブルの確認:')
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1)
    
    if (wsError) {
      console.log('  ❌ workspacesテーブルが存在しません:', wsError.message)
      console.log('  → テーブルを作成する必要があります')
    } else {
      console.log('  ✅ workspacesテーブルが存在します')
      const { count } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
      console.log('  レコード数:', count || 0)
    }
    
    // 3. workspace_membersテーブルの確認
    console.log('\n3. workspace_membersテーブルの確認:')
    const { data: members, error: memError } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(1)
    
    if (memError) {
      console.log('  ❌ workspace_membersテーブルが存在しません:', memError.message)
      console.log('  → テーブルを作成する必要があります')
    } else {
      console.log('  ✅ workspace_membersテーブルが存在します')
    }
    
    // 4. threads_accountsテーブルの確認
    console.log('\n4. threads_accountsテーブルの確認:')
    const { data: threads, error: thError } = await supabase
      .from('threads_accounts')
      .select('*')
      .limit(1)
    
    if (thError) {
      console.log('  ❌ threads_accountsテーブルが存在しません:', thError.message)
    } else {
      console.log('  ✅ threads_accountsテーブルが存在します')
    }
    
    // 5. ユーザー一覧の確認
    console.log('\n5. 登録ユーザー:')
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      console.log('  ユーザー一覧の取得に失敗しました')
    } else {
      users?.forEach(u => {
        console.log(`  - ${u.email} (ID: ${u.id})`)
      })
    }
    
  } catch (error) {
    console.error('エラー:', error)
  }
}

checkDatabase()