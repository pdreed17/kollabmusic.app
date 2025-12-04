-- Fix audio_files RLS policies to use correct table name 'collaborators' instead of 'project_collaborators'
-- This fixes the issue where users cannot update audio files they created

-- Drop existing policies
DROP POLICY IF EXISTS "Project editors can update audio files" ON audio_files;
DROP POLICY IF EXISTS "Project editors can delete audio files" ON audio_files;
DROP POLICY IF EXISTS "Project editors can upload audio files" ON audio_files;
DROP POLICY IF EXISTS "Users can view audio files for their projects" ON audio_files;

-- Recreate policies with correct table name
CREATE POLICY "Users can view audio files for their projects"
  ON audio_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collaborators
      WHERE collaborators.project_id = audio_files.project_id
      AND collaborators.user_id = auth.uid()
      AND collaborators.invitation_status = 'accepted'
    )
  );

CREATE POLICY "Project editors can upload audio files"
  ON audio_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collaborators
      WHERE collaborators.project_id = audio_files.project_id
      AND collaborators.user_id = auth.uid()
      AND collaborators.role IN ('owner', 'editor')
      AND collaborators.invitation_status = 'accepted'
    )
  );

CREATE POLICY "Project editors can update audio files"
  ON audio_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collaborators
      WHERE collaborators.project_id = audio_files.project_id
      AND collaborators.user_id = auth.uid()
      AND collaborators.role IN ('owner', 'editor')
      AND collaborators.invitation_status = 'accepted'
    )
  );

CREATE POLICY "Project editors can delete audio files"
  ON audio_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collaborators
      WHERE collaborators.project_id = audio_files.project_id
      AND collaborators.user_id = auth.uid()
      AND collaborators.role IN ('owner', 'editor')
      AND collaborators.invitation_status = 'accepted'
    )
  );
