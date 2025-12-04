-- Migration: Add missing columns and tables for proximity sharing
-- This works with existing tables

-- ============================================================================
-- STEP 1: Add missing columns to existing tables (if they don't exist)
-- ============================================================================

-- Add created_by to projects if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE projects ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Set existing projects to first user (you can update this manually later)
    UPDATE projects SET created_by = (SELECT id FROM auth.users LIMIT 1) WHERE created_by IS NULL;

    -- Make it NOT NULL after setting values
    ALTER TABLE projects ALTER COLUMN created_by SET NOT NULL;
  END IF;
END $$;

-- Add other potentially missing columns to projects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
    ALTER TABLE projects ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'genre') THEN
    ALTER TABLE projects ADD COLUMN genre TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'bpm') THEN
    ALTER TABLE projects ADD COLUMN bpm INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'key') THEN
    ALTER TABLE projects ADD COLUMN key TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create public.users table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create project_collaborators table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);

-- ============================================================================
-- STEP 4: Create proximity_sessions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS proximity_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id, device_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_project_id ON proximity_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_user_id ON proximity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_active ON proximity_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_proximity_sessions_last_seen ON proximity_sessions(last_seen);

-- ============================================================================
-- STEP 5: Create p2p_transfers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS p2p_transfers (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'transferring', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_transfer CHECK (sender_user_id != recipient_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_project_id ON p2p_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_sender ON p2p_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_recipient ON p2p_transfers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_status ON p2p_transfers(status);

-- ============================================================================
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE proximity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_transfers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS Policies
-- ============================================================================

-- Users policies
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Project collaborators policies
DROP POLICY IF EXISTS "Users can view collaborators for their projects" ON project_collaborators;
CREATE POLICY "Users can view collaborators for their projects"
  ON project_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;
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

-- Proximity sessions policies
DROP POLICY IF EXISTS "Users can view proximity sessions for their projects" ON proximity_sessions;
CREATE POLICY "Users can view proximity sessions for their projects"
  ON proximity_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = proximity_sessions.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own proximity sessions" ON proximity_sessions;
CREATE POLICY "Users can insert their own proximity sessions"
  ON proximity_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own proximity sessions" ON proximity_sessions;
CREATE POLICY "Users can update their own proximity sessions"
  ON proximity_sessions FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own proximity sessions" ON proximity_sessions;
CREATE POLICY "Users can delete their own proximity sessions"
  ON proximity_sessions FOR DELETE
  USING (user_id = auth.uid());

-- P2P transfers policies
DROP POLICY IF EXISTS "Users can view their transfers" ON p2p_transfers;
CREATE POLICY "Users can view their transfers"
  ON p2p_transfers FOR SELECT
  USING (
    sender_user_id = auth.uid() OR recipient_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert transfers they're sending" ON p2p_transfers;
CREATE POLICY "Users can insert transfers they're sending"
  ON p2p_transfers FOR INSERT
  WITH CHECK (sender_user_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can update transfer status" ON p2p_transfers;
CREATE POLICY "Recipients can update transfer status"
  ON p2p_transfers FOR UPDATE
  USING (recipient_user_id = auth.uid());

-- ============================================================================
-- STEP 8: Create helper functions
-- ============================================================================

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

-- Auto-update updated_at for proximity_sessions
CREATE OR REPLACE FUNCTION update_proximity_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proximity_sessions_updated_at ON proximity_sessions;
CREATE TRIGGER proximity_sessions_updated_at
  BEFORE UPDATE ON proximity_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_proximity_sessions_updated_at();

-- ============================================================================
-- STEP 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE proximity_sessions IS 'Tracks active proximity-based collaboration sessions';
COMMENT ON TABLE p2p_transfers IS 'Records peer-to-peer file transfer history';
COMMENT ON TABLE project_collaborators IS 'Project membership and user roles';

COMMENT ON COLUMN proximity_sessions.device_id IS 'Unique identifier for the device (not user_id, to support multiple devices)';
COMMENT ON COLUMN proximity_sessions.is_active IS 'Whether the session is currently active (auto-disabled after 5 min of inactivity)';
COMMENT ON COLUMN proximity_sessions.last_seen IS 'Last time this device was detected/updated';
COMMENT ON COLUMN p2p_transfers.status IS 'Transfer status: pending, transferring, completed, failed';
COMMENT ON COLUMN p2p_transfers.received_at IS 'Timestamp when recipient received the file';
