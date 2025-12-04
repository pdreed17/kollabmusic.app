-- Migration to add start_time_ms field for multi-track timeline positioning
-- Run this in your Supabase SQL Editor

-- Add start_time_ms column to audio_files table
-- Default to 0 for existing tracks (they all start at the beginning)
ALTER TABLE audio_files
ADD COLUMN IF NOT EXISTS start_time_ms INTEGER DEFAULT 0 NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN audio_files.start_time_ms IS
'The position in milliseconds where this track starts on the project timeline. Used for multi-track DAW-style arrangement.';

-- Verify the column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'audio_files'
  AND column_name = 'start_time_ms';
