-- ============================================================================
-- CONNECTION NOTIFICATIONS
-- ============================================================================
-- Adds a 'seen' field to user_connections so users get notified of new Konnects

-- Add seen column to track if the followed user has seen the connection
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on unseen connections
CREATE INDEX IF NOT EXISTS idx_user_connections_unseen
ON user_connections(following_id, seen)
WHERE seen = FALSE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  CONNECTION NOTIFICATIONS MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Added: seen BOOLEAN column to user_connections';
  RAISE NOTICE '  Added: Index for unseen connections lookup';
  RAISE NOTICE '';
  RAISE NOTICE '  Use Case: When user A Konnects with user B,';
  RAISE NOTICE '            user B sees this as a notification until they';
  RAISE NOTICE '            view their connections/activity.';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
