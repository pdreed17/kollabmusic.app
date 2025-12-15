-- Check what tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'project_collaborators', 'users')
ORDER BY table_name;

-- Check what columns exist in project_collaborators (if it exists)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_collaborators'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check what columns exist in projects
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND table_schema = 'public'
  AND column_name IN ('creator_id', 'created_by', 'status', 'visibility')
ORDER BY column_name;

-- Check what columns exist in users
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND table_schema = 'public'
  AND column_name IN ('id', 'subscription_tier')
ORDER BY column_name;
