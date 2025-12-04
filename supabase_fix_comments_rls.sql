-- Fix Comments RLS Policies
-- Ensures project owners and collaborators can properly view and delete comments

-- ============================================================================
-- Drop existing comment policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view comments for their projects" ON comments;
DROP POLICY IF EXISTS "Users can create comments on their projects" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

-- ============================================================================
-- Create improved comment policies
-- ============================================================================

-- SELECT: View comments if you're the project owner OR a collaborator
CREATE POLICY "View comments for accessible projects"
  ON comments FOR SELECT
  USING (
    -- Can view if you're the project owner
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    -- Can view if you're a collaborator
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = comments.project_id
      AND project_collaborators.user_id = auth.uid()
    )
    OR
    -- Can view if the project is public
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND (projects.is_public = true OR projects.looking_for_collaborators = true)
    )
  );

-- INSERT: Create comments if you're the owner or collaborator
CREATE POLICY "Create comments on accessible projects"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      -- Can comment if you're the project owner
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = comments.project_id
        AND projects.creator_id = auth.uid()
      )
      OR
      -- Can comment if you're a collaborator
      EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = comments.project_id
        AND project_collaborators.user_id = auth.uid()
      )
    )
  );

-- UPDATE: Users can update their own comments
CREATE POLICY "Update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Users can delete their own comments, OR project owner can delete any comment
CREATE POLICY "Delete own comments or owner can delete"
  ON comments FOR DELETE
  USING (
    -- Can delete your own comments
    auth.uid() = user_id
    OR
    -- Project owner can delete any comment on their project
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- Ensure RLS is enabled
-- ============================================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "View comments for accessible projects" ON comments IS
  'Allows viewing comments if you are the project owner, a collaborator, or if the project is public';

COMMENT ON POLICY "Create comments on accessible projects" ON comments IS
  'Allows creating comments if you are the project owner or a collaborator';

COMMENT ON POLICY "Update own comments" ON comments IS
  'Users can only update their own comments';

COMMENT ON POLICY "Delete own comments or owner can delete" ON comments IS
  'Users can delete their own comments, and project owners can delete any comment on their project';
