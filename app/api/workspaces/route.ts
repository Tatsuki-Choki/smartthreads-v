import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ワークスペース一覧取得
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    // ユーザーがメンバーのワークスペース一覧を取得
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        created_at,
        workspace_members!inner (
          role,
          created_at
        )
      `)
      .eq('workspace_members.user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('ワークスペース取得エラー:', error)
      return NextResponse.json(
        { error: 'ワークスペースの取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error('ワークスペースAPI エラー:', error)
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 }
    )
  }
}

// ワークスペース作成
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const { name } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'ワークスペース名が必要です' },
        { status: 400 }
      )
    }

    // ワークスペースを作成
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
      })
      .select()
      .single()

    if (workspaceError) {
      console.error('ワークスペース作成エラー:', workspaceError)
      return NextResponse.json(
        { error: 'ワークスペースの作成に失敗しました' },
        { status: 500 }
      )
    }

    // 作成者をオーナーとして追加
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('ワークスペースメンバー作成エラー:', memberError)
      // ワークスペースを削除してロールバック
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      return NextResponse.json(
        { error: 'ワークスペースの作成に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workspace })
  } catch (error) {
    console.error('ワークスペース作成 API エラー:', error)
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 }
    )
  }
}