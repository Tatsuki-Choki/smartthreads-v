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

async function setupWorkspace() {
  console.log('=== テスト用ワークスペースのセットアップ ===\n')
  
  try {
    // テストユーザーのIDを取得
    const testUserEmail = 'test@example.com'
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('ユーザー一覧の取得に失敗:', usersError)
      return
    }
    
    const testUser = users?.find(u => u.email === testUserEmail)
    if (!testUser) {
      console.error('テストユーザーが見つかりません')
      return
    }
    
    console.log('テストユーザー:', testUser.email, '(ID:', testUser.id, ')')
    
    // 既存のワークスペースを確認
    const { data: existingWorkspaces, error: checkError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', testUser.id)
    
    if (checkError) {
      console.error('ワークスペース確認エラー:', checkError)
      return
    }
    
    if (existingWorkspaces && existingWorkspaces.length > 0) {
      console.log('\n既存のワークスペースが見つかりました:')
      existingWorkspaces.forEach(ws => {
        console.log(`  - ${ws.name} (ID: ${ws.id})`)
      })
      return
    }
    
    // ワークスペースを作成
    console.log('\n新しいワークスペースを作成中...')
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: 'テストワークスペース',
        slug: 'test-workspace',
        owner_id: testUser.id
      })
      .select()
      .single()
    
    if (wsError) {
      console.error('ワークスペース作成エラー:', wsError)
      return
    }
    
    console.log('✅ ワークスペース作成成功:', workspace.name, '(ID:', workspace.id, ')')
    
    // ワークスペースメンバーシップを作成
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: testUser.id,
        role: 'owner'
      })
    
    if (memberError) {
      console.error('メンバーシップ作成エラー:', memberError)
      // ワークスペースを削除
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      return
    }
    
    console.log('✅ メンバーシップ作成成功')
    
    console.log('\n=== セットアップ完了 ===')
    console.log('テストユーザー:', testUserEmail)
    console.log('パスワード: test123456')
    console.log('ワークスペース:', workspace.name)
    
  } catch (error) {
    console.error('予期しないエラー:', error)
  }
}

setupWorkspace()