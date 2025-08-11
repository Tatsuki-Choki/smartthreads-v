-- RLS（Row Level Security）ポリシー
-- 設計ドキュメントの要件：完全なマルチテナント分離

-- RLSを有効化
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 1. workspaces テーブルのRLSポリシー
-- ユーザーは自分がメンバーのワークスペースのみアクセス可能
CREATE POLICY "Users can view workspaces they are members of"
ON workspaces
FOR SELECT
USING (
    id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert workspaces"
ON workspaces
FOR INSERT
WITH CHECK (true); -- 新規ワークスペース作成は誰でも可能

CREATE POLICY "Workspace owners can update their workspace"
ON workspaces
FOR UPDATE
USING (
    id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Workspace owners can delete their workspace"
ON workspaces
FOR DELETE
USING (
    id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role = 'owner'
    )
);

-- 2. workspace_members テーブルのRLSポリシー
CREATE POLICY "Users can view workspace members of their workspaces"
ON workspace_members
FOR SELECT
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members wm 
        WHERE wm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert themselves as workspace members"
ON workspace_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workspace admins can manage members"
ON workspace_members
FOR ALL
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

-- 3. threads_accounts テーブルのRLSポリシー
CREATE POLICY "Users can view threads accounts in their workspaces"
ON threads_accounts
FOR SELECT
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert threads accounts in their workspaces"
ON threads_accounts
FOR INSERT
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update threads accounts in their workspaces"
ON threads_accounts
FOR UPDATE
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete threads accounts in their workspaces"
ON threads_accounts
FOR DELETE
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

-- 4. posts テーブルのRLSポリシー
CREATE POLICY "Users can view posts in their workspaces"
ON posts
FOR SELECT
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert posts in their workspaces"
ON posts
FOR INSERT
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update posts in their workspaces"
ON posts
FOR UPDATE
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete posts in their workspaces"
ON posts
FOR DELETE
USING (
    workspace_id IN (
        SELECT workspace_id 
        FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);