# 🚀 SmartThreads V - 本番環境構築 最終ガイド

## 📊 現在の状況

### ✅ 完了済み
- 開発サーバー起動確認（http://localhost:3000）
- Supabaseプロジェクト接続
- 基本テーブル作成（workspaces, workspace_members, threads_accounts, posts）
- 環境変数設定

### ⏳ 未完了（手動実行が必要）
- 不足テーブルの作成（users, auto_reply_rules, comments, event_logs）
- RLSポリシーの適用
- 本番認証システムの有効化

## 🔧 今すぐ実行すべきこと

### ステップ1: Supabaseでテーブル作成（5分）

1. **Supabase Dashboardを開く**
   👉 https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor

2. **SQL Editorで以下を実行**

```sql
-- 不足しているテーブルを作成
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_account_id UUID REFERENCES threads_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL,
  reply_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  threads_comment_id TEXT UNIQUE,
  threads_user_id TEXT,
  username TEXT,
  content TEXT,
  replied BOOLEAN DEFAULT false,
  reply_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
```

3. **RLSポリシーを設定**

```sql
-- Usersテーブル
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Workspacesテーブル
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- その他のテーブルのポリシー（同様のパターン）
CREATE POLICY "Users can manage workspace members" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage threads accounts" ON threads_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage posts" ON posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );
```

### ステップ2: 本番認証の有効化（10分）

1. **Supabase Authenticationの設定**
   - Dashboard > Authentication > Providers
   - Email認証を有効化
   - 確認メールのテンプレート設定

2. **.env.localの更新**
```env
# 開発モードを無効化
# SKIP_AUTH_CHECK=true  # この行を削除またはコメントアウト
```

3. **開発サーバーを再起動**
```bash
# Ctrl+Cで停止後
npm run dev
```

### ステップ3: Threads API連携（Meta for Developers必要）

1. **Meta for Developersでアプリ作成**
   - https://developers.facebook.com/ にアクセス
   - 新規アプリ作成
   - Threads APIを有効化

2. **環境変数を更新**
```env
THREADS_APP_ID=実際のアプリID
THREADS_APP_SECRET=実際のシークレット
THREADS_REDIRECT_URI=https://your-domain.vercel.app/api/auth/threads/callback
```

## 📝 確認コマンド

```bash
# テーブル構造の確認
node scripts/check-supabase-tables.js

# 開発サーバーでテスト
open http://localhost:3000
```

## 🎯 本番デプロイへの道

1. **今日**: データベース構築完了（上記ステップ1）
2. **明日**: 認証システム本番化（ステップ2）
3. **明後日**: Threads連携実装（ステップ3）
4. **4日目**: Vercelデプロイ
5. **5日目**: 本番テスト＆調整

## ⚠️ 重要な注意事項

- **手動実行が必要**: CLIやAPIではDDL操作ができないため、Supabase Dashboardでの実行が必須
- **順序重要**: テーブル作成 → RLSポリシー設定の順で実行
- **開発モード無効化**: 本番では`SKIP_AUTH_CHECK`を必ず削除

## 🆘 トラブルシューティング

- **テーブル作成エラー**: 既存テーブルがある場合は`IF NOT EXISTS`で無視される
- **RLSエラー**: ポリシーが重複している場合は`IF NOT EXISTS`を追加
- **認証エラー**: Supabase Authが有効になっているか確認

## 📞 サポート

問題が発生した場合は、以下を確認：
1. Supabase Dashboardのエラーログ
2. ブラウザの開発者ツール（Network/Console）
3. `npm run dev`のターミナル出力

---

**作成日**: 2025年1月12日  
**次回作業**: Supabase DashboardでSQL実行（5分で完了）