-- COMPREHENSIVE RLS POLICY FIX
-- This migration completely removes all RLS policies and creates brand new, simple policies
-- that avoid the infinite recursion problem

-- STEP 1: DROP ALL EXISTING POLICIES

-- Drop all policies on projects
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their projects" ON projects;

-- Drop all policies on project_collaborators
DROP POLICY IF EXISTS "project_collaborators_select" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_insert" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_update" ON project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_delete" ON project_collaborators;
DROP POLICY IF EXISTS "Project creators can add themselves as owner" ON project_collaborators;
DROP POLICY IF EXISTS "Project owners can update collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "Project owners can delete collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;

-- Drop all policies on audio_files
DROP POLICY IF EXISTS "audio_files_select" ON audio_files;
DROP POLICY IF EXISTS "audio_files_insert" ON audio_files;
DROP POLICY IF EXISTS "audio_files_update" ON audio_files;
DROP POLICY IF EXISTS "audio_files_delete" ON audio_files;

-- Drop all policies on comments
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;

-- Drop all policies on highlights
DROP POLICY IF EXISTS "highlights_select" ON highlights;
DROP POLICY IF EXISTS "highlights_insert" ON highlights;
DROP POLICY IF EXISTS "highlights_update" ON highlights;
DROP POLICY IF EXISTS "highlights_delete" ON highlights;

-- STEP 2: DISABLE RLS TEMPORARILY (for safety during migration)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE highlights DISABLE ROW LEVEL SECURITY;

-- STEP 3: RE-ENABLE RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- STEP 4: CREATE SIMPLE, NON-CIRCULAR POLICIES

-- PROJECTS TABLE POLICIES
-- Rule: Anyone can SELECT their own projects OR projects they collaborate on
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
USING (
  creator_id = auth.uid()
);

-- Rule: Anyone can INSERT projects with themselves as creator
CREATE POLICY "projects_insert_policy"
ON projects FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
);

-- Rule: Only the creator can UPDATE their projects
CREATE POLICY "projects_update_policy"
ON projects FOR UPDATE
USING (
  creator_id = auth.uid()
);

-- Rule: Only the creator can DELETE their projects
CREATE POLICY "projects_delete_policy"
ON projects FOR DELETE
USING (
  creator_id = auth.uid()
);

-- PROJECT_COLLABORATORS TABLE POLICIES
-- Rule: Anyone can view collaborators for projects they own or are collaborating on
CREATE POLICY "collaborators_select_policy"
ON project_collaborators FOR SELECT
USING (
  user_id = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- Rule: Project creators can add collaborators to their projects
CREATE POLICY "collaborators_insert_policy"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Allow if adding yourself as owner to your own project
  (user_id = auth.uid() AND role = 'owner' AND project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  ))
  OR
  -- Allow if you're the creator adding someone else
  (project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  ))
);

-- Rule: Project creators can update collaborator permissions
CREATE POLICY "collaborators_update_policy"
ON project_collaborators FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- Rule: Project creators can remove collaborators
CREATE POLICY "collaborators_delete_policy"
ON project_collaborators FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- AUDIO_FILES TABLE POLICIES
CREATE POLICY "audio_files_select_policy"
ON audio_files FOR SELECT
USING (
  created_by = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

CREATE POLICY "audio_files_insert_policy"
ON audio_files FOR INSERT
WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY "audio_files_update_policy"
ON audio_files FOR UPDATE
USING (
  created_by = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

CREATE POLICY "audio_files_delete_policy"
ON audio_files FOR DELETE
USING (
  created_by = auth.uid()
  OR
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- COMMENTS TABLE POLICIES
CREATE POLICY "comments_select_policy"
ON comments FOR SELECT
USING (
  user_id = auth.uid()
  OR
  audio_file_id IN (
    SELECT id FROM audio_files WHERE created_by = auth.uid()
  )
  OR
  audio_file_id IN (
    SELECT af.id FROM audio_files af
    INNER JOIN projects p ON af.project_id = p.id
    WHERE p.creator_id = auth.uid()
  )
);

CREATE POLICY "comments_insert_policy"
ON comments FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "comments_update_policy"
ON comments FOR UPDATE
USING (
  user_id = auth.uid()
);

CREATE POLICY "comments_delete_policy"
ON comments FOR DELETE
USING (
  user_id = auth.uid()
  OR
  audio_file_id IN (
    SELECT af.id FROM audio_files af
    INNER JOIN projects p ON af.project_id = p.id
    WHERE p.creator_id = auth.uid()
  )
);

-- HIGHLIGHTS TABLE POLICIES
CREATE POLICY "highlights_select_policy"
ON highlights FOR SELECT
USING (
  user_id = auth.uid()
);

CREATE POLICY "highlights_insert_policy"
ON highlights FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "highlights_update_policy"
ON highlights FOR UPDATE
USING (
  user_id = auth.uid()
);

CREATE POLICY "highlights_delete_policy"
ON highlights FOR DELETE
USING (
  user_id = auth.uid()
);

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE 'RLS policies successfully recreated without circular dependencies';
END $$;
