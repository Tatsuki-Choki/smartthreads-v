import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// ワークスペース一覧取得
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  // Admin client for privileged inserts when RLS blocks
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // 認証チェック - 開発環境でも本番環境でも同じ処理
    let user = null

    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token)
      if (!error) {
        user = tokenUser
      }
    }

    if (!user) {
      // フォールバック: クッキーから認証を試行
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (!authError) {
        user = cookieUser
      }
    }
    
    if (!user) {
      console.log('No user found in API')
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    console.log('Authenticated user:', user.id, user.email)

    // Admin権限でユーザーがメンバーのワークスペース一覧を取得（RLSを回避）
    const { data: workspaceMembers, error: membersError } = await supabaseAdmin
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        created_at,
        workspaces (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (membersError) {
      console.error('ワークスペースメンバー取得エラー:', membersError)
      return NextResponse.json(
        { error: 'ワークスペースの取得に失敗しました' },
        { status: 500 }
      )
    }

    console.log('取得したワークスペースメンバー数:', workspaceMembers?.length || 0)

    // ワークスペースがない場合は自動作成
    if (!workspaceMembers || workspaceMembers.length === 0) {
      console.log('ワークスペースが存在しないため、自動作成します')
      
      // デフォルトワークスペース名を決定
      const workspaceName = user.email 
        ? `${user.email.split('@')[0]}のワークスペース`
        : 'マイワークスペース'

      // ワークスペース作成
      const { data: newWorkspace, error: createWsError } = await supabaseAdmin
        .from('workspaces')
        .insert({
          name: workspaceName
        })
        .select()
        .single()

      if (createWsError) {
        console.error('ワークスペース作成エラー:', createWsError)
        return NextResponse.json(
          { error: 'ワークスペースの作成に失敗しました' },
          { status: 500 }
        )
      }

      // メンバー追加
      const { error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) {
        console.error('メンバー追加エラー:', memberError)
        // ワークスペースは作成済みなので、続行
      }

      console.log('新規ワークスペース作成成功:', newWorkspace)

      // 作成したワークスペースを返す
      return NextResponse.json({ 
        workspaces: [{
          id: newWorkspace.id,
          name: newWorkspace.name,
          created_at: newWorkspace.created_at,
          workspace_members: [{ role: 'owner', created_at: new Date().toISOString() }]
        }]
      })
    }

    // ワークスペース情報を整形して返す
    const workspaces = workspaceMembers
      .filter(m => m.workspaces)
      .map(m => ({
        id: m.workspaces!.id,
        name: m.workspaces!.name,
        created_at: m.workspaces!.created_at,
        workspace_members: [{
          role: m.role,
          created_at: m.created_at
        }]
      }))

    console.log('返却するワークスペース数:', workspaces.length)

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
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  try {
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    console.log('Creating workspace for user:', user.id, user.email)

    const { name } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'ワークスペース名が必要です' },
        { status: 400 }
      )
    }

    // 既存メンバーシップがあれば最新のワークスペースを返して冪等化
    const { data: existing, error: existingError } = await supabase
      .from('workspaces')
      .select('id, name, created_at, workspace_members!inner(user_id)')
      .eq('workspace_members.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!existingError && existing && existing.length > 0) {
      return NextResponse.json({ workspace: existing[0] })
    }

    // ワークスペースを作成（まずはowner_idを付与して試行、失敗したらnameのみで再試行）
    let workspace = null as any
    let workspaceError: any = null
    // Try with admin to avoid RLS issues
    const tryInsert = async (payload: Record<string, any>) =>
      supabaseAdmin.from('workspaces').insert(payload).select().single()

    let attempt = await tryInsert({ name: name.trim(), owner_id: user.id })
    if (attempt.error) {
      // Fallback without owner_id (column may not exist)
      attempt = await tryInsert({ name: name.trim() })
    }
    workspace = attempt.data
    workspaceError = attempt.error

    if (workspaceError || !workspace) {
      console.error('ワークスペース作成エラー:', workspaceError)
      return NextResponse.json(
        { error: 'ワークスペースの作成に失敗しました', details: process.env.NODE_ENV !== 'production' ? workspaceError?.message : undefined },
        { status: 500 }
      )
    }

    // 作成者をオーナーとして追加
    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      console.error('ワークスペースメンバー作成エラー:', memberError)
      // ここではワークスペースは残し、クライアント側で再試行や通知を許可
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
