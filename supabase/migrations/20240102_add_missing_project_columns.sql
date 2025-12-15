-- Add missing columns to projects table
-- These columns are referenced in RLS policies but were never added to the table

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS looking_for_collaborators BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN projects.is_public IS 'Whether the project is publicly visible to all users';
COMMENT ON COLUMN projects.looking_for_collaborators IS 'Whether the project creator is looking for collaborators';
