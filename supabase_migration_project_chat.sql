-- Migration: Add Project Chat (separate from audio timeline comments)
-- Creates a dedicated chat system for project-level discussions

-- ============================================================================
-- Create project_messages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT false,

  -- For threading/replies (future feature)
  reply_to UUID REFERENCES project_messages(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_user_id ON project_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON project_messages(created_at DESC);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can view messages for projects they collaborate on
DROP POLICY IF EXISTS "Users can view messages for their projects" ON project_messages;
CREATE POLICY "Users can view messages for their projects"
  ON project_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_messages.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

-- Users can create messages on their projects
DROP POLICY IF EXISTS "Users can create messages on their projects" ON project_messages;
CREATE POLICY "Users can create messages on their projects"
  ON project_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_messages.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

-- Users can update their own messages
DROP POLICY IF EXISTS "Users can update their own messages" ON project_messages;
CREATE POLICY "Users can update their own messages"
  ON project_messages FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON project_messages;
CREATE POLICY "Users can delete their own messages"
  ON project_messages FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_messages_updated_at ON project_messages;
CREATE TRIGGER update_project_messages_updated_at
  BEFORE UPDATE ON project_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_project_messages_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE project_messages IS 'Project-level chat messages (separate from audio timeline comments)';
COMMENT ON COLUMN project_messages.content IS 'Message text content';
COMMENT ON COLUMN project_messages.is_edited IS 'Whether message has been edited after creation';
COMMENT ON COLUMN project_messages.reply_to IS 'Optional: ID of message being replied to (for threading)';
