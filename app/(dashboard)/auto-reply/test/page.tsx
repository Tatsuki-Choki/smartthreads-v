'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';
import { Send, AlertCircle, CheckCircle, Clock, MessageSquare } from 'lucide-react';

export default function WebhookTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [threadsAccounts, setThreadsAccounts] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [testData, setTestData] = useState({
    test_comment: '',
    threads_post_id: '',
    threads_account_id: '',
    test_username: 'testuser',
    test_display_name: 'テストユーザー'
  });
  const [testResult, setTestResult] = useState<any>(null);

  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchData();
    // 5秒ごとに最新コメントを取得
    const interval = setInterval(fetchRecentComments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const workspaceId = localStorage.getItem('current_workspace_id');
      if (!workspaceId) {
        setError('ワークスペースが選択されていません');
        return;
      }

      // Threadsアカウント取得
      const { data: accounts } = await supabase
        .from('threads_accounts')
        .select('*')
        .eq('workspace_id', workspaceId);
      
      setThreadsAccounts(accounts || []);

      // 最新のコメントを取得
      fetchRecentComments();

    } catch (err) {
      console.error('エラー:', err);
      setError('データの読み込みに失敗しました');
    }
  };

  const fetchRecentComments = async () => {
    try {
      const workspaceId = localStorage.getItem('current_workspace_id');
      if (!workspaceId) return;

      const { data: comments } = await supabase
        .from('comments')
        .select(`
          *,
          auto_reply_rules (
            name
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentComments(comments || []);
    } catch (err) {
      console.error('コメント取得エラー:', err);
    }
  };

  const handleSendTestWebhook = async () => {
    if (!testData.test_comment || !testData.threads_post_id || !testData.threads_account_id) {
      setError('すべての必須項目を入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'テスト送信に失敗しました');
      }

      setTestResult(result);
      setSuccess('テストWebhookを送信しました！コメント一覧を確認してください。');
      
      // 2秒後に最新コメントを再取得
      setTimeout(fetchRecentComments, 2000);

    } catch (err) {
      console.error('エラー:', err);
      setError(err instanceof Error ? err.message : 'テスト送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Webhookテスト</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* テストフォーム */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Send size={20} />
            テストWebhook送信
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-start gap-2">
              <AlertCircle size={20} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex items-start gap-2">
              <CheckCircle size={20} className="mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Threadsアカウント <span className="text-red-500">*</span>
              </label>
              <select
                value={testData.threads_account_id}
                onChange={(e) => setTestData({ ...testData, threads_account_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">選択してください</option>
                {threadsAccounts.map((account) => (
                  <option key={account.id} value={account.threads_user_id}>
                    {account.username} ({account.threads_user_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                投稿ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testData.threads_post_id}
                onChange={(e) => setTestData({ ...testData, threads_post_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 12345678901234567"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Threads上の投稿IDを入力（実在しなくても可）
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                テストコメント <span className="text-red-500">*</span>
              </label>
              <textarea
                value={testData.test_comment}
                onChange={(e) => setTestData({ ...testData, test_comment: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="例: この商品について質問があります"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ユーザー名
                </label>
                <input
                  type="text"
                  value={testData.test_username}
                  onChange={(e) => setTestData({ ...testData, test_username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  表示名
                </label>
                <input
                  type="text"
                  value={testData.test_display_name}
                  onChange={(e) => setTestData({ ...testData, test_display_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              onClick={handleSendTestWebhook}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  送信中...
                </>
              ) : (
                <>
                  <Send size={18} />
                  テストWebhook送信
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">送信結果</h3>
              <div className="text-sm space-y-1">
                <p><strong>コメントID:</strong> {testResult.test_data?.comment_id}</p>
                <p><strong>ステータス:</strong> {testResult.success ? '成功' : '失敗'}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-500 hover:text-blue-600">
                    詳細データを表示
                  </summary>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                    {JSON.stringify(testResult.payload_sent, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* 受信したコメント一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MessageSquare size={20} />
            受信したコメント（最新10件）
          </h2>

          <div className="space-y-3">
            {recentComments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                まだコメントがありません
              </p>
            ) : (
              recentComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        @{comment.username}
                      </span>
                      {comment.display_name && (
                        <span className="text-gray-500 text-sm">
                          ({comment.display_name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {comment.replied ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          返信済
                        </span>
                      ) : comment.matched_rule_id ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                          マッチ
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          未処理
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm mb-2">{comment.content}</p>

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>投稿ID: {comment.threads_post_id}</span>
                      {comment.auto_reply_rules?.name && (
                        <span className="text-blue-600">
                          ルール: {comment.auto_reply_rules.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(comment.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>

                  {comment.reply_error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                      エラー: {comment.reply_error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {recentComments.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={fetchRecentComments}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                更新
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 使い方ガイド */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">📝 使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Threadsアカウントを選択（事前に連携が必要）</li>
          <li>任意の投稿IDを入力（テスト用なので実在しなくてもOK）</li>
          <li>テストコメントを入力（設定したキーワードを含めてテスト）</li>
          <li>送信ボタンをクリック</li>
          <li>右側のコメント一覧で受信確認とマッチング結果を確認</li>
        </ol>
        
        <div className="mt-4 p-3 bg-white rounded">
          <p className="text-sm font-medium mb-1">🔍 テストのポイント</p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>ルールで設定したトリガーキーワードを含めてマッチングをテスト</li>
            <li>除外キーワードも含めて、正しく除外されるか確認</li>
            <li>複数のルールがある場合、優先度の高いルールがマッチするか確認</li>
          </ul>
        </div>
      </div>
    </div>
  );
}