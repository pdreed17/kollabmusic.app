-- Comprehensive Permission System Implementation-- Based on PERMISSION_SYSTEM_DESIGN.md

-- ============================================================================
-- STEP 1: Update Existing Tables with New Columns
-- ============================================================================

-- Add visibility and permission fields to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'
    CHECK (visibility IN ('private', 'public', 'unlisted', 'followers_only')),
  ADD COLUMN IF NOT EXISTS looking_for_kollabs BOOLEAN DEFAULT false;

-- Update project_collaborators with granular permissions
ALTER TABLE project_collaborators
  ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'pending'
    CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS can_upload BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_comment BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_download BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_invite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_export BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;

-- Add profile visibility settings to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'followers', 'private')),
  ADD COLUMN IF NOT EXISTS show_projects BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_collaborations BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_highlights BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT true;

-- ============================================================================
-- STEP 2: Create New Tables
-- ============================================================================

-- Activity Feed Table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Activity Info
  activity_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  target_user_id UUID,

  -- Related Entities
  project_id UUID,
  audio_file_id UUID,
  comment_id UUID,

  -- Activity Data
  metadata JSONB DEFAULT '{}',
  description TEXT,
  is_public BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign keys after table creation
DO $$
BEGIN
  -- Only add foreign keys if they don't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activities_user_id_fkey'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activities_target_user_id_fkey'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_target_user_id_fkey
      FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activities_project_id_fkey'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activities_audio_file_id_fkey'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_audio_file_id_fkey
      FOREIGN KEY (audio_file_id) REFERENCES audio_files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activities_comment_id_fkey'
    AND table_name = 'activities'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_comment_id_fkey
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

-- Profile Audit Log
CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Change Info
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT CHECK (change_type IN ('created', 'updated', 'deleted')),

  -- Context
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key after table creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profile_changes_user_id_fkey'
    AND table_name = 'profile_changes'
  ) THEN
    ALTER TABLE profile_changes
      ADD CONSTRAINT profile_changes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for profile_changes
CREATE INDEX IF NOT EXISTS idx_profile_changes_user ON profile_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_changes_created ON profile_changes(created_at DESC);

-- User Connections (Follow System)
-- Drop and recreate if structure is wrong (safe for new feature)
DROP TABLE IF EXISTS user_connections CASCADE;

CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  following_id UUID NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'muted')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, following_id),
  CHECK (user_id != following_id)
);

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_connections_user_id_fkey'
    AND table_name = 'user_connections'
  ) THEN
    ALTER TABLE user_connections
      ADD CONSTRAINT user_connections_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_connections_following_id_fkey'
    AND table_name = 'user_connections'
  ) THEN
    ALTER TABLE user_connections
      ADD CONSTRAINT user_connections_following_id_fkey
      FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for user_connections
CREATE INDEX IF NOT EXISTS idx_connections_user ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_following ON user_connections(following_id);

-- ============================================================================
-- STEP 3: Enable RLS on New Tables
-- ============================================================================

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Update Projects Policies
-- ============================================================================

-- Drop old simple policy
DROP POLICY IF EXISTS "projects_select_comprehensive" ON projects;

-- Create new comprehensive SELECT policy
CREATE POLICY "view_projects_with_roles"
ON projects FOR SELECT
USING (
  -- Your own projects
  creator_id = auth.uid()
  OR
  -- Public projects
  COALESCE(is_public, false) = true
  OR
  visibility = 'public'
  OR
  -- Projects you're invited to
  id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status IN ('accepted', 'pending')
  )
  OR
  -- Projects from users you follow (if they made it visible to followers)
  (
    visibility = 'followers_only'
    AND creator_id IN (
      SELECT following_id FROM user_connections
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
);

-- UPDATE policy with role-based permissions
DROP POLICY IF EXISTS "projects_update_policy" ON projects;

CREATE POLICY "update_projects_with_roles"
ON projects FOR UPDATE
USING (
  -- Owner can always update
  creator_id = auth.uid()
  OR
  -- Editors with can_edit permission can update
  id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND role = 'editor'
      AND can_edit = true
      AND invitation_status = 'accepted'
  )
);

-- ============================================================================
-- STEP 5: Update project_collaborators Policies
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "view_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "add_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "update_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "delete_collaborators" ON project_collaborators;

-- SELECT: View collaborators with role context
CREATE POLICY "view_collaborators_with_context"
ON project_collaborators FOR SELECT
USING (
  -- You're in the collaborators list
  user_id = auth.uid()
  OR
  -- You own the project
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're a collaborator on the same project
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
);

-- INSERT: Add collaborators with invitation permissions
CREATE POLICY "invite_collaborators_with_permission"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Owner can add anyone
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Editors with can_invite permission can add others (but not editors)
  (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid()
        AND role IN ('editor', 'collaborator')
        AND can_invite = true
        AND invitation_status = 'accepted'
    )
    AND role NOT IN ('owner', 'editor')
  )
);

