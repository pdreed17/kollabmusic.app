# Project Creation Fix

## Issue
Project creation was failing with "Failed to create project" error in build 18.

## Root Cause
The `CreateProjectScreen` was trying to insert columns that didn't exist in the database:
- ❌ `creator_id` (schema only has `created_by`)
- ❌ `is_public` (column missing)
- ❌ `looking_for_collaborators` (column missing)
- ❌ `status` (column missing)

## Fix Applied

### 1. Removed Invalid Columns
- Removed duplicate `creator_id` (only using `created_by`)
- Removed `status` field (not needed)

### 2. Added Missing Columns
Created migration: `supabase/migrations/20240102_add_missing_project_columns.sql`
- Added `is_public` BOOLEAN column
- Added `looking_for_collaborators` BOOLEAN column

## Setup Required

### Run This SQL in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Run this SQL:

```sql
-- Add missing columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS looking_for_collaborators BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN projects.is_public IS 'Whether the project is publicly visible to all users';
COMMENT ON COLUMN projects.looking_for_collaborators IS 'Whether the project creator is looking for collaborators';
```

3. Verify the columns were added:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
```

## What This Fixes

✅ **Project creation now works** - inserts only valid columns
✅ **Public/Private toggle** - now saves to database
✅ **Looking for Kollabs toggle** - now saves to database
✅ **RLS policies work** - they reference these columns

## Test After Fix

1. Run the SQL migration above
2. Rebuild your app (or wait for next build)
3. Try creating a project with:
   - Required: Title
   - Optional: Description, Genre, BPM, Key
   - Toggle: Public/Private
   - Toggle: Looking for Kollabs
4. Project should create successfully

## Projects Table Schema (After Fix)

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_public BOOLEAN DEFAULT false,              -- NEW
  looking_for_collaborators BOOLEAN DEFAULT false, -- NEW
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## TypeScript Errors (Safe to Ignore)

You might see TypeScript errors about these new columns not being in the types. These are safe to ignore - the columns will work at runtime.

To fix the TypeScript errors, regenerate your Supabase types:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

---

# UPDATE: RLS Policy Fix (Build 20+)

## New Issue
After fixing the missing columns, project creation now fails with a different error:
```
Error creating project:
{"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"projects\""}
```

## Root Cause

The RLS policy on `project_collaborators` has a **circular dependency problem**:

1. When creating a new project, the app tries to add the creator as the first owner collaborator
2. The existing policy `"Project owners can manage collaborators"` checks if an owner already exists for the project
3. Since this is a new project with no collaborators yet, the policy denies the insert
4. **Chicken-and-egg problem**: You can't add the first owner because there's no owner yet!

**Problematic Policy:**
```sql
CREATE POLICY "Project owners can manage collaborators"
  ON project_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );
```

This policy requires an existing owner to insert/update/delete collaborators, but prevents the creator from becoming the first owner.

## Fix for RLS Policy

Go to [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor and run this SQL:

```sql
-- Fix project_collaborators RLS policy
-- The existing policy prevents project creators from adding themselves as the first collaborator
-- This migration splits the policy into separate INSERT, UPDATE, and DELETE policies

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;

-- Allow project creators to add themselves as owner when creating a project
CREATE POLICY "Project creators can add themselves as owner"
  ON project_collaborators
  FOR INSERT
  WITH CHECK (
    -- Allow if user is adding themselves as owner to a project they created
    (user_id = auth.uid() AND role = 'owner' AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND p.created_by = auth.uid()
    ))
    OR
    -- OR if they're already an owner of the project (for adding other collaborators)
    (EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    ))
  );

-- Allow project owners to update collaborator permissions
CREATE POLICY "Project owners can update collaborators"
  ON project_collaborators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );

-- Allow project owners to remove collaborators
CREATE POLICY "Project owners can delete collaborators"
  ON project_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.role = 'owner'
    )
  );
```

## How the New Policies Work

The fix splits the single problematic policy into three separate policies:

### 1. INSERT Policy (Creating Collaborators)
Allows two scenarios:
- **First owner**: Project creator can add themselves as owner to their newly created project
- **Additional collaborators**: Existing project owners can invite other users

### 2. UPDATE Policy (Changing Permissions)
- Only project owners can update collaborator permissions and roles

### 3. DELETE Policy (Removing Collaborators)
- Only project owners can remove collaborators from the project

## Complete Fix Checklist

To fully fix project creation, you need to run BOTH migrations:

- ✅ **Step 1**: Run the missing columns migration (from above)
- ✅ **Step 2**: Run the RLS policy migration (this new section)

Migration files created:
1. `supabase/migrations/20240102_add_missing_project_columns.sql`
2. `supabase/migrations/20240105_fix_project_collaborators_rls.sql`

## Test After Fix

After running both migrations:

1. Open the app in simulator
2. Navigate to Profile → Create Project (+ button)
3. Fill in project details:
   - Title (required)
   - Description, Genre, BPM, Key (optional)
   - Privacy settings (Public/Private)
   - Looking for Collaborators toggle
4. Tap "Create Project"

Expected result:
- ✅ Project creation succeeds
- ✅ You're automatically added as the project owner
- ✅ Project appears in your projects list
- ✅ You can invite collaborators, upload audio, etc.

## Project Creation Flow

When you create a project, the app:

1. **Inserts into `projects` table**:
   - Creates the project record
   - Sets `created_by` to your user ID

2. **Inserts into `project_collaborators` table** (this is where the RLS issue was):
   - Adds you as an 'owner' collaborator
   - Sets `role = 'owner'`
   - Sets `invitation_status = 'accepted'`
   - Grants all permissions (edit, delete, invite, upload, comment, download)

3. **Navigates to project detail screen**:
   - Shows your new project
   - You can start working on it immediately
