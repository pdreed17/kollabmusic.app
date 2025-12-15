-- Fix audio_files RLS policies
-- This ensures users can upload audio files to projects they own or collaborate on

-- Drop all existing policies
DROP POLICY IF EXISTS "Project editors can update audio files" ON audio_files;
DROP POLICY IF EXISTS "Project editors can delete audio files" ON audio_files;
DROP POLICY IF EXISTS "Project editors can upload audio files" ON audio_files;
DROP POLICY IF EXISTS "Users can view audio files for their projects" ON audio_files;
DROP POLICY IF EXISTS "Anyone can view audio files" ON audio_files;

-- Enable RLS
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audio files for projects they own or collaborate on
CREATE POLICY "Users can view audio files for their projects"
  ON audio_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_files.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.invitation_status = 'accepted'
    )
  );

-- Policy: Project owners and editors can upload audio files
CREATE POLICY "Project editors can upload audio files"
  ON audio_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_files.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
      AND project_collaborators.invitation_status = 'accepted'
    )
  );

-- Policy: Project owners and editors can update audio files
CREATE POLICY "Project editors can update audio files"
  ON audio_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_files.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
      AND project_collaborators.invitation_status = 'accepted'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_files.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
      AND project_collaborators.invitation_status = 'accepted'
    )
  );

-- Policy: Project owners and editors can delete audio files
CREATE POLICY "Project editors can delete audio files"
  ON audio_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_files.project_id
      AND projects.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
      AND project_collaborators.invitation_status = 'accepted'
    )
  );

-- Grant permissions
GRANT ALL ON audio_files TO authenticated;

COMMENT ON TABLE audio_files IS 'Audio files with RLS policies that allow project owners and editors to upload, update, and delete';
