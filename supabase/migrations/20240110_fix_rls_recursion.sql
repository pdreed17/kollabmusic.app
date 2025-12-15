-- FIX: Infinite Recursion in RLS Policies
-- Problem: projects policy checks project_collaborators, which checks projects = infinite loop
-- Solution: Use SECURITY DEFINER functions to bypass RLS when checking permissions

-- ============================================================================
-- STEP 1: Create Helper Functions (SECURITY DEFINER bypasses RLS)
-- ============================================================================

-- Check if user owns a project (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
    AND creator_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is a collaborator on a project (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND invitation_status IN ('accepted', 'pending')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has accepted collaboration on a project (bypasses RLS)
CREATE OR REPLACE FUNCTION is_accepted_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND invitation_status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if project is public (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_public(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
    AND (is_public = true OR visibility = 'public')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all project IDs user owns (bypasses RLS)
CREATE OR REPLACE FUNCTION get_owned_project_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY SELECT id FROM projects WHERE creator_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all project IDs user collaborates on (bypasses RLS)
CREATE OR REPLACE FUNCTION get_collaborated_project_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT project_id FROM project_collaborators
  WHERE user_id = p_user_id
  AND invitation_status IN ('accepted', 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has specific permission on project (bypasses RLS)
CREATE OR REPLACE FUNCTION has_project_permission(p_project_id UUID, p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_result BOOLEAN;
BEGIN
  -- Check if owner
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND creator_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check collaborator permission
  EXECUTE format(
    'SELECT COALESCE(%I, false) FROM project_collaborators WHERE project_id = $1 AND user_id = $2 AND invitation_status = ''accepted''',
    p_permission
  ) INTO v_result USING p_project_id, p_user_id;

  RETURN COALESCE(v_result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user follows another user (bypasses RLS)
CREATE OR REPLACE FUNCTION user_follows(p_user_id UUID, p_following_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_connections
    WHERE user_id = p_user_id
    AND following_id = p_following_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 2: Drop ALL Existing RLS Policies (Clean Slate)
-- ============================================================================

-- Drop projects policies
DROP POLICY IF EXISTS "view_projects_with_roles" ON projects;
DROP POLICY IF EXISTS "update_projects_with_roles" ON projects;
DROP POLICY IF EXISTS "projects_select_comprehensive" ON projects;
DROP POLICY IF EXISTS "projects_update_policy" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- Drop project_collaborators policies
DROP POLICY IF EXISTS "view_collaborators_with_context" ON project_collaborators;
DROP POLICY IF EXISTS "invite_collaborators_with_permission" ON project_collaborators;
DROP POLICY IF EXISTS "manage_collaborator_permissions" ON project_collaborators;
DROP POLICY IF EXISTS "remove_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "view_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "add_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "update_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "delete_collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_select" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_insert" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_update" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_delete" ON project_collaborators;

-- Drop audio_files policies
DROP POLICY IF EXISTS "view_audio_with_permissions" ON audio_files;
DROP POLICY IF EXISTS "upload_audio_with_permission" ON audio_files;
DROP POLICY IF EXISTS "edit_audio_metadata" ON audio_files;
DROP POLICY IF EXISTS "delete_audio_with_permission" ON audio_files;
DROP POLICY IF EXISTS "audio_select" ON audio_files;
DROP POLICY IF EXISTS "audio_insert" ON audio_files;
DROP POLICY IF EXISTS "audio_update" ON audio_files;
DROP POLICY IF EXISTS "audio_delete" ON audio_files;

-- Drop activities policies
DROP POLICY IF EXISTS "view_relevant_activities" ON activities;
DROP POLICY IF EXISTS "create_own_activities" ON activities;

-- ============================================================================
-- STEP 3: Create NEW Non-Recursive Policies
-- ============================================================================

-- PROJECTS Policies (using functions to avoid recursion)
CREATE POLICY "projects_select_safe"
ON projects FOR SELECT
USING (
  -- Your own projects (direct check, no recursion)
  creator_id = auth.uid()
  OR
  -- Public projects (direct check)
  COALESCE(is_public, false) = true
  OR
  visibility = 'public'
  OR
  -- Projects you collaborate on (uses SECURITY DEFINER function)
  id IN (SELECT get_collaborated_project_ids(auth.uid()))
);

CREATE POLICY "projects_insert_safe"
ON projects FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
);

CREATE POLICY "projects_update_safe"
ON projects FOR UPDATE
USING (
  -- Owner can always update
  creator_id = auth.uid()
  OR
  -- Editors with permission can update
  has_project_permission(id, auth.uid(), 'can_edit')
);

CREATE POLICY "projects_delete_safe"
ON projects FOR DELETE
USING (
  creator_id = auth.uid()
);

-- PROJECT_COLLABORATORS Policies (using functions to avoid recursion)
CREATE POLICY "project_collaborators_select_safe"
ON project_collaborators FOR SELECT
USING (
  -- You're in the list
  user_id = auth.uid()
  OR
  -- You own the project (uses SECURITY DEFINER function)
  is_project_owner(project_id, auth.uid())
  OR
  -- You're also a collaborator on this project
  is_accepted_collaborator(project_id, auth.uid())
);

CREATE POLICY "project_collaborators_insert_safe"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Owner can add anyone
  is_project_owner(project_id, auth.uid())
  OR
  -- Collaborators with invite permission can add (but not make owners/editors)
  (
    has_project_permission(project_id, auth.uid(), 'can_invite')
    AND role NOT IN ('owner', 'editor')
  )
);

CREATE POLICY "project_collaborators_update_safe"
ON project_collaborators FOR UPDATE
USING (
  -- Only owner can update collaborator permissions
  is_project_owner(project_id, auth.uid())
  OR
  -- Users can update their own record (accept/decline invitation)
  user_id = auth.uid()
);

CREATE POLICY "project_collaborators_delete_safe"
ON project_collaborators FOR DELETE
USING (
  -- Owner can remove anyone
  is_project_owner(project_id, auth.uid())
  OR
  -- Users can remove themselves
  user_id = auth.uid()
);

-- AUDIO_FILES Policies (using functions to avoid recursion)
CREATE POLICY "audio_files_select_safe"
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

CREATE POLICY "audio_files_insert_safe"
ON audio_files FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND
  (
    -- You own the project
    is_project_owner(project_id, auth.uid())
    OR
    -- You have upload permission
    has_project_permission(project_id, auth.uid(), 'can_upload')
  )
);

CREATE POLICY "audio_files_update_safe"
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

CREATE POLICY "audio_files_delete_safe"
ON audio_files FOR DELETE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
);

-- ACTIVITIES Policies (using functions to avoid recursion)
CREATE POLICY "activities_select_safe"
ON activities FOR SELECT
USING (
  -- Your own activity
  user_id = auth.uid()
  OR
  -- Targeted at you
  target_user_id = auth.uid()
  OR
  -- Activity on projects you own
  (project_id IS NOT NULL AND is_project_owner(project_id, auth.uid()))
  OR
  -- Activity on projects you collaborate on
  (project_id IS NOT NULL AND is_accepted_collaborator(project_id, auth.uid()))
  OR
  -- Public activity
  is_public = true
);

CREATE POLICY "activities_insert_safe"
ON activities FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================================================
-- STEP 4: Grant Execute Permissions on Helper Functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_project_owner TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_accepted_collaborator TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_public TO authenticated;
GRANT EXECUTE ON FUNCTION get_owned_project_ids TO authenticated;
GRANT EXECUTE ON FUNCTION get_collaborated_project_ids TO authenticated;
GRANT EXECUTE ON FUNCTION has_project_permission TO authenticated;
GRANT EXECUTE ON FUNCTION user_follows TO authenticated;

-- ============================================================================
-- STEP 5: Verification
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE '%_safe';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Recursion Fix Applied';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Safe policies created: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✓ Created SECURITY DEFINER helper functions';
  RAISE NOTICE '  ✓ Dropped all old recursive policies';
  RAISE NOTICE '  ✓ Created new non-recursive policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions created:';
  RAISE NOTICE '  • is_project_owner(project_id, user_id)';
  RAISE NOTICE '  • is_project_collaborator(project_id, user_id)';
  RAISE NOTICE '  • is_accepted_collaborator(project_id, user_id)';
  RAISE NOTICE '  • is_project_public(project_id)';
  RAISE NOTICE '  • get_owned_project_ids(user_id)';
  RAISE NOTICE '  • get_collaborated_project_ids(user_id)';
  RAISE NOTICE '  • has_project_permission(project_id, user_id, permission)';
  RAISE NOTICE '  • user_follows(user_id, following_id)';
  RAISE NOTICE '========================================';
END $$;
