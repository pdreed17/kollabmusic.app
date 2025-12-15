-- Fix project creation RLS policies
-- This migration fixes both the projects and project_collaborators tables

-- PART 1: Fix projects table RLS policy

-- Drop and recreate the projects INSERT policy to ensure it's correctly configured
DROP POLICY IF EXISTS "Users can create projects" ON projects;

CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- PART 2: Fix project_collaborators table RLS policies

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;

-- Allow project creators to add themselves as owner when creating a project
CREATE POLICY "Project creators can add themselves as owner"
  ON project_collaborators
  FOR INSERT
  WITH CHECK (
    -- Allow if user is adding themselves as owner to a project they created
    (user_id = auth.uid() AND role = 'owner' AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND p.created_by = auth.uid()
    ))
    OR
    -- OR if they're already an owner of the project (for adding other collaborators)
    (EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    ))
  );

-- Allow project owners to update collaborator permissions
CREATE POLICY "Project owners can update collaborators"
  ON project_collaborators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );

-- Allow project owners to remove collaborators
CREATE POLICY "Project owners can delete collaborators"
  ON project_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );
