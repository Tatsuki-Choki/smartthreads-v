-- FINAL FIX: Complete elimination of infinite recursion in workspace_members RLS policies
-- Execute this script in Supabase SQL editor: https://zndvvqezzmyhkpvnmakf.supabase.co

-- Step 1: Drop ALL existing policies on workspace_members (comprehensive cleanup)
DROP POLICY IF EXISTS "Users can view workspace members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves as workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON workspace_members;
DROP POLICY IF EXISTS "Users can view their own workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Admins can view all workspace members in their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert their own workspace membership" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can delete workspace members" ON workspace_members;

-- Step 2: Create completely non-recursive policies
-- These policies use ONLY direct user_id comparison and workspace_id checks
-- NO subqueries that reference workspace_members table

-- SELECT: Users can only see their own memberships
CREATE POLICY "simple_select_own_membership" 
ON workspace_members 
FOR SELECT 
USING (user_id = auth.uid());

-- INSERT: Users can only insert their own memberships
CREATE POLICY "simple_insert_own_membership" 
ON workspace_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own memberships (limited)
-- Note: For role changes, consider using a separate admin-only function
CREATE POLICY "simple_update_own_membership" 
ON workspace_members 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can only remove their own memberships
CREATE POLICY "simple_delete_own_membership" 
ON workspace_members 
FOR DELETE 
USING (user_id = auth.uid());

-- Step 3: Ensure RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Step 4: Verification query to confirm policies are correctly set
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'workspace_members'
ORDER BY policyname;

-- Step 5: Test the policies work correctly
-- Run this after the policies are created to verify no recursion errors:
-- SELECT * FROM workspace_members WHERE user_id = auth.uid();