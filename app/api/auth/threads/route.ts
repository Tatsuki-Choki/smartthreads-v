import { NextRequest, NextResponse } from 'next/server'
import { generateThreadsAuthUrl } from '@/lib/threads/api'
import { getBaseUrl } from '@/lib/url'

// Threads OAuth認証開始
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      )
    }

    // リダイレクトURIを生成（環境に依存せず一貫したベースURLを使用）
    const redirectUri = `${getBaseUrl()}/api/auth/threads/callback`

    // OAuth認証URLを生成（workspaceIdをstateパラメータとして含める）
    const authUrl = generateThreadsAuthUrl(redirectUri)
    const urlWithState = `${authUrl}&state=${workspaceId}`

    return NextResponse.json({ authUrl: urlWithState })
  } catch (error) {
    console.error('Threads OAuth認証エラー:', error)
    return NextResponse.json(
      { error: 'OAuth認証の開始に失敗しました' },
      { status: 500 }
    )
  }
}
