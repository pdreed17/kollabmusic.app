-- ============================================================================
-- Followers Count Trigger
-- Automatically updates users.followers_count when user_connections changes
-- ============================================================================

-- Function to update followers count
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Someone followed this user, increment their count
    UPDATE users
    SET followers_count = COALESCE(followers_count, 0) + 1
    WHERE id = NEW.following_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Someone unfollowed this user, decrement their count
    UPDATE users
    SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
    WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_followers_count ON user_connections;

-- Create trigger on user_connections table
CREATE TRIGGER trigger_update_followers_count
AFTER INSERT OR DELETE ON user_connections
FOR EACH ROW
EXECUTE FUNCTION update_followers_count();

-- ============================================================================
-- Fix existing counts (one-time sync)
-- ============================================================================

-- Update all users' followers_count to match actual connections
UPDATE users u
SET followers_count = (
  SELECT COUNT(*)
  FROM user_connections uc
  WHERE uc.following_id = u.id
);

-- Verify
SELECT
  u.id,
  u.username,
  u.followers_count as stored_count,
  (SELECT COUNT(*) FROM user_connections WHERE following_id = u.id) as actual_count
FROM users u
ORDER BY u.username;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Followers Count Trigger Installed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'The followers_count column will now';
  RAISE NOTICE 'automatically update when users connect';
  RAISE NOTICE 'or disconnect from each other.';
  RAISE NOTICE '========================================';
END $$;
