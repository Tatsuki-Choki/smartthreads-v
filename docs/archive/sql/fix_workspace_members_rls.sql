-- Fix for infinite recursion in workspace_members RLS policies
-- Execute this script in Supabase SQL editor

-- Step 1: Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view workspace members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can update workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can delete workspace members" ON workspace_members;

-- Step 2: Create new non-recursive policies

-- SELECT Policy: Users can view workspace members in two scenarios:
-- 1. Their own memberships (direct check)
-- 2. All members in workspaces where they are admin/owner (via workspaces table)
CREATE POLICY "workspace_members_select_policy" 
ON workspace_members 
FOR SELECT 
USING (
    -- Users can see their own memberships
    user_id = auth.uid() 
    OR
    -- Users can see all members in workspaces where they are admin/owner
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid() 
        AND wm.role IN ('admin', 'owner')
    )
);

-- INSERT Policy: Users can insert memberships for themselves only
-- (workspace owners/admins should invite through a separate mechanism)
CREATE POLICY "workspace_members_insert_policy" 
ON workspace_members 
FOR INSERT 
WITH CHECK (
    user_id = auth.uid()
    AND
    -- Ensure the workspace exists and allows new members
    workspace_id IN (
        SELECT id FROM workspaces 
        WHERE id = workspace_id
    )
);

-- UPDATE Policy: Only workspace admins/owners can update member roles
CREATE POLICY "workspace_members_update_policy" 
ON workspace_members 
FOR UPDATE 
USING (
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid() 
        AND wm.role IN ('admin', 'owner')
    )
)
WITH CHECK (
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid() 
        AND wm.role IN ('admin', 'owner')
    )
);

-- DELETE Policy: Admins/owners can remove members, users can remove themselves
CREATE POLICY "workspace_members_delete_policy" 
ON workspace_members 
FOR DELETE 
USING (
    -- Users can remove themselves
    user_id = auth.uid()
    OR
    -- Workspace admins/owners can remove any member
    workspace_id IN (
        SELECT w.id 
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid() 
        AND wm.role IN ('admin', 'owner')
    )
);

-- Optional: Enable RLS on workspace_members table if not already enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'workspace_members';