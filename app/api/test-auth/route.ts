import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// このAPIは開発/検証用途です。本番では無効化します。
function blockInProduction() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
  return null
}

// Service Roleクライアントを作成（管理者権限）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// テスト用認証状態確認API
export async function GET(request: NextRequest) {
  const blocked = blockInProduction()
  if (blocked) return blocked
  try {
    // ユーザー一覧を取得
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json({
        error: 'ユーザー一覧取得エラー',
        details: usersError.message
      })
    }
    
    return NextResponse.json({
      totalUsers: users?.length || 0,
      users: users?.map(u => ({
        id: u.id,
        email: u.email,
        confirmed: u.email_confirmed_at ? true : false,
        created: u.created_at
      })) || []
    })
  } catch (error) {
    return NextResponse.json({
      error: '認証状態の確認に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// テスト用ユーザー作成API
export async function POST(request: NextRequest) {
  const blocked = blockInProduction()
  if (blocked) return blocked
  try {
    const { email, password } = await request.json()
    
    // ユーザーを作成（メール確認をスキップ）
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // メール確認を自動的に完了
    })
    
    if (error) {
      return NextResponse.json({
        error: 'ユーザー作成エラー',
        details: error.message
      })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        confirmed: true
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'ユーザー作成に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
