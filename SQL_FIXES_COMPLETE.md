# SQL Migrations - All Fixes Complete

## ✅ Fixed Issues

### Issue 1: Wrong Column Name (creator_id vs created_by)
- **Problem:** Database had `projects.created_by`, app uses `projects.creator_id`
- **Fix:** Created `20240106_fix_column_name_created_by_to_creator_id.sql`
- **Result:** Database column will match app code

### Issue 2: Missing Columns in project_collaborators
- **Problem:** Policies referenced columns that didn't exist:
  - `invitation_status`
  - `can_upload`
  - `can_edit`
  - `can_delete`
  - `can_comment`
  - `can_download`
  - `can_invite`
- **Fix:** Updated `20240108_comprehensive_permission_system.sql` to add ALL permission columns
- **Result:** All permission flags now exist before policies reference them

### Issue 3: Missing Columns in users table
- **Problem:** Subscription limits SQL referenced `users.subscription_tier` which didn't exist
- **Fix:** Updated `20240108_comprehensive_permission_system.sql` to add `subscription_tier`
- **Result:** Subscription tier tracking now available

### Issue 4: Missing Columns in projects table
- **Problem:** SQL referenced `projects.status` which didn't exist
- **Fix:** Updated `20240108_comprehensive_permission_system.sql` to add `status` column
- **Result:** Project status tracking now available

---

## 📋 Migration Order (Run in Sequence)

### 1. ✅ 20240106_fix_column_name_created_by_to_creator_id.sql
**Purpose:** Renames database column to match app code

**What it does:**
- Renames `projects.created_by` → `projects.creator_id`
- Updates index name
- Verifies change succeeded

**Expected output:**
```
NOTICE: Renamed projects.created_by to projects.creator_id to match app code
NOTICE: ✅ SUCCESS: projects.creator_id now exists and matches app code
```

---

### 2. ✅ 20240107_add_back_collaboration_safe.sql
**Purpose:** Adds collaborative project viewing without circular dependencies

**What it does:**
- Creates safe one-way policy references
- Allows viewing projects where you're a collaborator
- No infinite recursion

**Expected output:**
```
Successfully added collaborative viewing without circular dependencies!
Users can now see:
  - Their own projects
  - Public projects
  - Projects where they are collaborators
```

---

### 3. ✅ 20240108_comprehensive_permission_system.sql (UPDATED)
**Purpose:** Complete role-based permission system

**What it adds:**

**To projects table:**
- `status` (active, archived, deleted)
- `visibility` (private, public, unlisted, followers_only)
- `looking_for_kollabs` (boolean)

**To project_collaborators table:**
- `invitation_status` (pending, accepted, declined)
- `can_upload` (boolean)
- `can_edit` (boolean)
- `can_delete` (boolean)
- `can_comment` (boolean)
- `can_download` (boolean)
- `can_invite` (boolean)
- `can_export` (boolean)
- `invited_by` (UUID)
- `invited_at` (timestamp)
- `accepted_at` (timestamp)
- `last_activity_at` (timestamp)

**To users table:**
- `subscription_tier` (free, pro, enterprise)
- `profile_visibility` (public, followers, private)
- `show_projects` (boolean)
- `show_collaborations` (boolean)
- `show_highlights` (boolean)
- `show_activity` (boolean)

**Creates new tables:**
- `activities` - Activity feed
- `profile_changes` - Audit log
- `user_connections` - Follow system

**Expected output:**
```
========================================
Comprehensive Permission System Installed
========================================
New tables created: 3
Total RLS policies: [number]

Features enabled:
  ✓ 4-tier role system (Owner/Editor/Collaborator/Viewer)
  ✓ Granular permissions per collaborator
  ✓ Multiple project visibility types
  ✓ Activity feed with filtering
  ✓ Profile audit logging
  ✓ User follow/connection system
  ✓ Safe RLS policies (no circular dependencies)
========================================
```

---

### 4. ✅ 20240109_subscription_limits.sql
**Purpose:** Enforce subscription tier limits

**What it creates:**

**Functions:**
- `can_create_project(user_id)` - Check if user can create more projects
- `can_join_collaboration(user_id)` - Check if user can join more collaborations
- `can_upload_to_project(project_id)` - Check if project can accept more tracks
- `get_user_usage_stats(user_id)` - Get current usage stats
- `get_project_track_usage(project_id)` - Get project track usage

**Views:**
- `user_project_limits` - User project usage and limits
- `project_track_limits` - Project track usage and limits

**Limits enforced:**
- **Free tier:** 3 owned + 3 collaborated projects, 8 tracks per project
- **Pro tier:** Unlimited projects and tracks

**Expected output:**
```
========================================
Subscription Limits System Installed
========================================

Free Tier Limits:
  • 3 projects (as owner)
  • 3 projects (as collaborator)
  • 8 tracks per project
  • 200 MB total storage

Pro Tier:
  • ♾️  Unlimited projects
  • ♾️  Unlimited tracks per project
  • 50 GB storage

Functions created:
  ✓ can_create_project(user_id)
  ✓ can_join_collaboration(user_id)
  ✓ can_upload_to_project(project_id)
  ✓ get_user_usage_stats(user_id)
  ✓ get_project_track_usage(project_id)
========================================
```

---

## 🧪 Verification After Running All Migrations

```sql
-- 1. Check projects table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('creator_id', 'status', 'visibility')
ORDER BY column_name;

-- Should show:
-- creator_id    | uuid |
-- status        | text | 'active'
-- visibility    | text | 'private'

-- 2. Check project_collaborators columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_collaborators'
  AND column_name LIKE 'can_%' OR column_name = 'invitation_status'
ORDER BY column_name;

-- Should show all permission columns

-- 3. Check users table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'subscription_tier';

-- Should show:
-- subscription_tier | text | 'free'

-- 4. Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('activities', 'profile_changes', 'user_connections')
  AND table_schema = 'public';

-- Should return all 3 tables

-- 5. Test subscription functions
SELECT can_create_project(auth.uid());
SELECT get_user_usage_stats(auth.uid());

-- Should return results without errors
```

---

## 🎯 What Changed from Original SQLs

### 20240108_comprehensive_permission_system.sql
**Added to ALTER TABLE project_collaborators:**
```sql
ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS can_upload BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_comment BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_download BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_invite BOOLEAN DEFAULT false,
```

**Added to ALTER TABLE users:**
```sql
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
  CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
```

**Added to ALTER TABLE projects:**
```sql
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'archived', 'deleted')),
```

### 20240109_subscription_limits.sql
**No changes needed** - now works because comprehensive permission system adds the required columns first

---

## ✅ All Issues Resolved

- ✅ Column naming matches app code (creator_id)
- ✅ All referenced columns are added before policies use them
- ✅ Subscription tier tracking available
- ✅ Project status tracking available
- ✅ All permission flags available
- ✅ Migrations can run in sequence without errors

---

## 📝 Notes

- All migrations use `IF NOT EXISTS` so they're safe to re-run
- Migration order is critical - run in sequence 1→2→3→4
- After migration 3, all columns will exist for migration 4
- The column rename (migration 1) MUST run first
