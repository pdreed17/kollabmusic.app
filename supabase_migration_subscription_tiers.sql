-- =====================================================
-- Subscription Tier System Migration
-- =====================================================
-- This migration adds subscription tier support to the database
-- Free: 3 owned projects, 3 active collaborations, 8 tracks per project
-- Pro: Unlimited everything


-- Add subscription_tier column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro'));

-- Add track_count column to projects table for efficient counting
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS track_count INTEGER DEFAULT 0;


-- =====================================================
-- Function: Update track count when audio files change
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_track_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects
    SET track_count = track_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects
    SET track_count = GREATEST(0, track_count - 1)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for track count updates
DROP TRIGGER IF EXISTS track_count_trigger ON audio_files;
CREATE TRIGGER track_count_trigger
AFTER INSERT OR DELETE ON audio_files
FOR EACH ROW
EXECUTE FUNCTION update_project_track_count();


-- =====================================================
-- Function: Initialize track counts for existing projects
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_track_counts()
RETURNS void AS $$
BEGIN
  UPDATE projects p
  SET track_count = (
    SELECT COUNT(*)
    FROM audio_files af
    WHERE af.project_id = p.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initialization
SELECT initialize_track_counts();


-- =====================================================
-- Function: Get user's owned projects count
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_owned_projects_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM projects
    WHERE creator_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- Function: Get user's active collaborations count
-- =====================================================
-- Counts projects where user has uploaded at least one audio file
-- but is not the owner
CREATE OR REPLACE FUNCTION get_user_active_collabs_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT af.project_id)
    FROM audio_files af
    INNER JOIN projects p ON af.project_id = p.id
    WHERE af.creator_id = p_user_id
      AND p.creator_id != p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- Grant execute permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION update_project_track_count() TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_track_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_owned_projects_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_collabs_count(UUID) TO authenticated;
