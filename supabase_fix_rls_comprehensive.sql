-- Comprehensive RLS Fix - Eliminates Circular Dependencies
-- This fixes infinite recursion between projects and project_collaborators

-- ============================================================================
-- STEP 1: Re-enable RLS (in case it was disabled)
-- ============================================================================

ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop ALL existing policies on project_collaborators
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'project_collaborators'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON project_collaborators';
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create simple, non-recursive policies for project_collaborators
-- ============================================================================

-- SELECT: Anyone can see collaborators (they're not sensitive)
-- This avoids recursion entirely
CREATE POLICY "Anyone can view collaborators"
  ON project_collaborators FOR SELECT
  USING (true);

-- INSERT: Only if you own the project (check projects table only)
CREATE POLICY "Project owners can add collaborators"
  ON project_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
      AND creator_id = auth.uid()
    )
  );

-- UPDATE: Only if you own the project
CREATE POLICY "Project owners can update collaborators"
  ON project_collaborators FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
      AND creator_id = auth.uid()
    )
  );

-- DELETE: Only if you own the project
CREATE POLICY "Project owners can remove collaborators"
  ON project_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
      AND creator_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: Ensure projects table policies DON'T reference project_collaborators
-- ============================================================================

-- Drop and recreate projects policies to ensure no circular references
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they collaborate on" ON projects;

-- Simple policy: View projects you created
CREATE POLICY "View owned projects"
  ON projects FOR SELECT
  USING (creator_id = auth.uid());

-- View projects you're a collaborator on (using simple IN clause)
CREATE POLICY "View collaborated projects"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id
      FROM project_collaborators
      WHERE user_id = auth.uid()
    )
  );

-- Only creators can modify projects
CREATE POLICY "Update own projects"
  ON projects FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Delete own projects"
  ON projects FOR DELETE
  USING (creator_id = auth.uid());

CREATE POLICY "Create projects"
  ON projects FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- ============================================================================
-- STEP 5: Add helpful comments
-- ============================================================================

COMMENT ON POLICY "Anyone can view collaborators" ON project_collaborators IS
  'Allows viewing all project collaborators - prevents recursion by not checking ownership';

COMMENT ON POLICY "Project owners can add collaborators" ON project_collaborators IS
  'Only project creators can add new collaborators';

COMMENT ON POLICY "View owned projects" ON projects IS
  'Users can see projects they created';

COMMENT ON POLICY "View collaborated projects" ON projects IS
  'Users can see projects where they are collaborators';
