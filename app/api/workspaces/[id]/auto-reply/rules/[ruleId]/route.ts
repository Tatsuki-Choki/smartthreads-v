import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// PUT: ルールを更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id
  const ruleId = params.ruleId

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
    const { keyword, reply_message, is_active } = body

    // ルールを更新
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (keyword !== undefined) updateData.keyword = keyword
    if (reply_message !== undefined) updateData.reply_message = reply_message
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: rule, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .update(updateData)
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('ルール更新エラー:', error)
      return NextResponse.json({ error: 'ルールの更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('ルール更新エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

// DELETE: ルールを削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  const supabase = createServerSupabaseClient()
  const workspaceId = params.id
  const ruleId = params.ruleId

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

    // ルールを削除
    const { error } = await supabaseAdmin
      .from('auto_reply_rules')
      .delete()
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('ルール削除エラー:', error)
      return NextResponse.json({ error: 'ルールの削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ルール削除エラー:', error)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}