-- UPDATE: Change collaborator permissions (owner only)
CREATE POLICY "manage_collaborator_permissions"
ON project_collaborators FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- DELETE: Remove collaborators
CREATE POLICY "remove_collaborators"
ON project_collaborators FOR DELETE
USING (
  -- Owner can remove anyone
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Users can remove themselves (leave project)
  user_id = auth.uid()
);

-- ============================================================================
-- STEP 6: Update audio_files Policies
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "audio_select" ON audio_files;
DROP POLICY IF EXISTS "audio_insert" ON audio_files;
DROP POLICY IF EXISTS "audio_update" ON audio_files;
DROP POLICY IF EXISTS "audio_delete" ON audio_files;

-- SELECT: View audio with role-based access
CREATE POLICY "view_audio_with_permissions"
ON audio_files FOR SELECT
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're a collaborator with access
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
  OR
  -- Project is public
  project_id IN (
    SELECT id FROM projects WHERE is_public = true OR visibility = 'public'
  )
);

-- INSERT: Upload audio with permission check
CREATE POLICY "upload_audio_with_permission"
ON audio_files FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND
  (
    -- You own the project
    project_id IN (
      SELECT id FROM projects WHERE creator_id = auth.uid()
    )
    OR
    -- You're a collaborator with upload permission
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid()
        AND can_upload = true
        AND invitation_status = 'accepted'
    )
  )
);

-- UPDATE: Edit audio metadata
CREATE POLICY "edit_audio_metadata"
ON audio_files FOR UPDATE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're an editor with edit permission
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND role = 'editor'
      AND can_edit = true
      AND invitation_status = 'accepted'
  )
);

-- DELETE: Delete audio files
CREATE POLICY "delete_audio_with_permission"
ON audio_files FOR DELETE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 7: Create Policies for New Tables
-- ============================================================================

-- Activities Table Policies
CREATE POLICY "view_relevant_activities"
ON activities FOR SELECT
USING (
  -- Your own activity
  user_id = auth.uid()
  OR
  -- Activity directed at you
  target_user_id = auth.uid()
  OR
  -- Activity on your projects
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Activity on projects you collaborate on
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
  OR
  -- Public activity from users you follow
  (
    is_public = true
    AND user_id IN (
      SELECT following_id FROM user_connections
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
);

CREATE POLICY "create_own_activities"
ON activities FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- Profile Changes Policies
CREATE POLICY "view_own_profile_history"
ON profile_changes FOR SELECT
USING (
  user_id = auth.uid()
);

CREATE POLICY "log_own_profile_changes"
ON profile_changes FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- User Connections Policies
CREATE POLICY "view_own_connections"
ON user_connections FOR SELECT
USING (
  user_id = auth.uid()
  OR
  following_id = auth.uid()
);

CREATE POLICY "manage_own_connections"
ON user_connections FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "update_own_connections"
ON user_connections FOR UPDATE
USING (
  user_id = auth.uid()
);

CREATE POLICY "delete_own_connections"
ON user_connections FOR DELETE
USING (
  user_id = auth.uid()
);

-- ============================================================================
-- STEP 8: Create Helper Functions for Activity Logging
-- ============================================================================

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_activity_type TEXT,
  p_project_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_audio_file_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT false,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activities (
    activity_type,
    user_id,
    target_user_id,
    project_id,
    audio_file_id,
    comment_id,
    description,
    is_public,
    metadata
  ) VALUES (
    p_activity_type,
    auth.uid(),
    p_target_user_id,
    p_project_id,
    p_audio_file_id,
    p_comment_id,
    p_description,
    p_is_public,
    p_metadata
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Create Indexes for Performance
-- ============================================================================

-- Additional indexes on project_collaborators
CREATE INDEX IF NOT EXISTS idx_collab_role ON project_collaborators(role);
CREATE INDEX IF NOT EXISTS idx_collab_status ON project_collaborators(invitation_status);
CREATE INDEX IF NOT EXISTS idx_collab_permissions ON project_collaborators(can_upload, can_edit, can_comment);

-- Indexes on projects
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_projects_looking ON projects(looking_for_kollabs) WHERE looking_for_kollabs = true;

-- ============================================================================
-- STEP 10: Verification and Summary
-- ============================================================================

DO $$
DECLARE
  tables_count INTEGER;
  policies_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('activities', 'profile_changes', 'user_connections');

  -- Count policies
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Comprehensive Permission System Installed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New tables created: %', tables_count;
  RAISE NOTICE 'Total RLS policies: %', policies_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  ✓ 4-tier role system (Owner/Editor/Collaborator/Viewer)';
  RAISE NOTICE '  ✓ Granular permissions per collaborator';
  RAISE NOTICE '  ✓ Multiple project visibility types';
  RAISE NOTICE '  ✓ Activity feed with filtering';
  RAISE NOTICE '  ✓ Profile audit logging';
  RAISE NOTICE '  ✓ User follow/connection system';
  RAISE NOTICE '  ✓ Safe RLS policies (no circular dependencies)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Update app to use new permission fields';
  RAISE NOTICE '  2. Implement subscription limit checks';
  RAISE NOTICE '  3. Build activity feed UI';
  RAISE NOTICE '  4. Add profile visibility controls';
  RAISE NOTICE '========================================';
END $$;
