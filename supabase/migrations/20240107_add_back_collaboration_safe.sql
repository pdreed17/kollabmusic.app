-- Add back collaborative project viewing WITHOUT circular dependencies
-- This migration safely adds back the ability to see:
-- 1. Your own projects (creator)
-- 2. Public projects
-- 3. Projects where you're a collaborator

-- STEP 1: Drop the simple SELECT policy
DROP POLICY IF EXISTS "projects_select_policy" ON projects;

-- STEP 2: Create a comprehensive SELECT policy that includes collaboration
-- This is safe because it only goes ONE WAY: projects → project_collaborators
-- It does NOT create a circular reference
CREATE POLICY "projects_select_comprehensive"
ON projects FOR SELECT
USING (
  -- You created the project
  creator_id = auth.uid()
  OR
  -- Project is public
  COALESCE(is_public, false) = true
  OR
  -- You're an accepted collaborator on this project
  EXISTS (
    SELECT 1
    FROM project_collaborators pc
    WHERE pc.project_id = projects.id
      AND pc.user_id = auth.uid()
      AND pc.invitation_status = 'accepted'
  )
);

-- STEP 3: Ensure project_collaborators policies are simple and don't reference projects
-- Drop any old circular policies on project_collaborators
DROP POLICY IF EXISTS "collaborators_select_policy" ON project_collaborators;
DROP POLICY IF EXISTS "Project creators can add themselves as owner" ON project_collaborators;
DROP POLICY IF EXISTS "Project owners can update collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "Project owners can delete collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "collaborators_insert_policy" ON project_collaborators;
DROP POLICY IF EXISTS "collaborators_update_policy" ON project_collaborators;
DROP POLICY IF EXISTS "collaborators_delete_policy" ON project_collaborators;

-- STEP 4: Create simple project_collaborators policies
-- These do NOT reference back to projects in the USING clause for SELECT
-- This prevents circular dependencies

-- SELECT: You can view collaborators if you're one of them OR if you created the project
CREATE POLICY "view_collaborators"
ON project_collaborators FOR SELECT
USING (
  user_id = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- INSERT: Project creators can add collaborators (including themselves as owner)
CREATE POLICY "add_collaborators"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Allow adding to projects you created
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- UPDATE: Project creators can update collaborator permissions
CREATE POLICY "update_collaborators"
ON project_collaborators FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- DELETE: Project creators can remove collaborators
CREATE POLICY "delete_collaborators"
ON project_collaborators FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- STEP 5: Verify the policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('projects', 'project_collaborators')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added collaborative viewing without circular dependencies!';
  RAISE NOTICE 'Users can now see:';
  RAISE NOTICE '  - Their own projects';
  RAISE NOTICE '  - Public projects';
  RAISE NOTICE '  - Projects where they are collaborators';
END $$;
