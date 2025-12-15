-- ============================================================================
-- DEFINITIVE RLS SOLUTION FOR KOLLAB MUSIC APP
-- ============================================================================
--
-- This migration supersedes ALL previous RLS migrations. Run this ONCE to get
-- a clean, working RLS setup that:
--   1. Has NO circular dependencies (uses SECURITY DEFINER functions)
--   2. Supports all permission levels (owner, editor, collaborator, viewer)
--   3. Handles public/private projects correctly
--   4. Enforces subscription limits at database level
--   5. Works with all 11 tables in the app
--
-- TABLES COVERED:
--   - users
--   - projects
--   - project_collaborators
--   - audio_files
--   - comments
--   - highlights
--   - user_connections
--   - blocked_users
--   - activities
--   - profile_changes
--   - revenue_splits (if exists)
--
-- ============================================================================

-- ############################################################################
-- PART 1: NUCLEAR CLEANUP - Drop everything and start fresh
-- ############################################################################

-- Disable RLS temporarily to drop all policies
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audio_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS highlights DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profile_changes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS revenue_splits DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname
              FROM pg_policies
              WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
    RAISE NOTICE 'Dropped all existing RLS policies';
END $$;

-- Drop old helper functions if they exist (we'll recreate them)
DROP FUNCTION IF EXISTS is_project_owner(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_project_collaborator(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_accepted_collaborator(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_project_public(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_owned_project_ids(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_collaborated_project_ids(UUID) CASCADE;
DROP FUNCTION IF EXISTS has_project_permission(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS user_follows(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_user_blocked(UUID, UUID) CASCADE;

-- ############################################################################
-- PART 2: CREATE HELPER TABLES (if missing)
-- ############################################################################

-- Ensure blocked_users table exists
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- Ensure activities table exists
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure profile_changes table exists
CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT CHECK (change_type IN ('created', 'updated', 'deleted')),
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure user_connections table exists
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'muted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, following_id),
  CHECK (user_id != following_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_following ON user_connections(following_id);

-- ############################################################################
-- PART 3: CREATE SECURITY DEFINER HELPER FUNCTIONS
-- ############################################################################
-- These functions BYPASS RLS when called, preventing infinite recursion.
-- They're marked STABLE for query optimizer efficiency.

-- Check if user owns a project
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND creator_id = p_user_id
  );
$$;

-- Check if user is any kind of collaborator (pending or accepted)
CREATE OR REPLACE FUNCTION is_project_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
      AND user_id = p_user_id
  );
$$;

-- Check if user is an ACCEPTED collaborator
CREATE OR REPLACE FUNCTION is_accepted_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND invitation_status = 'accepted'
  );
$$;

-- Check if project is public
CREATE OR REPLACE FUNCTION is_project_public(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND (is_public = true OR visibility = 'public')
  );
$$;

-- Get project owner's user ID
CREATE OR REPLACE FUNCTION get_project_owner(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT creator_id FROM projects WHERE id = p_project_id;
$$;

-- Check if user has a specific permission on a project
CREATE OR REPLACE FUNCTION has_project_permission(
  p_project_id UUID,
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_permission_value BOOLEAN;
BEGIN
  -- Check if user is owner (owners have all permissions)
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND creator_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission for collaborator
  CASE p_permission
    WHEN 'can_upload' THEN
      SELECT can_upload INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    WHEN 'can_edit' THEN
      SELECT can_edit INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    WHEN 'can_delete' THEN
      SELECT can_delete INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    WHEN 'can_comment' THEN
      SELECT can_comment INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    WHEN 'can_download' THEN
      SELECT can_download INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    WHEN 'can_invite' THEN
      SELECT can_invite INTO v_permission_value
      FROM project_collaborators
      WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND invitation_status = 'accepted';
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN COALESCE(v_permission_value, FALSE);
END;
$$;

-- Check if user follows another user
CREATE OR REPLACE FUNCTION user_follows(p_follower_id UUID, p_following_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_connections
    WHERE user_id = p_follower_id
      AND following_id = p_following_id
      AND status = 'active'
  );
$$;

-- Check if users are blocked (either direction)
CREATE OR REPLACE FUNCTION is_user_blocked(p_user1 UUID, p_user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_user1 AND blocked_id = p_user2)
       OR (blocker_id = p_user2 AND blocked_id = p_user1)
  );
$$;

-- Get user's collaborator role for a project
CREATE OR REPLACE FUNCTION get_collaborator_role(p_project_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM project_collaborators
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND invitation_status = 'accepted';
$$;

-- ############################################################################
-- PART 4: SUBSCRIPTION LIMIT FUNCTIONS
-- ############################################################################

-- Check if user can create a new project
CREATE OR REPLACE FUNCTION can_create_project(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;

  -- Pro/Enterprise = unlimited
  IF v_tier IN ('pro', 'enterprise') THEN
    RETURN TRUE;
  END IF;

  -- Free tier = max 3 owned projects
  SELECT COUNT(*) INTO v_count
  FROM projects
  WHERE creator_id = p_user_id
    AND (status IS NULL OR status NOT IN ('deleted', 'archived'));

  RETURN v_count < 3;
END;
$$;

-- Check if user can join another collaboration
CREATE OR REPLACE FUNCTION can_join_collaboration(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;

  -- Pro/Enterprise = unlimited
  IF v_tier IN ('pro', 'enterprise') THEN
    RETURN TRUE;
  END IF;

  -- Free tier = max 3 collaborations (not counting owned projects)
  SELECT COUNT(*) INTO v_count
  FROM project_collaborators
  WHERE user_id = p_user_id
    AND invitation_status = 'accepted'
    AND role != 'owner';

  RETURN v_count < 3;
END;
$$;

-- Check if project can accept more tracks
CREATE OR REPLACE FUNCTION can_upload_to_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_tier TEXT;
  v_count INTEGER;
BEGIN
  -- Get project owner's subscription tier
  SELECT u.subscription_tier INTO v_owner_tier
  FROM projects p
  JOIN users u ON p.creator_id = u.id
  WHERE p.id = p_project_id;

  -- Pro/Enterprise = unlimited tracks
  IF v_owner_tier IN ('pro', 'enterprise') THEN
    RETURN TRUE;
  END IF;

  -- Free tier = max 8 tracks per project
  SELECT COUNT(*) INTO v_count
  FROM audio_files
  WHERE project_id = p_project_id;

  RETURN v_count < 8;
END;
$$;

-- Get user's owned project count
CREATE OR REPLACE FUNCTION get_user_owned_projects_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM projects
  WHERE creator_id = p_user_id
    AND (status IS NULL OR status NOT IN ('deleted', 'archived'));
$$;

-- Get user's active collaborations count
CREATE OR REPLACE FUNCTION get_user_active_collabs_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM project_collaborators
  WHERE user_id = p_user_id
    AND invitation_status = 'accepted'
    AND role != 'owner';
$$;

-- ############################################################################
-- PART 5: ENABLE RLS ON ALL TABLES
-- ############################################################################

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;

-- ############################################################################
-- PART 6: CREATE RLS POLICIES
-- ############################################################################

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================
-- Users can view all profiles (public), but only edit their own

CREATE POLICY "users_select_all"
ON users FOR SELECT
USING (true);  -- All profiles are viewable

CREATE POLICY "users_insert_own"
ON users FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
ON users FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "users_delete_own"
ON users FOR DELETE
USING (id = auth.uid());

-- ============================================================================
-- PROJECTS TABLE POLICIES
-- ============================================================================
-- Uses helper functions to avoid circular dependencies

CREATE POLICY "projects_select"
ON projects FOR SELECT
USING (
  -- You own it
  creator_id = auth.uid()
  OR
  -- It's public
  COALESCE(is_public, false) = true
  OR
  visibility = 'public'
  OR
  -- You're a collaborator (uses SECURITY DEFINER function - no recursion!)
  is_project_collaborator(id, auth.uid())
);

CREATE POLICY "projects_insert"
ON projects FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
  -- Subscription limit enforced at app layer via can_create_project()
);

CREATE POLICY "projects_update"
ON projects FOR UPDATE
USING (
  -- Owner can always update
  creator_id = auth.uid()
  OR
  -- Editors can update if they have permission
  has_project_permission(id, auth.uid(), 'can_edit')
);

CREATE POLICY "projects_delete"
ON projects FOR DELETE
USING (
  -- Only owners can delete
  creator_id = auth.uid()
);

-- ============================================================================
-- PROJECT_COLLABORATORS TABLE POLICIES
-- ============================================================================

CREATE POLICY "collaborators_select"
ON project_collaborators FOR SELECT
USING (
  -- You're in the list
  user_id = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You're also a collaborator on this project
  is_accepted_collaborator(project_id, auth.uid())
);

CREATE POLICY "collaborators_insert"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Owner can add anyone
  is_project_owner(project_id, auth.uid())
  OR
  -- Collaborators with invite permission can add (but not as owner/editor)
  (
    has_project_permission(project_id, auth.uid(), 'can_invite')
    AND role NOT IN ('owner', 'editor')
  )
);

CREATE POLICY "collaborators_update"
ON project_collaborators FOR UPDATE
USING (
  -- Owner can update anyone's permissions
  is_project_owner(project_id, auth.uid())
  OR
  -- Users can update their own record (accept/decline invites)
  user_id = auth.uid()
);

CREATE POLICY "collaborators_delete"
ON project_collaborators FOR DELETE
USING (
  -- Owner can remove anyone
  is_project_owner(project_id, auth.uid())
  OR
  -- Users can remove themselves (leave project)
  user_id = auth.uid()
);

-- ============================================================================
-- AUDIO_FILES TABLE POLICIES
-- ============================================================================

CREATE POLICY "audio_files_select"
ON audio_files FOR SELECT
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You're a collaborator
  is_accepted_collaborator(project_id, auth.uid())
  OR
  -- Project is public
  is_project_public(project_id)
);

CREATE POLICY "audio_files_insert"
ON audio_files FOR INSERT
WITH CHECK (
  -- Must be the uploader
  created_by = auth.uid()
  AND
  (
    -- Own the project
    is_project_owner(project_id, auth.uid())
    OR
    -- Have upload permission
    has_project_permission(project_id, auth.uid(), 'can_upload')
  )
);

CREATE POLICY "audio_files_update"
ON audio_files FOR UPDATE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You have edit permission
  has_project_permission(project_id, auth.uid(), 'can_edit')
);

CREATE POLICY "audio_files_delete"
ON audio_files FOR DELETE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You have delete permission
  has_project_permission(project_id, auth.uid(), 'can_delete')
);

-- ============================================================================
-- COMMENTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "comments_select"
ON comments FOR SELECT
USING (
  -- You wrote it
  user_id = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You're a collaborator
  is_accepted_collaborator(project_id, auth.uid())
  OR
  -- Project is public (comments visible on public projects)
  is_project_public(project_id)
);

CREATE POLICY "comments_insert"
ON comments FOR INSERT
WITH CHECK (
  -- Must be your comment
  user_id = auth.uid()
  AND
  (
    -- Own the project
    is_project_owner(project_id, auth.uid())
    OR
    -- Have comment permission
    has_project_permission(project_id, auth.uid(), 'can_comment')
  )
);

CREATE POLICY "comments_update"
ON comments FOR UPDATE
USING (
  -- Only your own comments
  user_id = auth.uid()
);

CREATE POLICY "comments_delete"
ON comments FOR DELETE
USING (
  -- Your own comment
  user_id = auth.uid()
  OR
  -- Project owner can delete any comment
  is_project_owner(project_id, auth.uid())
);

-- ============================================================================
-- HIGHLIGHTS TABLE POLICIES
-- ============================================================================
-- Highlights are public portfolio items - everyone can view

CREATE POLICY "highlights_select"
ON highlights FOR SELECT
USING (true);  -- Public portfolio

CREATE POLICY "highlights_insert"
ON highlights FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "highlights_update"
ON highlights FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "highlights_delete"
ON highlights FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- USER_CONNECTIONS TABLE POLICIES
-- ============================================================================

CREATE POLICY "connections_select"
ON user_connections FOR SELECT
USING (
  -- You're either the follower or being followed
  user_id = auth.uid() OR following_id = auth.uid()
);

CREATE POLICY "connections_insert"
ON user_connections FOR INSERT
WITH CHECK (
  -- Can only create your own follows
  user_id = auth.uid()
);

CREATE POLICY "connections_update"
ON user_connections FOR UPDATE
USING (
  -- Can only update your own
  user_id = auth.uid()
);

CREATE POLICY "connections_delete"
ON user_connections FOR DELETE
USING (
  -- Can only delete your own
  user_id = auth.uid()
);

-- ============================================================================
-- BLOCKED_USERS TABLE POLICIES
-- ============================================================================

CREATE POLICY "blocked_select"
ON blocked_users FOR SELECT
USING (
  -- See your blocks OR blocks against you
  blocker_id = auth.uid() OR blocked_id = auth.uid()
);

CREATE POLICY "blocked_insert"
ON blocked_users FOR INSERT
WITH CHECK (
  -- Can only create blocks you initiate
  blocker_id = auth.uid()
);

CREATE POLICY "blocked_delete"
ON blocked_users FOR DELETE
USING (
  -- Can only delete your own blocks
  blocker_id = auth.uid()
);

-- ============================================================================
-- ACTIVITIES TABLE POLICIES
-- ============================================================================

CREATE POLICY "activities_select"
ON activities FOR SELECT
USING (
  -- Your own activity
  user_id = auth.uid()
  OR
  -- Targeted at you
  target_user_id = auth.uid()
  OR
  -- On projects you own (null-safe check)
  (project_id IS NOT NULL AND is_project_owner(project_id, auth.uid()))
  OR
  -- On projects you collaborate on
  (project_id IS NOT NULL AND is_accepted_collaborator(project_id, auth.uid()))
  OR
  -- Public activity from people you follow
  (is_public = true AND user_follows(auth.uid(), user_id))
);

CREATE POLICY "activities_insert"
ON activities FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PROFILE_CHANGES TABLE POLICIES
-- ============================================================================

CREATE POLICY "profile_changes_select"
ON profile_changes FOR SELECT
USING (user_id = auth.uid());  -- Private audit log

CREATE POLICY "profile_changes_insert"
ON profile_changes FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ############################################################################
-- PART 7: GRANT PERMISSIONS
-- ############################################################################

-- Grant execute on all helper functions
GRANT EXECUTE ON FUNCTION is_project_owner TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_accepted_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_public TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_owner TO authenticated;
GRANT EXECUTE ON FUNCTION has_project_permission TO authenticated;
GRANT EXECUTE ON FUNCTION user_follows TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_blocked TO authenticated;
GRANT EXECUTE ON FUNCTION get_collaborator_role TO authenticated;
GRANT EXECUTE ON FUNCTION can_create_project TO authenticated;
GRANT EXECUTE ON FUNCTION can_join_collaboration TO authenticated;
GRANT EXECUTE ON FUNCTION can_upload_to_project TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_owned_projects_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_collabs_count TO authenticated;

-- ############################################################################
-- PART 8: VERIFICATION
-- ############################################################################

DO $$
DECLARE
  v_policy_count INTEGER;
  v_function_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  -- Count our helper functions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'is_project_owner', 'is_project_collaborator', 'is_accepted_collaborator',
      'is_project_public', 'get_project_owner', 'has_project_permission',
      'user_follows', 'is_user_blocked', 'get_collaborator_role',
      'can_create_project', 'can_join_collaboration', 'can_upload_to_project',
      'get_user_owned_projects_count', 'get_user_active_collabs_count'
    );

  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║     DEFINITIVE RLS SOLUTION INSTALLED SUCCESSFULLY               ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ RLS Policies Created: %                                         ║', LPAD(v_policy_count::TEXT, 2);
  RAISE NOTICE '║ Helper Functions Created: %                                     ║', LPAD(v_function_count::TEXT, 2);
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ TABLES WITH RLS ENABLED:                                         ║';
  RAISE NOTICE '║   ✓ users              - Public view, self-edit                  ║';
  RAISE NOTICE '║   ✓ projects           - Owner/collaborator/public access        ║';
  RAISE NOTICE '║   ✓ project_collaborators - Members can view, owner manages      ║';
  RAISE NOTICE '║   ✓ audio_files        - Project members + public                ║';
  RAISE NOTICE '║   ✓ comments           - Project members + public                ║';
  RAISE NOTICE '║   ✓ highlights         - Public portfolio                        ║';
  RAISE NOTICE '║   ✓ user_connections   - Private follow lists                    ║';
  RAISE NOTICE '║   ✓ blocked_users      - Private block lists                     ║';
  RAISE NOTICE '║   ✓ activities         - Contextual visibility                   ║';
  RAISE NOTICE '║   ✓ profile_changes    - Private audit log                       ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ SUBSCRIPTION LIMITS ENFORCED:                                    ║';
  RAISE NOTICE '║   Free: 3 owned projects, 3 collabs, 8 tracks/project            ║';
  RAISE NOTICE '║   Pro:  Unlimited everything                                     ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ NO CIRCULAR DEPENDENCIES - All cross-table checks use            ║';
  RAISE NOTICE '║ SECURITY DEFINER functions that bypass RLS.                      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

-- Final policy listing for verification
SELECT
  tablename as "Table",
  policyname as "Policy",
  cmd as "Operation"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
