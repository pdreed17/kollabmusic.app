-- ============================================================================
-- EMERGENCY RLS FIX - Diagnose and fix infinite recursion
-- ============================================================================
-- Run this in Supabase SQL Editor

-- STEP 1: Show ALL current policies (to diagnose)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- STEP 2: Check if helper functions exist
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_project_owner', 'is_project_collaborator', 'is_accepted_collaborator', 'is_project_public')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- IF YOU STILL SEE RECURSION, RUN THE FIX BELOW:
-- ============================================================================

-- Drop ALL policies on projects (nuclear option)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Drop ALL policies on project_collaborators
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'project_collaborators' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON project_collaborators', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Recreate helper functions (in case they're corrupted/missing)
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND creator_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_project_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_accepted_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND invitation_status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION is_project_public(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND (is_public = true OR visibility = 'public')
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_project_owner TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_accepted_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_public TO authenticated;

-- ============================================================================
-- CREATE ULTRA-SIMPLE POLICIES (No function calls at all for projects)
-- ============================================================================

-- PROJECTS: Ultra-simple policy that CANNOT recurse
CREATE POLICY "projects_select_simple"
ON projects FOR SELECT
USING (
  creator_id = auth.uid()
  OR COALESCE(is_public, false) = true
  OR visibility = 'public'
);

-- We'll add collaborator access via a separate, safe approach
-- First, let's make sure basic access works

CREATE POLICY "projects_insert_simple"
ON projects FOR INSERT
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "projects_update_simple"
ON projects FOR UPDATE
USING (creator_id = auth.uid());

CREATE POLICY "projects_delete_simple"
ON projects FOR DELETE
USING (creator_id = auth.uid());

-- PROJECT_COLLABORATORS: Simple policies
CREATE POLICY "collaborators_select_simple"
ON project_collaborators FOR SELECT
USING (
  user_id = auth.uid()
  OR is_project_owner(project_id, auth.uid())
);

CREATE POLICY "collaborators_insert_simple"
ON project_collaborators FOR INSERT
WITH CHECK (is_project_owner(project_id, auth.uid()));

CREATE POLICY "collaborators_update_simple"
ON project_collaborators FOR UPDATE
USING (
  is_project_owner(project_id, auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "collaborators_delete_simple"
ON project_collaborators FOR DELETE
USING (
  is_project_owner(project_id, auth.uid())
  OR user_id = auth.uid()
);

-- ============================================================================
-- NOW ADD COLLABORATOR ACCESS TO PROJECTS (using a safe function)
-- ============================================================================

-- Drop the simple select policy
DROP POLICY IF EXISTS "projects_select_simple" ON projects;

-- Create a better one that includes collaborator check
CREATE POLICY "projects_select_complete"
ON projects FOR SELECT
USING (
  creator_id = auth.uid()
  OR COALESCE(is_public, false) = true
  OR visibility = 'public'
  OR is_project_collaborator(id, auth.uid())
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Projects policies:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public';

SELECT 'Project_collaborators policies:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'project_collaborators' AND schemaname = 'public';

SELECT 'Helper functions:' as info;
SELECT proname, prosecdef as security_definer FROM pg_proc
WHERE proname LIKE 'is_project%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test query (should NOT cause recursion)
SELECT 'Testing projects query...' as info;
SELECT id, title FROM projects LIMIT 1;

SELECT 'SUCCESS! No infinite recursion.' as result;
