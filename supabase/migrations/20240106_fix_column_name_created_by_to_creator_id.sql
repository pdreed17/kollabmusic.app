-- Fix projects table column name to match app code
-- The database has created_by but the app uses creator_id
-- This migration renames the column to match what the app expects

-- Check if created_by exists and creator_id doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'created_by'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'creator_id'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE projects RENAME COLUMN created_by TO creator_id;

    RAISE NOTICE 'Renamed projects.created_by to projects.creator_id to match app code';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'creator_id'
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Column projects.creator_id already exists - no action needed';
  ELSE
    RAISE EXCEPTION 'Neither created_by nor creator_id exists on projects table!';
  END IF;
END $$;

-- Update the index name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'projects'
    AND indexname = 'idx_projects_created_by'
  ) THEN
    DROP INDEX IF EXISTS idx_projects_created_by;
    CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
    RAISE NOTICE 'Updated index from idx_projects_created_by to idx_projects_creator_id';
  END IF;
END $$;

-- Update foreign key constraint name if needed
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the current foreign key constraint name
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'projects'
  AND att.attname = 'creator_id';

  IF constraint_name IS NOT NULL THEN
    RAISE NOTICE 'Foreign key constraint already uses creator_id: %', constraint_name;
  END IF;
END $$;

-- Verification
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'creator_id'
    AND table_schema = 'public'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ SUCCESS: projects.creator_id now exists and matches app code';
  ELSE
    RAISE EXCEPTION '❌ FAILED: projects.creator_id does not exist after migration';
  END IF;
END $$;
