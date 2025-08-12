-- 現在のworkspace_membersテーブルのポリシーを確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'workspace_members'
ORDER BY policyname;

-- すべてのworkspace_membersポリシーを強制削除
DROP POLICY IF EXISTS "Users can view workspace members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves as workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON workspace_members;

-- 最もシンプルなポリシーから開始（再帰なし）
-- SELECT: ユーザーは自分のメンバーシップのみ表示可能
CREATE POLICY "simple_select_own_membership" 
ON workspace_members 
FOR SELECT 
USING (user_id = auth.uid());

-- INSERT: ユーザーは自分のメンバーシップのみ挿入可能
CREATE POLICY "simple_insert_own_membership" 
ON workspace_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- 再度確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'workspace_members'
ORDER BY policyname;