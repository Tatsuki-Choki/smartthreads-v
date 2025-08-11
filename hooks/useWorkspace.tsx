'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { authenticatedFetch } from '@/lib/supabase/client-server'

interface Workspace {
  id: string
  name: string
  created_at: string
  workspace_members: {
    role: string
    created_at: string
  }[]
}

interface ThreadsAccount {
  id: string
  threads_user_id: string
  username: string
  created_at: string
  updated_at: string
  status: 'active' | 'invalid' | 'error'
  expires_at: string | null
}

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [threadsAccounts, setThreadsAccounts] = useState<ThreadsAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // ワークスペース一覧を取得
  const fetchWorkspaces = async () => {
    if (!user) return

    try {
      const response = await authenticatedFetch('/api/workspaces')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ワークスペースの取得に失敗しました')
      }

      setWorkspaces(data.workspaces)
      
      // 最初のワークスペースを現在のワークスペースに設定
      if (data.workspaces.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data.workspaces[0])
      } else if (data.workspaces.length === 0) {
        // ワークスペースが存在しない場合、デフォルトワークスペースを作成
        await createDefaultWorkspace()
      }
    } catch (err) {
      console.error('ワークスペース取得エラー:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  // デフォルトワークスペース作成
  const createDefaultWorkspace = async () => {
    try {
      const defaultName = user?.email?.split('@')[0] + 'のワークスペース' || 'マイワークスペース'
      const workspace = await createWorkspace(defaultName, true) // リフェッチをスキップ
      setWorkspaces([workspace])
      setCurrentWorkspace(workspace)
    } catch (err) {
      console.error('デフォルトワークスペース作成エラー:', err)
    }
  }

  // Threadsアカウント一覧を取得
  const fetchThreadsAccounts = async (workspaceId: string) => {
    try {
      const response = await authenticatedFetch(`/api/workspaces/${workspaceId}/threads-accounts`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Threadsアカウントの取得に失敗しました')
      }

      setThreadsAccounts(data.accounts)
    } catch (err) {
      console.error('Threadsアカウント取得エラー:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  // ワークスペース作成
  const createWorkspace = async (name: string, skipRefetch = false): Promise<Workspace> => {
    const response = await authenticatedFetch('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'ワークスペースの作成に失敗しました')
    }

    if (!skipRefetch) {
      await fetchWorkspaces() // リストを更新
    }
    return data.workspace
  }

  // Threads連携開始
  const connectThreads = async (workspaceId: string) => {
    const response = await authenticatedFetch(`/api/auth/threads?workspace_id=${workspaceId}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Threads連携の開始に失敗しました')
    }

    // OAuth認証ページにリダイレクト
    window.location.href = data.authUrl
  }

  // Threadsアカウント削除
  const removeThreadsAccount = async (workspaceId: string, accountId: string) => {
    const response = await authenticatedFetch(`/api/workspaces/${workspaceId}/threads-accounts?account_id=${accountId}`, {
      method: 'DELETE',
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Threadsアカウントの削除に失敗しました')
    }

    // Threadsアカウントリストを更新
    await fetchThreadsAccounts(workspaceId)
  }

  useEffect(() => {
    if (user) {
      fetchWorkspaces()
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (currentWorkspace) {
      fetchThreadsAccounts(currentWorkspace.id)
    }
  }, [currentWorkspace])

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    threadsAccounts,
    loading,
    error,
    createWorkspace,
    connectThreads,
    removeThreadsAccount,
    refetchThreadsAccounts: () => currentWorkspace && fetchThreadsAccounts(currentWorkspace.id)
  }
}