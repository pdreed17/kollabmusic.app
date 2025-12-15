# Migration Fix Required - Database vs App Column Names

## 🚨 CRITICAL ISSUE

**The database schema uses `projects.created_by` but the app code uses `projects.creator_id`**

All recent migrations I created use `creator_id` (matching the app), so they fail against the database which has `created_by`.

---

## Root Cause

1. **Original schema** (`supabase_migration_complete_schema.sql`) created `projects.created_by`
2. **App code** was written using `projects.creator_id` (20+ files)
3. **Recent migrations** (yesterday's work) used `created_by` to match database
4. **Today's migrations** (my work) use `creator_id` to match app code
5. **Result:** Database and app are mismatched, migrations are failing

---

## Migrations That Need Column Name Fix

### Already Written (Need to Run in Order):

**1. ✅ NEW: 20240106_fix_column_name_created_by_to_creator_id.sql**
- **Purpose:** Renames `projects.created_by` → `projects.creator_id` in database
- **MUST RUN FIRST** before any other migrations
- **Safe:** Checks if column exists before renaming

### Then These Will Work:

**2. 20240107_add_back_collaboration_safe.sql**
- Already uses `creator_id` ✅
- Will work after step 1

**3. 20240108_comprehensive_permission_system.sql**
- Already uses `creator_id` ✅
- Will work after step 1

**4. 20240109_subscription_limits.sql**
- Already uses `creator_id` ✅
- Will work after step 1

---

## Old Migrations That Used Wrong Column Name

These migrations may have already run with `created_by`. They don't need to be re-run, but should be noted:

### 20240105_fix_project_collaborators_rls.sql
- Uses `created_by` for projects ❌
- Lines: 12, 28
- **If already applied:** Policies might be broken, will be overwritten by new migrations
- **If not applied:** Can skip, newer migrations replace it

### 20240107_fix_infinite_recursion_final.sql
- Uses BOTH `creator_id` AND `created_by` (inconsistent) ❌
- **Should be replaced** by `20240107_nuclear_fix_rls.sql` or `20240107_add_back_collaboration_safe.sql`
- **Action:** Can ignore, will be overwritten

### 20240107_nuclear_fix_rls.sql
- Uses `creator_id` correctly ✅
- But this was replaced by `20240107_add_back_collaboration_safe.sql`

---

## 📋 Step-by-Step Fix Plan

### Step 1: Run Column Rename Migration

```bash
# In Supabase Dashboard SQL Editor:
```

Run the contents of: `supabase/migrations/20240106_fix_column_name_created_by_to_creator_id.sql`

This will:
- Rename `projects.created_by` → `projects.creator_id`
- Update the index name
- Verify the change succeeded

**Expected output:**
```
NOTICE: Renamed projects.created_by to projects.creator_id to match app code
NOTICE: Updated index from idx_projects_created_by to idx_projects_creator_id
NOTICE: ✅ SUCCESS: projects.creator_id now exists and matches app code
```

### Step 2: Drop Old Broken Policies

Since old migrations created policies with `created_by`, drop them:

```sql
-- Drop any policies that reference the old column name
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "View own and public projects" ON projects;
DROP POLICY IF EXISTS "Update own projects" ON projects;
DROP POLICY IF EXISTS "Delete own projects" ON projects;
DROP POLICY IF EXISTS "Project owners can update projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they collaborate on" ON projects;
```

### Step 3: Run New Migrations in Order

```sql
-- 1. Add back collaborative viewing (safe, no circular dependencies)
-- Run: supabase/migrations/20240107_add_back_collaboration_safe.sql

-- 2. Add comprehensive permission system
-- Run: supabase/migrations/20240108_comprehensive_permission_system.sql

-- 3. Add subscription limits enforcement
-- Run: supabase/migrations/20240109_subscription_limits.sql
```

### Step 4: Verify

```sql
-- Check column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('creator_id', 'created_by');

-- Should show: creator_id | uuid

-- Check policies reference correct column
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'projects'
  AND schemaname = 'public';

-- All policies should reference 'creator_id', not 'created_by'

-- Test creating a project
SELECT can_create_project(auth.uid());
```

---

## 🎯 Quick Fix (If You Want to Just Get It Working)

If the migrations are too complex, here's the minimal fix:

```sql
-- 1. Rename the column
ALTER TABLE projects RENAME COLUMN created_by TO creator_id;

-- 2. Update the index
DROP INDEX IF EXISTS idx_projects_created_by;
CREATE INDEX idx_projects_creator_id ON projects(creator_id);

-- 3. Drop all old policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'projects' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON projects';
  END LOOP;
END $$;

-- 4. Create simple working policies
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
USING (
  creator_id = auth.uid()
  OR is_public = true
);

CREATE POLICY "projects_insert_policy"
ON projects FOR INSERT
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "projects_update_policy"
ON projects FOR UPDATE
USING (creator_id = auth.uid());

CREATE POLICY "projects_delete_policy"
ON projects FOR DELETE
USING (creator_id = auth.uid());
```

This will get your app working immediately. Then you can run the comprehensive migrations later.

---

## 🔍 Why This Happened

**Timeline:**
1. Nov 28: Original schema created with `created_by`
2. Unknown date: App code written with `creator_id`
3. Dec 9 (yesterday): Migrations created with `created_by` (trying to match database)
4. Dec 9 (today): Migrations created with `creator_id` (trying to match app)
5. Result: Mismatch between database schema and recent migrations

**Lesson:** Always verify actual database schema vs app code before writing migrations.

---

## ✅ After These Fixes

- ✅ Database will have `projects.creator_id`
- ✅ App code uses `projects.creator_id`
- ✅ All new migrations use `projects.creator_id`
- ✅ Everything aligned and consistent
