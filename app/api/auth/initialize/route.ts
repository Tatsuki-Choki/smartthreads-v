import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * ユーザーとワークスペースの初期化API
 * ログイン後に呼び出され、必要なデータを自動作成する
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  // Admin clientで RLS を回避してデータ作成
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // 認証ユーザー取得
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('認証エラー:', authError)
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    console.log('ユーザー初期化開始:', user.id, user.email)

    // 1. usersテーブルにレコードを作成（既存チェック付き）
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', user.id)
      .single()

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (ユーザーが存在しない)
      console.error('ユーザー確認エラー:', userCheckError)
    }

    let dbUser = existingUser

    if (!existingUser) {
      console.log('新規ユーザー作成:', user.id)
      const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email!
        })
        .select()
        .single()

      if (createUserError) {
        console.error('ユーザー作成エラー:', createUserError)
        // エラーでも続行（既に存在する可能性）
      } else {
        dbUser = newUser
        console.log('ユーザー作成成功:', newUser)
      }
    } else {
      console.log('既存ユーザー:', existingUser)
    }

    // 2. ワークスペースの確認
    const { data: workspaces, error: wsCheckError } = await supabaseAdmin
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (wsCheckError) {
      console.error('ワークスペース確認エラー:', wsCheckError)
    }

    console.log('既存ワークスペース数:', workspaces?.length || 0)

    // 3. ワークスペースがない場合は作成
    if (!workspaces || workspaces.length === 0) {
      console.log('デフォルトワークスペース作成開始')
      
      // ワークスペース名を決定
      const workspaceName = user.email 
        ? `${user.email.split('@')[0]}のワークスペース`
        : 'マイワークスペース'

      // ワークスペース作成
      const { data: newWorkspace, error: createWsError } = await supabaseAdmin
        .from('workspaces')
        .insert({
          name: workspaceName,
          owner_id: user.id // owner_idカラムが存在する場合
        })
        .select()
        .single()

      if (createWsError) {
        // owner_idが存在しない場合は、nameのみで再試行
        console.log('owner_id付きで失敗、nameのみで再試行')
        const { data: retryWorkspace, error: retryError } = await supabaseAdmin
          .from('workspaces')
          .insert({
            name: workspaceName
          })
          .select()
          .single()

        if (retryError) {
          console.error('ワークスペース作成エラー:', retryError)
          return NextResponse.json(
            { error: 'ワークスペースの作成に失敗しました' },
            { status: 500 }
          )
        }

        // メンバー追加
        const { error: memberError } = await supabaseAdmin
          .from('workspace_members')
          .insert({
            workspace_id: retryWorkspace.id,
            user_id: user.id,
            role: 'owner'
          })

        if (memberError) {
          console.error('メンバー追加エラー:', memberError)
        } else {
          console.log('ワークスペース作成成功:', retryWorkspace)
        }

        return NextResponse.json({
          success: true,
          message: 'ユーザーとワークスペースを初期化しました',
          user: dbUser,
          workspace: retryWorkspace
        })
      }

      // owner_id付きで成功した場合もメンバー追加
      const { error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) {
        console.error('メンバー追加エラー:', memberError)
      }

      console.log('ワークスペース作成成功:', newWorkspace)

      return NextResponse.json({
        success: true,
        message: 'ユーザーとワークスペースを初期化しました',
        user: dbUser,
        workspace: newWorkspace
      })
    }

    // 既にワークスペースがある場合
    return NextResponse.json({
      success: true,
      message: 'ユーザーは既に初期化済みです',
      user: dbUser,
      workspaces: workspaces.map(w => w.workspaces).filter(Boolean)
    })

  } catch (error) {
    console.error('初期化APIエラー:', error)
    return NextResponse.json(
      { error: '初期化処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}