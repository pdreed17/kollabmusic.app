-- Fix Users Table RLS Policies
-- This ensures users can update their own profile data

-- Drop all existing policies on users table (try all possible names)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read public profiles" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can read user profiles" ON public.users;

-- Disable RLS temporarily to clear everything
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read any user profile (for collaboration features)
CREATE POLICY "Anyone can read user profiles"
  ON public.users
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own profile (for signup)
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
-- IMPORTANT: Both USING and WITH CHECK clauses are needed for UPDATE
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- Verify the columns exist
DO $$
BEGIN
  -- Check if open_to_kollab column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'open_to_kollab'
  ) THEN
    ALTER TABLE public.users ADD COLUMN open_to_kollab BOOLEAN DEFAULT true;
  END IF;

  -- Check if display_name column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN display_name TEXT;
  END IF;

  -- Check if bio column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.users ADD COLUMN bio TEXT;
  END IF;

  -- Check if avatar_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
  END IF;

  -- Check if specialties column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'specialties'
  ) THEN
    ALTER TABLE public.users ADD COLUMN specialties TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Set updated_at to NOW when a user profile is updated
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.users IS 'User profiles with RLS policies that allow users to update their own data';
