-- Complete Kollab Music Database Schema
-- Run this migration in order

-- ============================================================================
-- PART 1: CORE TABLES (Users, Projects, Collaborators)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (if not exists - Supabase Auth handles this)
-- This is just for reference, auth.users is managed by Supabase
-- We'll create a public.users table for profile data

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project collaborators table
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one role per user per project
  UNIQUE(project_id, user_id)
);

-- Audio files table
CREATE TABLE IF NOT EXISTS audio_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  format TEXT,
  stem_type TEXT,
  stem_name TEXT,
  duration_ms INTEGER,
  volume REAL DEFAULT 1.0,
  pan REAL DEFAULT 0.0,
  is_muted BOOLEAN DEFAULT false,
  is_soloed BOOLEAN DEFAULT false,
  color TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table (for chat and timeline comments)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_ms INTEGER, -- For timeline comments on audio
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PART 2: PROXIMITY SHARING TABLES
-- ============================================================================

-- Proximity sessions table
CREATE TABLE IF NOT EXISTS proximity_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one session per user/device/project
  UNIQUE(project_id, user_id, device_id)
);

-- P2P transfers table
CREATE TABLE IF NOT EXISTS p2p_transfers (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'transferring', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,

  -- Prevent self-transfers
  CONSTRAINT valid_transfer CHECK (sender_user_id != recipient_user_id)
);

-- ============================================================================
-- PART 3: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core tables indexes
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_project_id ON audio_files(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_created_by ON audio_files(created_by);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_audio_file_id ON comments(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Proximity sharing indexes
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_project_id ON proximity_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_user_id ON proximity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_active ON proximity_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_last_seen ON proximity_sessions(last_seen);

CREATE INDEX IF NOT EXISTS idx_p2p_transfers_project_id ON p2p_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_sender ON p2p_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_recipient ON p2p_transfers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_status ON p2p_transfers(status);

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proximity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_transfers ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view projects they collaborate on"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = projects.id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners can update projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = projects.id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role = 'owner'
    )
  );

CREATE POLICY "Project owners can delete projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = projects.id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role = 'owner'
    )
  );

-- Project collaborators policies
CREATE POLICY "Users can view collaborators for their projects"
  ON project_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage collaborators"
  ON project_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );

-- Audio files policies
CREATE POLICY "Users can view audio files for their projects"
  ON audio_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can upload audio files"
  ON audio_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Project editors can update audio files"
  ON audio_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Project editors can delete audio files"
  ON audio_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = audio_files.project_id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.role IN ('owner', 'editor')
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments for their projects"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = comments.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments on their projects"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = comments.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Proximity sessions policies
CREATE POLICY "Users can view proximity sessions for their projects"
  ON proximity_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = proximity_sessions.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own proximity sessions"
  ON proximity_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own proximity sessions"
  ON proximity_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own proximity sessions"
  ON proximity_sessions FOR DELETE
  USING (user_id = auth.uid());

-- P2P transfers policies
CREATE POLICY "Users can view their transfers"
  ON p2p_transfers FOR SELECT
  USING (
    sender_user_id = auth.uid() OR recipient_user_id = auth.uid()
  );

CREATE POLICY "Users can insert transfers they're sending"
  ON p2p_transfers FOR INSERT
  WITH CHECK (sender_user_id = auth.uid());

CREATE POLICY "Recipients can update transfer status"
  ON p2p_transfers FOR UPDATE
  USING (recipient_user_id = auth.uid());

-- ============================================================================
-- PART 5: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audio_files_updated_at ON audio_files;
CREATE TRIGGER update_audio_files_updated_at
  BEFORE UPDATE ON audio_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proximity_sessions_updated_at ON proximity_sessions;
CREATE TRIGGER update_proximity_sessions_updated_at
  BEFORE UPDATE ON proximity_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cleanup stale proximity sessions
CREATE OR REPLACE FUNCTION cleanup_stale_proximity_sessions()
RETURNS void AS $$
BEGIN
  UPDATE proximity_sessions
  SET is_active = false
  WHERE is_active = true
  AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-add project creator as owner collaborator
CREATE OR REPLACE FUNCTION add_project_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_collaborators (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS add_creator_as_owner ON projects;
CREATE TRIGGER add_creator_as_owner
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_project_creator_as_owner();

-- ============================================================================
-- PART 6: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.users IS 'User profile data (extends auth.users)';
COMMENT ON TABLE projects IS 'Music collaboration projects';
COMMENT ON TABLE project_collaborators IS 'Project membership and roles';
COMMENT ON TABLE audio_files IS 'Audio file metadata and mixer settings';
COMMENT ON TABLE comments IS 'Project chat messages and timeline comments';
COMMENT ON TABLE proximity_sessions IS 'Active proximity-based collaboration sessions';
COMMENT ON TABLE p2p_transfers IS 'Peer-to-peer file transfer history';

COMMENT ON COLUMN proximity_sessions.device_id IS 'Unique identifier for the device';
COMMENT ON COLUMN proximity_sessions.is_active IS 'Auto-disabled after 5 min of inactivity';
COMMENT ON COLUMN proximity_sessions.last_seen IS 'Last time this device was detected';
COMMENT ON COLUMN p2p_transfers.status IS 'Transfer status: pending, transferring, completed, failed';
