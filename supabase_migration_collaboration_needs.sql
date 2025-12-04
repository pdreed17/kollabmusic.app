-- Migration: Add collaboration_needs to projects table
-- This allows project owners to specify what skills/roles they need for collaboration

-- ============================================================================
-- Add collaboration_needs column to projects table
-- ============================================================================

-- Add column to store collaboration needs as JSONB array
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS collaboration_needs TEXT[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN projects.collaboration_needs IS
  'Array of collaboration skills/roles needed for the project (e.g., vocals, mixing, drums)';

-- ============================================================================
-- Create index for efficient querying
-- ============================================================================

-- Index for searching projects by collaboration needs
CREATE INDEX IF NOT EXISTS idx_projects_collaboration_needs
ON projects USING GIN (collaboration_needs);

-- ============================================================================
-- Update existing projects to have empty array if NULL
-- ============================================================================

UPDATE projects
SET collaboration_needs = '{}'
WHERE collaboration_needs IS NULL;

-- ============================================================================
-- Example values that can be stored:
-- ============================================================================
-- ['vocals', 'mixing', 'mastering']
-- ['guitar', 'drums']
-- ['lyrics', 'vocals', 'production']
