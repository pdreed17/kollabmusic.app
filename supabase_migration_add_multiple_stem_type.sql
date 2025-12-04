-- Migration to add 'multiple' to the stem_type check constraint
-- Run this in your Supabase SQL Editor

-- First, drop the existing check constraint
ALTER TABLE audio_files DROP CONSTRAINT IF EXISTS audio_files_stem_type_check;

-- Recreate the constraint with 'multiple' included
ALTER TABLE audio_files ADD CONSTRAINT audio_files_stem_type_check
CHECK (stem_type IN ('vocals', 'drums', 'bass', 'guitar', 'keys', 'synth', 'fx', 'multiple', 'other'));

-- Verify the constraint was added successfully
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'audio_files_stem_type_check';
