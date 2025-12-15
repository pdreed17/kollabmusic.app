-- ============================================================================
-- ADD RLS POLICIES FOR PROJECT_MESSAGES TABLE
-- ============================================================================
-- The project_messages table was missing from the DEFINITIVE_RLS_SOLUTION
-- This migration adds the necessary RLS policies for project chat functionality

-- Enable RLS on project_messages (if not already enabled)
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first (clean slate)
DROP POLICY IF EXISTS "View project messages" ON project_messages;
DROP POLICY IF EXISTS "Send messages to projects" ON project_messages;
DROP POLICY IF EXISTS "Update own messages" ON project_messages;
DROP POLICY IF EXISTS "Delete own messages" ON project_messages;
DROP POLICY IF EXISTS "project_messages_select" ON project_messages;
DROP POLICY IF EXISTS "project_messages_insert" ON project_messages;
DROP POLICY IF EXISTS "project_messages_update" ON project_messages;
DROP POLICY IF EXISTS "project_messages_delete" ON project_messages;

-- ============================================================================
-- CREATE RLS POLICIES (using the same helper functions as other tables)
-- ============================================================================

-- SELECT: View messages in projects you own or collaborate on (PRIVATE - not visible on public projects)
CREATE POLICY "project_messages_select"
ON project_messages FOR SELECT
USING (
  -- You sent it
  user_id = auth.uid()
  OR
  -- You own the project
  is_project_owner(project_id, auth.uid())
  OR
  -- You're an accepted collaborator
  is_accepted_collaborator(project_id, auth.uid())
);

-- INSERT: Send messages to projects you own or collaborate on
CREATE POLICY "project_messages_insert"
ON project_messages FOR INSERT
WITH CHECK (
  -- Must be the message sender
  user_id = auth.uid()
  AND
  (
    -- You own the project
    is_project_owner(project_id, auth.uid())
    OR
    -- You're an accepted collaborator (can always send messages)
    is_accepted_collaborator(project_id, auth.uid())
  )
);

-- UPDATE: Only update your own messages
CREATE POLICY "project_messages_update"
ON project_messages FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Delete your own messages, or project owner can delete any
CREATE POLICY "project_messages_delete"
ON project_messages FOR DELETE
USING (
  -- Your own message
  user_id = auth.uid()
  OR
  -- Project owner can delete any message in their project
  is_project_owner(project_id, auth.uid())
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'project_messages' AND schemaname = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  PROJECT_MESSAGES RLS POLICIES INSTALLED';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Policies created: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '  ✓ project_messages_select - View messages in your projects';
  RAISE NOTICE '  ✓ project_messages_insert - Send messages to your projects';
  RAISE NOTICE '  ✓ project_messages_update - Edit your own messages';
  RAISE NOTICE '  ✓ project_messages_delete - Delete your messages';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Show the created policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'project_messages' AND schemaname = 'public'
ORDER BY cmd;
