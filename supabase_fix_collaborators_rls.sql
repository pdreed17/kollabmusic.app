-- Fix Project Collaborators RLS Policies
-- Removes infinite recursion by simplifying policies

-- ============================================================================
-- Drop existing policies that might cause recursion
-- ============================================================================

DROP POLICY IF EXISTS "Users can view collaborators for their projects" ON project_collaborators;
DROP POLICY IF EXISTS "Users can add collaborators to their projects" ON project_collaborators;
DROP POLICY IF EXISTS "Users can update collaborators on their projects" ON project_collaborators;
DROP POLICY IF EXISTS "Users can remove collaborators from their projects" ON project_collaborators;
DROP POLICY IF EXISTS "Collaborators can view other collaborators" ON project_collaborators;

-- ============================================================================
-- Create simple, non-recursive policies
-- ============================================================================

-- Users can view collaborators for projects they own OR are collaborating on
CREATE POLICY "View project collaborators"
  ON project_collaborators FOR SELECT
  USING (
    -- Can see if you're the project owner
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    -- Can see if you're one of the collaborators (checking your own user_id)
    user_id = auth.uid()
  );

-- Only project owners can add collaborators
CREATE POLICY "Add collaborators"
  ON project_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- Only project owners can update collaborators
CREATE POLICY "Update collaborators"
  ON project_collaborators FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- Only project owners can remove collaborators
CREATE POLICY "Remove collaborators"
  ON project_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- Ensure RLS is enabled
-- ============================================================================

ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "View project collaborators" ON project_collaborators IS
  'Allows viewing collaborators if you own the project or are a collaborator';

COMMENT ON POLICY "Add collaborators" ON project_collaborators IS
  'Only project owners can add new collaborators';

COMMENT ON POLICY "Update collaborators" ON project_collaborators IS
  'Only project owners can update collaborator roles';

COMMENT ON POLICY "Remove collaborators" ON project_collaborators IS
  'Only project owners can remove collaborators';
