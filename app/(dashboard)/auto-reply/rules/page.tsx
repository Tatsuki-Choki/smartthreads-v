'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Power, TestTube, X } from 'lucide-react';

type AutoReplyRule = Database['public']['Tables']['auto_reply_rules']['Row'] & {
  threads_accounts?: any;
  reply_templates?: any;
};

export default function RulesPage() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [threadsAccounts, setThreadsAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    threads_account_id: '',
    trigger_keywords: [] as string[],
    exclude_keywords: [] as string[],
    match_mode: 'any' as 'any' | 'all' | 'exact',
    reply_template_id: '',
    reply_content: '',
    reply_delay_seconds: 0,
    max_replies_per_hour: 10,
    max_replies_per_user: 3,
    is_active: true,
    priority: 0
  });
  const [testData, setTestData] = useState({
    test_comment: '',
    test_username: 'テストユーザー',
    rule_id: ''
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
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

      const session = (await supabase.auth.getSession()).data.session;
      const headers = {
        'Authorization': `Bearer ${session?.access_token}`,
        'x-workspace-id': workspaceId
      };

      // ルール取得
      const rulesResponse = await fetch('/api/auto-reply/rules', { headers });
      if (!rulesResponse.ok) throw new Error('ルールの取得に失敗しました');
      const rulesData = await rulesResponse.json();
      setRules(rulesData.rules || []);

      // テンプレート取得
      const templatesResponse = await fetch('/api/auto-reply/templates', { headers });
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData.templates || []);
      }

      // Threadsアカウント取得
      const { data: accounts } = await supabase
        .from('threads_accounts')
        .select('*')
        .eq('workspace_id', workspaceId);
      setThreadsAccounts(accounts || []);

    } catch (err) {
      console.error('エラー:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.trigger_keywords.length === 0) {
      setError('トリガーキーワードを最低1つ入力してください');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      if (!session || !workspaceId) {
        setError('認証エラーが発生しました');
        return;
      }

      const url = '/api/auto-reply/rules';
      const method = editingRule ? 'PUT' : 'POST';
      const body = editingRule 
        ? { ...formData, id: editingRule.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('保存に失敗しました');
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('エラー:', err);
      setError('保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このルールを削除してもよろしいですか？')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      const response = await fetch(`/api/auto-reply/rules?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': workspaceId
        }
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました');
      }

      await fetchData();
    } catch (err) {
      console.error('エラー:', err);
      setError('削除に失敗しました');
    }
  };

  const handleToggleActive = async (rule: AutoReplyRule) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      const response = await fetch('/api/auto-reply/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          id: rule.id,
          is_active: !rule.is_active
        })
      });

      if (!response.ok) {
        throw new Error('更新に失敗しました');
      }

      await fetchData();
    } catch (err) {
      console.error('エラー:', err);
      setError('更新に失敗しました');
    }
  };

  const handleTestRule = async () => {
    if (!testData.test_comment) {
      setError('テスト用コメントを入力してください');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      const response = await fetch('/api/auto-reply/rules/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        throw new Error('テスト実行に失敗しました');
      }

      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      console.error('エラー:', err);
      setError('テスト実行に失敗しました');
    }
  };

  const addKeyword = (type: 'trigger' | 'exclude') => {
    const input = type === 'trigger' ? keywordInput : excludeKeywordInput;
    if (!input.trim()) return;

    if (type === 'trigger') {
      setFormData({
        ...formData,
        trigger_keywords: [...formData.trigger_keywords, input.trim()]
      });
      setKeywordInput('');
    } else {
      setFormData({
        ...formData,
        exclude_keywords: [...formData.exclude_keywords, input.trim()]
      });
      setExcludeKeywordInput('');
    }
  };

  const removeKeyword = (type: 'trigger' | 'exclude', index: number) => {
    if (type === 'trigger') {
      setFormData({
        ...formData,
        trigger_keywords: formData.trigger_keywords.filter((_, i) => i !== index)
      });
    } else {
      setFormData({
        ...formData,
        exclude_keywords: formData.exclude_keywords.filter((_, i) => i !== index)
      });
    }
  };

  const openModal = (rule?: AutoReplyRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        threads_account_id: rule.threads_account_id,
        trigger_keywords: rule.trigger_keywords,
        exclude_keywords: rule.exclude_keywords,
        match_mode: rule.match_mode,
        reply_template_id: rule.reply_template_id || '',
        reply_content: rule.reply_content,
        reply_delay_seconds: rule.reply_delay_seconds,
        max_replies_per_hour: rule.max_replies_per_hour,
        max_replies_per_user: rule.max_replies_per_user,
        is_active: rule.is_active,
        priority: rule.priority
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        threads_account_id: '',
        trigger_keywords: [],
        exclude_keywords: [],
        match_mode: 'any',
        reply_template_id: '',
        reply_content: '',
        reply_delay_seconds: 0,
        max_replies_per_hour: 10,
        max_replies_per_user: 3,
        is_active: true,
        priority: 0
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setKeywordInput('');
    setExcludeKeywordInput('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">自動返信ルール管理</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <TestTube size={20} />
            ルールテスト
          </button>
          <button
            onClick={() => openModal()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus size={20} />
            新規ルール
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {rules.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">ルールがまだありません</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              最初のルールを作成
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">優先度</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ルール名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アカウント</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">キーワード</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">マッチモード</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium">{rule.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-gray-500">{rule.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm">
                        {rule.threads_accounts?.username || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {rule.trigger_keywords.map((keyword, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm">
                        {rule.match_mode === 'any' && 'いずれか'}
                        {rule.match_mode === 'all' && 'すべて'}
                        {rule.match_mode === 'exact' && '完全一致'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rule.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.is_active ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(rule)}
                          className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ルール作成/編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingRule ? 'ルール編集' : '新規ルール作成'}
              </h2>
              
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ルール名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Threadsアカウント <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.threads_account_id}
                      onChange={(e) => setFormData({ ...formData, threads_account_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">選択してください</option>
                      {threadsAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">説明</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="このルールの用途を説明"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    トリガーキーワード <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('trigger'))}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="キーワードを入力してEnter"
                    />
                    <button
                      type="button"
                      onClick={() => addKeyword('trigger')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      追加
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.trigger_keywords.map((keyword, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full flex items-center gap-2">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword('trigger', i)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">除外キーワード</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={excludeKeywordInput}
                      onChange={(e) => setExcludeKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('exclude'))}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="除外キーワードを入力してEnter"
                    />
                    <button
                      type="button"
                      onClick={() => addKeyword('exclude')}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      追加
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.exclude_keywords.map((keyword, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full flex items-center gap-2">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword('exclude', i)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">マッチモード</label>
                  <select
                    value={formData.match_mode}
                    onChange={(e) => setFormData({ ...formData, match_mode: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="any">いずれかのキーワード</option>
                    <option value="all">すべてのキーワード</option>
                    <option value="exact">完全一致</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">返信テンプレート</label>
                  <select
                    value={formData.reply_template_id}
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        reply_template_id: e.target.value,
                        reply_content: template ? template.content : formData.reply_content
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">直接入力</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    返信内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reply_content}
                    onChange={(e) => setFormData({ ...formData, reply_content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">返信遅延（秒）</label>
                    <input
                      type="number"
                      value={formData.reply_delay_seconds}
                      onChange={(e) => setFormData({ ...formData, reply_delay_seconds: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="30"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">時間あたり最大返信数</label>
                    <input
                      type="number"
                      value={formData.max_replies_per_hour}
                      onChange={(e) => setFormData({ ...formData, max_replies_per_hour: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">ユーザーごと最大返信数</label>
                    <input
                      type="number"
                      value={formData.max_replies_per_user}
                      onChange={(e) => setFormData({ ...formData, max_replies_per_user: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">このルールを有効にする</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    {editingRule ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* テストモーダル */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">ルールテスト</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">テスト対象ルール</label>
                <select
                  value={testData.rule_id}
                  onChange={(e) => setTestData({ ...testData, rule_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">すべてのアクティブルール</option>
                  {rules.filter(r => r.is_active).map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  テスト用コメント <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={testData.test_comment}
                  onChange={(e) => setTestData({ ...testData, test_comment: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="例: この商品について質問があります"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">テスト用ユーザー名</label>
                <input
                  type="text"
                  value={testData.test_username}
                  onChange={(e) => setTestData({ ...testData, test_username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleTestRule}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 mb-4"
              >
                テスト実行
              </button>

              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.matched ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <h3 className="font-semibold mb-2">
                    {testResult.matched ? '✅ マッチしました' : '❌ マッチしませんでした'}
                  </h3>
                  
                  {testResult.matched && (
                    <>
                      <p className="text-sm mb-2">
                        <strong>マッチしたルール:</strong> {testResult.matched_rule.name}
                      </p>
                      <p className="text-sm mb-2">
                        <strong>返信遅延:</strong> {testResult.reply_delay_seconds}秒
                      </p>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm font-medium mb-1">返信内容:</p>
                        <p className="text-sm whitespace-pre-wrap">{testResult.reply_content}</p>
                      </div>
                    </>
                  )}
                  
                  {!testResult.matched && (
                    <p className="text-sm text-gray-600">{testResult.message}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsTestModalOpen(false);
                    setTestResult(null);
                    setTestData({ test_comment: '', test_username: 'テストユーザー', rule_id: '' });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}