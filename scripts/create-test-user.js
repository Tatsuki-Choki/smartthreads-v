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

async function createTestUser() {
  try {
    console.log('テストユーザー作成開始...')
    
    // 既存ユーザーの確認
    const { data: existingUser, error: fetchError } = await supabase.auth.admin.getUserById('test@example.com').catch(() => ({ data: null, error: null }))
    
    if (existingUser) {
      console.log('テストユーザーは既に存在します')
      return
    }

    // テストユーザーを作成（メール確認をスキップ）
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test123456',
      email_confirm: true, // メール確認済みとして作成
      user_metadata: {
        name: 'Test User'
      }
    })

    if (error) {
      console.error('ユーザー作成エラー:', error)
      return
    }

    console.log('テストユーザー作成成功!')
    console.log('Email: test@example.com')
    console.log('Password: test123456')
    console.log('User ID:', data.user.id)
    
  } catch (error) {
    console.error('予期しないエラー:', error)
  }
}

createTestUser()