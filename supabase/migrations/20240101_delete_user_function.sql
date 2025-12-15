-- Function to delete a user account
-- This function allows a user to delete their own account
-- All related data will be cascade deleted due to ON DELETE CASCADE constraints

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();

  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete from public.users (which cascades to all related tables)
  DELETE FROM public.users WHERE id = current_user_id;

  -- Delete from auth.users (Supabase Auth table)
  DELETE FROM auth.users WHERE id = current_user_id;

  -- Log the deletion
  RAISE NOTICE 'User % successfully deleted', current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user() IS 'Allows authenticated users to delete their own account and all associated data';
