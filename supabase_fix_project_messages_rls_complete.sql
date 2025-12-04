-- Complete RLS Policies for Project Messages
-- Fixes error 42501: new row violates row-level security policy

-- ============================================================================
-- Drop existing policies to start fresh
-- ============================================================================

DROP POLICY IF EXISTS "Users can view messages for their projects" ON project_messages;
DROP POLICY IF EXISTS "Users can send messages to their projects" ON project_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON project_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON project_messages;

-- ============================================================================
-- Ensure RLS is enabled
-- ============================================================================

ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE COMPREHENSIVE POLICIES
-- ============================================================================

-- SELECT: View messages in projects you own or collaborate on
CREATE POLICY "View project messages"
  ON project_messages FOR SELECT
  USING (
    -- Project owner can see all messages
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    -- Collaborators can see all messages
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_messages.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

-- INSERT: Send messages to projects you own or collaborate on
CREATE POLICY "Send messages to projects"
  ON project_messages FOR INSERT
  WITH CHECK (
    -- Must be the message sender
    user_id = auth.uid()
    AND
    (
      -- Project owner can send messages
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_messages.project_id
        AND projects.creator_id = auth.uid()
      )
      OR
      -- Collaborators can send messages
      EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = project_messages.project_id
        AND project_collaborators.user_id = auth.uid()
      )
    )
  );

-- UPDATE: Only update your own messages
CREATE POLICY "Update own messages"
  ON project_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Only delete your own messages
CREATE POLICY "Delete own messages"
  ON project_messages FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON POLICY "View project messages" ON project_messages IS
  'Project owners and collaborators can view all messages in their projects';

COMMENT ON POLICY "Send messages to projects" ON project_messages IS
  'Project owners and collaborators can send messages to their projects';

COMMENT ON POLICY "Update own messages" ON project_messages IS
  'Users can only update their own messages';

COMMENT ON POLICY "Delete own messages" ON project_messages IS
  'Users can only delete their own messages';
