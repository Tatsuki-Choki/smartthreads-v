# Infinite Recursion Fix for Supabase RLS Policies

## Problem Analysis

The infinite recursion error in your Supabase RLS policies was caused by policies on the `workspace_members` table that referenced the same table in their conditions. Specifically:

### Problematic Pattern
```sql
-- This causes recursion because it queries workspace_members from within a workspace_members policy
CREATE POLICY "example_policy" 
ON workspace_members 
FOR SELECT 
USING (
    workspace_id IN (
        SELECT wm.workspace_id 
        FROM workspace_members wm  -- ❌ RECURSION: querying the same table
        WHERE wm.user_id = auth.uid() 
        AND wm.role IN ('owner', 'admin')
    )
);
```

## Root Cause
When PostgreSQL evaluates RLS policies, it applies them to ALL queries on that table, including subqueries within the policy conditions themselves. This creates an infinite loop:

1. User queries `workspace_members`
2. Policy condition executes subquery on `workspace_members`
3. Subquery triggers the same policy
4. Policy condition executes subquery on `workspace_members`
5. **Infinite recursion** 🔄

## Solution: Completely Non-Recursive Policies

The fix implements the principle: **Never reference a table from within its own RLS policies**.

### Safe Pattern
```sql
-- ✅ SAFE: Only direct column comparisons, no subqueries to the same table
CREATE POLICY "simple_select_own_membership" 
ON workspace_members 
FOR SELECT 
USING (user_id = auth.uid());
```

## Implementation Steps

1. **Execute the SQL script**: Copy and paste the content of `fix_infinite_recursion_final.sql` into your Supabase SQL editor
2. **URL**: https://zndvvqezzmyhkpvnmakf.supabase.co
3. **Run the entire script**: This will drop all problematic policies and create simple, non-recursive ones

## Trade-offs

### What we're giving up:
- Complex role-based access (admins seeing all workspace members)
- Cross-table policy logic

### What we're gaining:
- ✅ No infinite recursion errors
- ✅ Simple, predictable policies
- ✅ Better performance (no complex subqueries)
- ✅ Easier to debug and maintain

## Alternative Approaches (for future consideration)

If you need admin users to see all workspace members, consider:

1. **Application-level logic**: Handle role-based access in your application code
2. **Database functions**: Create security definer functions that bypass RLS
3. **Separate admin tables**: Store admin permissions in a different table not referenced by policies
4. **View-based approach**: Create views with appropriate permissions

## Testing

After applying the fix, test with:
```sql
-- This should work without recursion errors
SELECT * FROM workspace_members WHERE user_id = auth.uid();
```

## Files Updated

- ✅ `fix_infinite_recursion_final.sql` - The corrected SQL to execute
- ✅ `RECURSION_FIX_EXPLANATION.md` - This explanation document

The existing files with recursion problems:
- ❌ `supabase/migrations/003_fix_rls_recursion.sql` - Still has recursion
- ❌ `fix_workspace_members_rls.sql` - Still has recursion