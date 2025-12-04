-- Fix Project Chat RLS Policies
-- Updates policies to also check project creator, not just collaborators table

-- ============================================================================
-- Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view messages for their projects" ON project_messages;
DROP POLICY IF EXISTS "Users can create messages on their projects" ON project_messages;

-- ============================================================================
-- Create new policies that check both creator and collaborators
-- ============================================================================

-- Users can view messages for projects they created or collaborate on
CREATE POLICY "Users can view messages for their projects"
  ON project_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (
        projects.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_collaborators
          WHERE project_collaborators.project_id = projects.id
          AND project_collaborators.user_id = auth.uid()
        )
      )
    )
  );

-- Users can create messages on projects they created or collaborate on
CREATE POLICY "Users can create messages on their projects"
  ON project_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (
        projects.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_collaborators
          WHERE project_collaborators.project_id = projects.id
          AND project_collaborators.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Users can view messages for their projects" ON project_messages IS
  'Allows viewing messages for projects where user is creator or accepted collaborator';

COMMENT ON POLICY "Users can create messages on their projects" ON project_messages IS
  'Allows creating messages on projects where user is creator or accepted collaborator';
