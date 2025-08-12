# 🚀 SmartThreads V - マイグレーション実行ガイド

## 最も簡単な方法（ブラウザ使用）

### ステップ1: Supabase Dashboardを開く
👉 [こちらをクリック](https://app.supabase.com/project/zndvvqezzmyhkpvnmakf/editor)

### ステップ2: SQL Editorで以下を実行

#### 2-1. 不足テーブルの作成
以下のSQLをコピーして実行：

```sql
-- Usersテーブル
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自動返信ルールテーブル
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

-- コメントテーブル
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

-- イベントログテーブル
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

-- RLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
```

#### 2-2. RLSポリシーの設定
次にこのSQLを実行：

```sql
-- Usersテーブルのポリシー
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Workspacesテーブルのポリシー
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace Membersテーブルのポリシー
CREATE POLICY "Users can view workspace members" ON workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );

-- Threads Accountsテーブルのポリシー
CREATE POLICY "Users can manage threads accounts in their workspace" ON threads_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Postsテーブルのポリシー
CREATE POLICY "Users can manage posts in their workspace" ON posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Auto Reply Rulesテーブルのポリシー
CREATE POLICY "Users can manage auto reply rules in their workspace" ON auto_reply_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = auto_reply_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Commentsテーブルのポリシー
CREATE POLICY "Users can view comments in their workspace" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = comments.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Event Logsテーブルのポリシー
CREATE POLICY "Users can view event logs in their workspace" ON event_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = event_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );
```

### ステップ3: 確認
実行後、テーブル一覧で以下が表示されればOK：
- ✅ users
- ✅ workspaces
- ✅ workspace_members
- ✅ threads_accounts
- ✅ posts
- ✅ auto_reply_rules
- ✅ comments
- ✅ event_logs

## 完了後の確認コマンド

```bash
node scripts/check-supabase-tables.js
```

すべてのテーブルが「✅ 存在します」と表示されれば成功です！