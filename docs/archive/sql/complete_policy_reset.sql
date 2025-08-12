-- workspace_membersテーブルのRLSを一時的に無効化してポリシーを完全削除
ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;

-- すべてのworkspace_membersポリシーを完全削除
DO $$ 
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'workspace_members'
    LOOP
        EXECUTE format('DROP POLICY %I ON workspace_members', policy_name);
    END LOOP;
END $$;

-- RLSを再度有効化
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 最もシンプルなポリシーのみ作成
CREATE POLICY "allow_own_membership_select" 
ON workspace_members 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "allow_own_membership_insert" 
ON workspace_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- 確認
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'workspace_members';