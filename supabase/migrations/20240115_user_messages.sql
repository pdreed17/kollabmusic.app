-- ============================================================================
-- USER MESSAGES TABLE
-- ============================================================================
-- Direct messaging between users for collaboration outreach
-- Messages appear in the recipient's Notifications section

-- Create the user_messages table
CREATE TABLE IF NOT EXISTS user_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent self-messaging
  CONSTRAINT no_self_messaging CHECK (sender_id != recipient_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_messages_recipient ON user_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_sender ON user_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON user_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_unread ON user_messages(recipient_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "user_messages_select" ON user_messages;
DROP POLICY IF EXISTS "user_messages_insert" ON user_messages;
DROP POLICY IF EXISTS "user_messages_update" ON user_messages;
DROP POLICY IF EXISTS "user_messages_delete" ON user_messages;

-- SELECT: Users can see messages they sent or received
CREATE POLICY "user_messages_select"
ON user_messages FOR SELECT
USING (
  sender_id = auth.uid() OR recipient_id = auth.uid()
);

-- INSERT: Users can send messages (must be the sender)
CREATE POLICY "user_messages_insert"
ON user_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
);

-- UPDATE: Recipients can mark messages as read
CREATE POLICY "user_messages_update"
ON user_messages FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- DELETE: Users can delete messages they sent or received
CREATE POLICY "user_messages_delete"
ON user_messages FOR DELETE
USING (
  sender_id = auth.uid() OR recipient_id = auth.uid()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  USER_MESSAGES TABLE CREATED';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Table: user_messages';
  RAISE NOTICE '  Columns: id, sender_id, recipient_id, message, read, created_at';
  RAISE NOTICE '';
  RAISE NOTICE '  RLS Policies:';
  RAISE NOTICE '  - user_messages_select: View sent/received messages';
  RAISE NOTICE '  - user_messages_insert: Send messages as yourself';
  RAISE NOTICE '  - user_messages_update: Mark received messages as read';
  RAISE NOTICE '  - user_messages_delete: Delete your messages';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
