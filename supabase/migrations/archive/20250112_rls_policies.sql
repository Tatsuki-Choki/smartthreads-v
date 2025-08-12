-- SmartThreads V - Row Level Security Policies
-- Created: 2025-01-12

-- ======================================
-- 1. Users テーブルのポリシー
-- ======================================

-- ユーザーは自分のプロフィールを閲覧可能
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

-- ユーザーは自分のプロフィールを更新可能
CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- 新規ユーザーの自動作成（Supabase Auth連携）
CREATE POLICY "Users can insert own profile" 
  ON users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ======================================
-- 2. Workspaces テーブルのポリシー
-- ======================================

-- ユーザーは自分が所属するワークスペースを閲覧可能
CREATE POLICY "Users can view workspaces they belong to" 
  ON workspaces FOR SELECT 
  USING (
    owner_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- オーナーはワークスペースを更新可能
CREATE POLICY "Owners can update workspaces" 
  ON workspaces FOR UPDATE 
  USING (owner_id = auth.uid());

-- ユーザーは新規ワークスペースを作成可能
CREATE POLICY "Users can create workspaces" 
  ON workspaces FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

-- オーナーはワークスペースを削除可能
CREATE POLICY "Owners can delete workspaces" 
  ON workspaces FOR DELETE 
  USING (owner_id = auth.uid());

-- ======================================
-- 3. Workspace Members テーブルのポリシー
-- ======================================

-- メンバーはワークスペースメンバー一覧を閲覧可能
CREATE POLICY "Members can view workspace members" 
  ON workspace_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- オーナーはワークスペースメンバーを追加可能
CREATE POLICY "Owners can add workspace members" 
  ON workspace_members FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- オーナーと管理者はメンバーを更新可能
CREATE POLICY "Owners and admins can update members" 
  ON workspace_members FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- オーナーはメンバーを削除可能
CREATE POLICY "Owners can remove members" 
  ON workspace_members FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- ======================================
-- 4. Threads Accounts テーブルのポリシー
-- ======================================

-- メンバーはワークスペースのThreadsアカウントを閲覧可能
CREATE POLICY "Members can view workspace threads accounts" 
  ON threads_accounts FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- オーナーと管理者はThreadsアカウントを追加可能
CREATE POLICY "Owners and admins can add threads accounts" 
  ON threads_accounts FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = threads_accounts.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- オーナーと管理者はThreadsアカウントを更新可能
CREATE POLICY "Owners and admins can update threads accounts" 
  ON threads_accounts FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = threads_accounts.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = threads_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- オーナーはThreadsアカウントを削除可能
CREATE POLICY "Owners can delete threads accounts" 
  ON threads_accounts FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = threads_accounts.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- ======================================
-- 5. Posts テーブルのポリシー
-- ======================================

-- メンバーはワークスペースの投稿を閲覧可能
CREATE POLICY "Members can view workspace posts" 
  ON posts FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- メンバーは投稿を作成可能
CREATE POLICY "Members can create posts" 
  ON posts FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- メンバーは投稿を更新可能
CREATE POLICY "Members can update posts" 
  ON posts FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- メンバーは投稿を削除可能
CREATE POLICY "Members can delete posts" 
  ON posts FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ======================================
-- 6. Auto Reply Rules テーブルのポリシー
-- ======================================

-- メンバーは自動返信ルールを閲覧可能
CREATE POLICY "Members can view auto reply rules" 
  ON auto_reply_rules FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = auto_reply_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 管理者以上は自動返信ルールを作成可能
CREATE POLICY "Admins can create auto reply rules" 
  ON auto_reply_rules FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = auto_reply_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- 管理者以上は自動返信ルールを更新可能
CREATE POLICY "Admins can update auto reply rules" 
  ON auto_reply_rules FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = auto_reply_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- 管理者以上は自動返信ルールを削除可能
CREATE POLICY "Admins can delete auto reply rules" 
  ON auto_reply_rules FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = auto_reply_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ======================================
-- 7. Comments テーブルのポリシー
-- ======================================

-- メンバーはコメントを閲覧可能
CREATE POLICY "Members can view comments" 
  ON comments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = comments.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- システムのみがコメントを作成可能（Webhook経由）
-- 注: Service Roleキーを使用する場合はRLSをバイパス

-- メンバーはコメントを更新可能（返信済みフラグなど）
CREATE POLICY "Members can update comments" 
  ON comments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = comments.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ======================================
-- 8. Event Logs テーブルのポリシー
-- ======================================

-- メンバーは自分のワークスペースのイベントログを閲覧可能
CREATE POLICY "Members can view event logs" 
  ON event_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = event_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- メンバーはイベントログを作成可能
CREATE POLICY "Members can create event logs" 
  ON event_logs FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = event_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ======================================
-- 9. 特別な関数とヘルパー
-- ======================================

-- 現在のユーザーのワークスペースIDを取得する関数
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 現在のユーザーがワークスペースのメンバーかチェックする関数
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 現在のユーザーのワークスペースでの役割を取得する関数
CREATE OR REPLACE FUNCTION get_user_role_in_workspace(workspace_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM workspace_members
  WHERE workspace_id = workspace_uuid
  AND user_id = auth.uid();
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;