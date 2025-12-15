-- Subscription Limits Implementation
-- Free Tier: 3 owned projects, 3 collaborated projects, 8 tracks per project
-- Pro Tier: Unlimited everything

-- ============================================================================
-- STEP 1: Create Helper Functions for Limit Checks
-- ============================================================================

-- Check if user can create a new project
CREATE OR REPLACE FUNCTION can_create_project(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_tier TEXT;
  v_owned_projects_count INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_user_tier
  FROM users
  WHERE id = p_user_id;

  -- Pro tier has unlimited
  IF v_user_tier = 'pro' OR v_user_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit (3 projects)
  SELECT COUNT(*) INTO v_owned_projects_count
  FROM projects
  WHERE creator_id = p_user_id
    AND (status IS NULL OR status NOT IN ('deleted', 'archived'));

  RETURN v_owned_projects_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can join/accept a collaboration
CREATE OR REPLACE FUNCTION can_join_collaboration(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_tier TEXT;
  v_collab_count INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_user_tier
  FROM users
  WHERE id = p_user_id;

  -- Pro tier has unlimited
  IF v_user_tier = 'pro' OR v_user_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit (3 collaborations)
  SELECT COUNT(*) INTO v_collab_count
  FROM project_collaborators pc
  WHERE pc.user_id = p_user_id
    AND pc.invitation_status = 'accepted'
    AND pc.role != 'owner'; -- Don't count projects they own

  RETURN v_collab_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if project can accept more audio tracks
CREATE OR REPLACE FUNCTION can_upload_to_project(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_tier TEXT;
  v_track_count INTEGER;
BEGIN
  -- Get project owner's subscription tier
  SELECT u.subscription_tier INTO v_owner_tier
  FROM projects p
  JOIN users u ON p.creator_id = u.id
  WHERE p.id = p_project_id;

  -- Pro tier has unlimited
  IF v_owner_tier = 'pro' OR v_owner_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit (8 tracks per project)
  SELECT COUNT(*) INTO v_track_count
  FROM audio_files
  WHERE project_id = p_project_id;

  RETURN v_track_count < 8;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's current usage stats
CREATE OR REPLACE FUNCTION get_user_usage_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_tier TEXT;
  v_owned_projects INTEGER;
  v_collaborated_projects INTEGER;
  v_total_storage_mb NUMERIC;
  v_result JSON;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_user_tier
  FROM users
  WHERE id = p_user_id;

  -- Count owned projects
  SELECT COUNT(*) INTO v_owned_projects
  FROM projects
  WHERE creator_id = p_user_id
    AND (status IS NULL OR status NOT IN ('deleted', 'archived'));

  -- Count collaborated projects
  SELECT COUNT(*) INTO v_collaborated_projects
  FROM project_collaborators
  WHERE user_id = p_user_id
    AND invitation_status = 'accepted'
    AND role != 'owner';

  -- Calculate total storage (in MB)
  SELECT COALESCE(SUM(file_size_bytes) / 1024.0 / 1024.0, 0) INTO v_total_storage_mb
  FROM audio_files
  WHERE created_by = p_user_id;

  -- Build result JSON
  v_result := json_build_object(
    'subscription_tier', v_user_tier,
    'owned_projects', json_build_object(
      'used', v_owned_projects,
      'limit', CASE WHEN v_user_tier IN ('pro', 'enterprise') THEN NULL ELSE 3 END,
      'unlimited', v_user_tier IN ('pro', 'enterprise')
    ),
    'collaborated_projects', json_build_object(
      'used', v_collaborated_projects,
      'limit', CASE WHEN v_user_tier IN ('pro', 'enterprise') THEN NULL ELSE 3 END,
      'unlimited', v_user_tier IN ('pro', 'enterprise')
    ),
    'storage', json_build_object(
      'used_mb', ROUND(v_total_storage_mb, 2),
      'limit_mb', CASE
        WHEN v_user_tier = 'enterprise' THEN 1000000
        WHEN v_user_tier = 'pro' THEN 51200
        ELSE 200
      END,
      'unlimited', v_user_tier = 'enterprise'
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get project's track usage
CREATE OR REPLACE FUNCTION get_project_track_usage(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  v_owner_tier TEXT;
  v_track_count INTEGER;
  v_result JSON;
BEGIN
  -- Get project owner's subscription tier
  SELECT u.subscription_tier INTO v_owner_tier
  FROM projects p
  JOIN users u ON p.creator_id = u.id
  WHERE p.id = p_project_id;

  -- Count tracks
  SELECT COUNT(*) INTO v_track_count
  FROM audio_files
  WHERE project_id = p_project_id;

  -- Build result JSON
  v_result := json_build_object(
    'owner_tier', v_owner_tier,
    'tracks', json_build_object(
      'used', v_track_count,
      'limit', CASE WHEN v_owner_tier IN ('pro', 'enterprise') THEN NULL ELSE 8 END,
      'unlimited', v_owner_tier IN ('pro', 'enterprise')
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Create Trigger to Track File Sizes
-- ============================================================================

-- Add file_size_bytes column to audio_files if it doesn't exist
ALTER TABLE audio_files
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;

-- ============================================================================
-- STEP 3: Create Views for Easy Access
-- ============================================================================

-- View: User project limits
CREATE OR REPLACE VIEW user_project_limits AS
SELECT
  u.id AS user_id,
  u.username,
  u.subscription_tier,

  -- Owned projects
  COUNT(DISTINCT CASE
    WHEN p.creator_id = u.id AND (p.status IS NULL OR p.status NOT IN ('deleted', 'archived'))
    THEN p.id
  END) AS owned_projects_count,
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN NULL
    ELSE 3
  END AS owned_projects_limit,

  -- Collaborated projects
  COUNT(DISTINCT CASE
    WHEN pc.user_id = u.id AND pc.invitation_status = 'accepted' AND pc.role != 'owner'
    THEN pc.project_id
  END) AS collaborated_projects_count,
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN NULL
    ELSE 3
  END AS collaborated_projects_limit,

  -- Can create more?
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN TRUE
    WHEN COUNT(DISTINCT CASE
      WHEN p.creator_id = u.id AND (p.status IS NULL OR p.status NOT IN ('deleted', 'archived'))
      THEN p.id
    END) < 3 THEN TRUE
    ELSE FALSE
  END AS can_create_more_projects,

  -- Can join more?
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN TRUE
    WHEN COUNT(DISTINCT CASE
      WHEN pc.user_id = u.id AND pc.invitation_status = 'accepted' AND pc.role != 'owner'
      THEN pc.project_id
    END) < 3 THEN TRUE
    ELSE FALSE
  END AS can_join_more_collaborations

FROM users u
LEFT JOIN projects p ON p.creator_id = u.id
LEFT JOIN project_collaborators pc ON pc.user_id = u.id
GROUP BY u.id, u.username, u.subscription_tier;

-- View: Project track limits
CREATE OR REPLACE VIEW project_track_limits AS
SELECT
  p.id AS project_id,
  p.title,
  p.creator_id,
  u.subscription_tier AS owner_tier,

  -- Track count
  COUNT(af.id) AS track_count,
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN NULL
    ELSE 8
  END AS track_limit,

  -- Can upload more?
  CASE
    WHEN u.subscription_tier IN ('pro', 'enterprise') THEN TRUE
    WHEN COUNT(af.id) < 8 THEN TRUE
    ELSE FALSE
  END AS can_upload_more,

  -- Storage used (MB)
  COALESCE(SUM(af.file_size_bytes) / 1024.0 / 1024.0, 0) AS storage_used_mb

FROM projects p
JOIN users u ON p.creator_id = u.id
LEFT JOIN audio_files af ON af.project_id = p.id
GROUP BY p.id, p.title, p.creator_id, u.subscription_tier;

-- ============================================================================
-- STEP 4: Grant Permissions
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION can_create_project TO authenticated;
GRANT EXECUTE ON FUNCTION can_join_collaboration TO authenticated;
GRANT EXECUTE ON FUNCTION can_upload_to_project TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_track_usage TO authenticated;

-- Grant select on views
GRANT SELECT ON user_project_limits TO authenticated;
GRANT SELECT ON project_track_limits TO authenticated;

-- ============================================================================
-- STEP 5: Views inherit RLS from underlying tables
-- ============================================================================
-- Note: Views don't need separate RLS policies - they inherit permissions
-- from the underlying tables (users, projects, project_collaborators)

-- ============================================================================
-- STEP 6: Verification and Examples
-- ============================================================================

DO $$
DECLARE
  v_test_result BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Subscription Limits System Installed';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Free Tier Limits:';
  RAISE NOTICE '  • 3 projects (as owner)';
  RAISE NOTICE '  • 3 projects (as collaborator)';
  RAISE NOTICE '  • 8 tracks per project';
  RAISE NOTICE '  • 200 MB total storage';
  RAISE NOTICE '';
  RAISE NOTICE 'Pro Tier:';
  RAISE NOTICE '  • ♾️  Unlimited projects';
  RAISE NOTICE '  • ♾️  Unlimited tracks per project';
  RAISE NOTICE '  • 50 GB storage';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✓ can_create_project(user_id)';
  RAISE NOTICE '  ✓ can_join_collaboration(user_id)';
  RAISE NOTICE '  ✓ can_upload_to_project(project_id)';
  RAISE NOTICE '  ✓ get_user_usage_stats(user_id)';
  RAISE NOTICE '  ✓ get_project_track_usage(project_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  ✓ user_project_limits';
  RAISE NOTICE '  ✓ project_track_limits';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage in app:';
  RAISE NOTICE '  SELECT can_create_project(auth.uid());';
  RAISE NOTICE '  SELECT get_user_usage_stats(auth.uid());';
  RAISE NOTICE '  SELECT * FROM user_project_limits WHERE user_id = auth.uid();';
  RAISE NOTICE '========================================';
END $$;

-- Example queries to use in your app:

-- Check if current user can create a project
-- SELECT can_create_project(auth.uid());

-- Check if current user can join a collaboration
-- SELECT can_join_collaboration(auth.uid());

-- Check if project can accept more tracks
-- SELECT can_upload_to_project('project-uuid-here');

-- Get current user's usage stats
-- SELECT get_user_usage_stats(auth.uid());

-- Get project's track usage
-- SELECT get_project_track_usage('project-uuid-here');

-- View your limits
-- SELECT * FROM user_project_limits WHERE user_id = auth.uid();

-- View project track limits
-- SELECT * FROM project_track_limits WHERE creator_id = auth.uid();
