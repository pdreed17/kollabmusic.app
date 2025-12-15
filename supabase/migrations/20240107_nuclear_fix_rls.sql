-- NUCLEAR OPTION: Complete RLS Reset
-- This will forcefully remove ALL policies and create simple new ones

-- STEP 1: Disable RLS on all tables
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audio_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS highlights DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_users DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL policies using a loop (catches any policy we might have missed)
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
END $$;

-- STEP 3: Verify all policies are gone
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    IF policy_count > 0 THEN
        RAISE EXCEPTION 'Failed to drop all policies. % policies remain', policy_count;
    ELSE
        RAISE NOTICE 'Successfully dropped all policies';
    END IF;
END $$;

-- STEP 4: Re-enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create SIMPLE policies with NO circular dependencies

-- ============================================================================
-- PROJECTS TABLE - Simple policies that DON'T reference other tables
-- ============================================================================

-- Allow users to SELECT their own projects
CREATE POLICY "projects_select"
ON projects FOR SELECT
USING (creator_id = auth.uid());

-- Allow users to INSERT projects they create
CREATE POLICY "projects_insert"
ON projects FOR INSERT
WITH CHECK (creator_id = auth.uid());

-- Allow users to UPDATE their own projects
CREATE POLICY "projects_update"
ON projects FOR UPDATE
USING (creator_id = auth.uid());

-- Allow users to DELETE their own projects
CREATE POLICY "projects_delete"
ON projects FOR DELETE
USING (creator_id = auth.uid());

-- ============================================================================
-- PROJECT_COLLABORATORS TABLE
-- ============================================================================

-- Allow users to view collaborators for their own projects
CREATE POLICY "collaborators_select"
ON project_collaborators FOR SELECT
USING (
  user_id = auth.uid()
  OR
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

-- Allow project creators to add collaborators
CREATE POLICY "collaborators_insert"
ON project_collaborators FOR INSERT
WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

-- Allow project creators to update collaborators
CREATE POLICY "collaborators_update"
ON project_collaborators FOR UPDATE
USING (
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

-- Allow project creators to delete collaborators
CREATE POLICY "collaborators_delete"
ON project_collaborators FOR DELETE
USING (
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

-- ============================================================================
-- AUDIO_FILES TABLE
-- ============================================================================

CREATE POLICY "audio_select"
ON audio_files FOR SELECT
USING (
  created_by = auth.uid()
  OR
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

CREATE POLICY "audio_insert"
ON audio_files FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "audio_update"
ON audio_files FOR UPDATE
USING (
  created_by = auth.uid()
  OR
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

CREATE POLICY "audio_delete"
ON audio_files FOR DELETE
USING (
  created_by = auth.uid()
  OR
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
);

-- ============================================================================
-- COMMENTS TABLE
-- ============================================================================

CREATE POLICY "comments_select"
ON comments FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "comments_insert"
ON comments FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_update"
ON comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "comments_delete"
ON comments FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- HIGHLIGHTS TABLE
-- ============================================================================

CREATE POLICY "highlights_select"
ON highlights FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "highlights_insert"
ON highlights FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "highlights_update"
ON highlights FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "highlights_delete"
ON highlights FOR DELETE
USING (user_id = auth.uid());

-- STEP 6: Verify new policies were created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('projects', 'project_collaborators', 'audio_files', 'comments', 'highlights');

    RAISE NOTICE 'Created % new RLS policies', policy_count;

    IF policy_count < 20 THEN
        RAISE WARNING 'Expected at least 20 policies, only created %', policy_count;
    END IF;
END $$;

-- FINAL CHECK: List all policies
SELECT
    tablename,
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
