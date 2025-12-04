-- Migration: Add Track Organization Features
-- Adds priority, ordering, and hide/show functionality for audio files

-- ============================================================================
-- Add new columns to audio_files table
-- ============================================================================

-- Add priority column (high, medium, low)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_files' AND column_name = 'priority'
  ) THEN
    ALTER TABLE audio_files ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Add order_index for manual ordering within priority sections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_files' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE audio_files ADD COLUMN order_index INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add is_hidden for hiding audio files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_files' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE audio_files ADD COLUMN is_hidden BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audio_files_priority ON audio_files(priority);
CREATE INDEX IF NOT EXISTS idx_audio_files_order_index ON audio_files(order_index);
CREATE INDEX IF NOT EXISTS idx_audio_files_is_hidden ON audio_files(is_hidden);

-- ============================================================================
-- Update existing records to have default order_index
-- ============================================================================

-- Set order_index based on created_at for existing records
-- This ensures existing files have a logical order
UPDATE audio_files
SET order_index = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id, priority ORDER BY created_at) as row_num
  FROM audio_files
  WHERE order_index = 0
) AS subquery
WHERE audio_files.id = subquery.id;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN audio_files.priority IS 'Track priority: high, medium, or low for organization';
COMMENT ON COLUMN audio_files.order_index IS 'Manual ordering within priority section (lower numbers first)';
COMMENT ON COLUMN audio_files.is_hidden IS 'Whether the track is hidden from main view';
