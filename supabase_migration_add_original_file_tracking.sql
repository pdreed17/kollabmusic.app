-- Migration: Add original file tracking for audio trimming
-- Allows users to trim audio files and revert back to original

-- Add columns to track original file and trim state
ALTER TABLE audio_files
  ADD COLUMN IF NOT EXISTS original_file_path TEXT,
  ADD COLUMN IF NOT EXISTS is_trimmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trim_start_ms INTEGER,
  ADD COLUMN IF NOT EXISTS trim_end_ms INTEGER;

-- Create index for finding trimmed files
CREATE INDEX IF NOT EXISTS idx_audio_files_is_trimmed ON audio_files(is_trimmed);

-- Add comments
COMMENT ON COLUMN audio_files.original_file_path IS 'Path to original untrimmed file (null if this is the original)';
COMMENT ON COLUMN audio_files.is_trimmed IS 'Whether this file has been trimmed from an original';
COMMENT ON COLUMN audio_files.trim_start_ms IS 'Start time of trim in milliseconds (if trimmed)';
COMMENT ON COLUMN audio_files.trim_end_ms IS 'End time of trim in milliseconds (if trimmed)';
