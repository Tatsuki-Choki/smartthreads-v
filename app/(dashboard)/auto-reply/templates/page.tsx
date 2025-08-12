'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';
import { Plus, Edit, Trash2, Copy, CheckCircle, XCircle } from 'lucide-react';

type ReplyTemplate = Database['public']['Tables']['reply_templates']['Row'];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    variables: {} as Record<string, any>,
    is_active: true
  });

  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      // ユーザー情報とワークスペースIDを取得
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 現在のワークスペースIDを取得（localStorage or context）
      const workspaceId = localStorage.getItem('current_workspace_id');
      if (!workspaceId) {
        setError('ワークスペースが選択されていません');
        return;
      }

      // APIからテンプレートを取得
      const response = await fetch('/api/auto-reply/templates', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'x-workspace-id': workspaceId
        }
      });

      if (!response.ok) {
        throw new Error('テンプレートの取得に失敗しました');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('エラー:', err);
      setError('テンプレートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      if (!session || !workspaceId) {
        setError('認証エラーが発生しました');
        return;
      }

      const url = '/api/auto-reply/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const body = editingTemplate 
        ? { ...formData, id: editingTemplate.id }
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

      await fetchTemplates();
      closeModal();
    } catch (err) {
      console.error('エラー:', err);
      setError('保存に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除してもよろしいですか？')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const workspaceId = localStorage.getItem('current_workspace_id');
      
      if (!session || !workspaceId) {
        setError('認証エラーが発生しました');
        return;
      }

      const response = await fetch(`/api/auto-reply/templates?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': workspaceId
        }
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました');
      }

      await fetchTemplates();
    } catch (err) {
      console.error('エラー:', err);
      setError('削除に失敗しました');
    }
  };

  const openModal = (template?: ReplyTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        content: template.content,
        variables: template.variables || {},
        is_active: template.is_active
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        content: '',
        variables: {},
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      variables: {},
      is_active: true
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    setFormData({
      ...formData,
      content: before + `{{${variable}}}` + after
    });
    
    // カーソル位置を調整
    setTimeout(() => {
      textarea.selectionStart = start + variable.length + 4;
      textarea.selectionEnd = start + variable.length + 4;
      textarea.focus();
    }, 0);
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
        <h1 className="text-3xl font-bold">返信テンプレート管理</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={20} />
          新規テンプレート
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">{template.name}</h3>
              <div className={`px-2 py-1 rounded text-xs ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {template.is_active ? '有効' : '無効'}
              </div>
            </div>
            
            {template.description && (
              <p className="text-gray-600 text-sm mb-4">{template.description}</p>
            )}
            
            <div className="bg-gray-50 p-3 rounded mb-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                {template.content}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => openModal(template)}
                className="text-blue-500 hover:bg-blue-50 p-2 rounded"
                title="編集"
              >
                <Edit size={18} />
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(template.content);
                  alert('コピーしました');
                }}
                className="text-gray-500 hover:bg-gray-50 p-2 rounded"
                title="コピー"
              >
                <Copy size={18} />
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="text-red-500 hover:bg-red-50 p-2 rounded"
                title="削除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">テンプレートがまだありません</p>
          <button
            onClick={() => openModal()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            最初のテンプレートを作成
          </button>
        </div>
      )}

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
              </h2>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    テンプレート名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    説明
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="このテンプレートの用途を説明"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    テンプレート内容 <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="mb-2 flex gap-2">
                    <span className="text-sm text-gray-600">変数を挿入:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('username')}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      {'{'}{'{'}{'}'}username{'{'}'}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('comment')}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      {'{'}{'{'}{'}'}comment{'{'}'}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('date')}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      {'{'}{'{'}{'}'}date{'{'}'}'}
                    </button>
                  </div>
                  
                  <textarea
                    id="template-content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                    required
                    placeholder="例: {{username}}さん、コメントありがとうございます！"
                  />
                </div>

                <div className="mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">このテンプレートを有効にする</span>
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
                    {editingTemplate ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}