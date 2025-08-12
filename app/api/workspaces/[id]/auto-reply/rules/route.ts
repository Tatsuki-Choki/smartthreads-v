import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET: 自動返信ルール一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id

  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // ワークスペースメンバーかチェック
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // 自動返信ルールを取得
    const { data: rules, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('自動返信ルール取得エラー:', error)
      return NextResponse.json({ error: 'ルールの取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (error) {
    console.error('自動返信ルール取得エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

// POST: 新規ルール作成
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id

  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // ワークスペースメンバーかチェック
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    const { keyword, reply_message, is_active = true } = body

    if (!keyword || !reply_message) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // ルールを作成
    const { data: rule, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .insert({
        workspace_id: workspaceId,
        keyword,
        reply_message,
        is_active
      })
      .select()
      .single()

    if (error) {
      console.error('ルール作成エラー:', error)
      return NextResponse.json({ error: 'ルールの作成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('ルール作成エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}