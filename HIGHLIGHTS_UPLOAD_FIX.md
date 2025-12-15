# Highlights Upload Fix

## Issue
Uploading audio to Highlights fails with error:
```
[StorageApiError: new row violates row-level security policy]
```

## Root Causes

1. **Missing User Profile Trigger**: When users sign up via Supabase Auth, no corresponding record is created in the `public.users` table, causing foreign key constraint violations.
2. **Missing Storage RLS Policies**: The `highlights` storage bucket doesn't have Row Level Security (RLS) policies configured, preventing users from uploading files.

## Fix

### 1. Create User Profile Trigger (CRITICAL - Run This First!)

Go to [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor and run this SQL:

```sql
-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    subscription_tier,
    open_to_kollab,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'free',
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users that don't have a profile
INSERT INTO public.users (
  id,
  email,
  username,
  display_name,
  subscription_tier,
  open_to_kollab,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'username', SPLIT_PART(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'display_name', SPLIT_PART(au.email, '@', 1)),
  'free',
  true,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);
```

### 2. Enable Storage RLS Policies

Go to [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor and run this SQL:

```sql
-- Enable RLS on storage.objects for highlights bucket
-- Policy: Users can upload their own highlight files
CREATE POLICY "Users can upload their own highlights"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view all highlight files (public read)
CREATE POLICY "Anyone can view highlight files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'highlights');

-- Policy: Users can update their own highlight files
CREATE POLICY "Users can update their own highlights"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own highlight files
CREATE POLICY "Users can delete their own highlights"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Verify Bucket Exists

Make sure the `highlights` storage bucket exists in Supabase:

1. Go to Storage in Supabase Dashboard
2. Check if `highlights` bucket exists
3. If not, create it:
   - Name: `highlights`
   - Public: ✅ Yes (files should be publicly accessible)

### 4. Test Upload

After running the migration:

1. Open the app in simulator
2. Navigate to Profile → Add Highlight
3. Select an audio file
4. Fill in track name (optional: BPM, Key)
5. Tap "Add to Highlights"

Expected result:
- ✅ Upload succeeds
- ✅ "Upload Complete" alert appears
- ✅ Highlight appears on your profile

## How It Works

### File Structure
Files are stored in Supabase Storage as:
```
highlights/
  └── {user_id}/
      └── {timestamp}_{filename}.{ext}
```

### RLS Policies
- **Upload**: Users can only upload to their own folder (`{user_id}/`)
- **Read**: Everyone can view all highlights (public)
- **Update/Delete**: Users can only modify their own files

### Database Table
The `highlights` table (already configured) stores:
- `file_url`: Public URL to the file in storage
- `file_name`: Display name
- `duration`: Audio duration in milliseconds
- `bpm`: Optional tempo
- `key`: Optional musical key
- `order_index`: Display order (drag to reorder)

## Limits
- Maximum 5 highlights per user (enforced by database trigger)
- Maximum 500 MB per file
- Supported formats: WAV, MP3, MP4, FLAC, AIFF, AAC, M4A, OGG, OPUS
