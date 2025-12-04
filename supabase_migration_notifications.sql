-- Migration: Add Notifications System
-- Creates inbox/notifications for project activities

-- ============================================================================
-- Create notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('project_message', 'comment', 'collaborator_added', 'file_uploaded', 'mention')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_message_id UUID REFERENCES project_messages(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata JSON for additional context
  metadata JSONB
);

-- Add missing columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add read column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT false;
  END IF;

  -- Add project_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  -- Add project_message_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'project_message_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN project_message_id UUID REFERENCES project_messages(id) ON DELETE CASCADE;
  END IF;

  -- Add comment_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'comment_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
  END IF;

  -- Add related_user_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'related_user_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add metadata column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- System can create notifications for any user
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Function: Create notification for project message
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_project_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  project_title TEXT;
  collaborator_record RECORD;
BEGIN
  -- Get sender display name
  SELECT COALESCE(display_name, username) INTO sender_name
  FROM public.users
  WHERE id = NEW.user_id;

  -- Get project title
  SELECT title INTO project_title
  FROM projects
  WHERE id = NEW.project_id;

  -- Create notification for all collaborators except sender
  FOR collaborator_record IN
    SELECT DISTINCT user_id
    FROM project_collaborators
    WHERE project_id = NEW.project_id
    AND user_id != NEW.user_id
    UNION
    SELECT creator_id as user_id
    FROM projects
    WHERE id = NEW.project_id
    AND creator_id != NEW.user_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      project_id,
      project_message_id,
      related_user_id
    ) VALUES (
      collaborator_record.user_id,
      'project_message',
      project_title,
      sender_name || ' sent a message',
      NEW.project_id,
      NEW.id,
      NEW.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project messages
DROP TRIGGER IF EXISTS trigger_notify_project_message ON project_messages;
CREATE TRIGGER trigger_notify_project_message
  AFTER INSERT ON project_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_message();

-- ============================================================================
-- Function: Create notification for timeline comment
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_timeline_comment()
RETURNS TRIGGER AS $$
DECLARE
  commenter_name TEXT;
  project_title TEXT;
  audio_file_name TEXT;
  target_project_id UUID;
  collaborator_record RECORD;
BEGIN
  -- Only notify for timeline comments (those with timestamp_ms)
  IF NEW.timestamp_ms IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get project_id from audio_file (comments are linked to audio_files, not directly to projects)
  IF NEW.audio_file_id IS NOT NULL THEN
    SELECT project_id, file_name INTO target_project_id, audio_file_name
    FROM audio_files
    WHERE id = NEW.audio_file_id;
  ELSE
    -- If no audio_file_id, we can't determine the project, so skip notification
    RETURN NEW;
  END IF;

  -- Get commenter display name
  SELECT COALESCE(display_name, username) INTO commenter_name
  FROM public.users
  WHERE id = NEW.user_id;

  -- Get project title
  SELECT title INTO project_title
  FROM projects
  WHERE id = target_project_id;

  -- Create notification for all collaborators except commenter
  FOR collaborator_record IN
    SELECT DISTINCT user_id
    FROM project_collaborators
    WHERE project_id = target_project_id
    AND user_id != NEW.user_id
    UNION
    SELECT creator_id as user_id
    FROM projects
    WHERE id = target_project_id
    AND creator_id != NEW.user_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      project_id,
      comment_id,
      related_user_id
    ) VALUES (
      collaborator_record.user_id,
      'comment',
      project_title,
      commenter_name || ' commented on ' || COALESCE(audio_file_name, 'a track'),
      target_project_id,
      NEW.id,
      NEW.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comments
DROP TRIGGER IF EXISTS trigger_notify_timeline_comment ON comments;
CREATE TRIGGER trigger_notify_timeline_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_timeline_comment();

-- ============================================================================
-- Helper function: Mark notification as read
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE id = notification_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper function: Mark all notifications as read
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE user_id = auth.uid()
  AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE notifications IS 'User notifications/inbox for project activities';
COMMENT ON COLUMN notifications.type IS 'Type of notification: project_message, comment, collaborator_added, file_uploaded, mention';
COMMENT ON COLUMN notifications.metadata IS 'Additional context data as JSON';
