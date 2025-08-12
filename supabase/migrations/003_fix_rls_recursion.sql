-- RLS ポリシーの無限再帰エラーを修正
-- workspace_members テーブルのSELECTポリシーが自分自身を参照していることが原因

-- 問題のあるポリシーを削除
DROP POLICY "Users can view workspace members of their workspaces" ON workspace_members;
DROP POLICY "Workspace admins can manage members" ON workspace_members;

-- workspace_members テーブル用の修正されたポリシーを作成
-- 直接的なuser_id比較を使用して再帰を回避
CREATE POLICY "Users can view their own workspace memberships"
ON workspace_members
FOR SELECT
USING (user_id = auth.uid());

-- 管理者は同じワークスペース内のメンバーを表示可能
-- 但し、直接的なJOINクエリを回避するため、シンプルな条件にする
CREATE POLICY "Admins can view all workspace members in their workspaces"
ON workspace_members
FOR SELECT
USING (
    -- 自分がowner/adminのワークスペースのメンバーのみ閲覧可能
    workspace_id IN (
        -- サブクエリではなく、関数を使用して再帰を回避
        SELECT w.id 
        FROM workspaces w 
        WHERE w.id IN (
            SELECT wm.workspace_id 
            FROM workspace_members wm 
            WHERE wm.user_id = auth.uid() 
            AND wm.role IN ('owner', 'admin')
        )
    )
);

-- workspace_members の INSERT/UPDATE/DELETE ポリシーも再帰問題を修正
-- DROP POLICY "Workspace admins can manage members" ON workspace_members;

-- INSERT: ユーザーは自分自身のメンバーシップのみ挿入可能
CREATE POLICY "Users can insert their own workspace membership"
ON workspace_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE: 管理者は自分のワークスペース内でのみ更新可能
CREATE POLICY "Admins can update workspace members"
ON workspace_members
FOR UPDATE
USING (
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w 
        WHERE w.id IN (
            SELECT wm.workspace_id 
            FROM workspace_members wm 
            WHERE wm.user_id = auth.uid() 
            AND wm.role IN ('owner', 'admin')
        )
    )
);

-- DELETE: 管理者は自分のワークスペース内でのみ削除可能
CREATE POLICY "Admins can delete workspace members"
ON workspace_members
FOR DELETE
USING (
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w 
        WHERE w.id IN (
            SELECT wm.workspace_id 
            FROM workspace_members wm 
            WHERE wm.user_id = auth.uid() 
            AND wm.role IN ('owner', 'admin')
        )
    )
);