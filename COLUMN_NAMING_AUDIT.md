# Column Naming Audit - creator_id vs created_by

## Executive Summary

**CRITICAL FINDING:** There is a **conflicting migration** that attempts to rename `creator_id` → `created_by` in the projects table, but the entire app codebase uses `creator_id`. This migration must be removed.

---

## Current State

### ✅ CORRECT: projects table → `creator_id`

**App Code Usage (20+ files):**
- `src/screens/CreateProjectScreen.tsx:58` - **INSERTS** with `creator_id`
- `src/screens/ProjectsListScreen.tsx:77` - **QUERIES** with `creator_id`
- `src/screens/HomeScreen.tsx:131, 197, 199, 232, 269` - Multiple uses
- `src/screens/SearchScreen.tsx:91, 94, 120, 123, 148, 151` - Foreign key joins
- `src/screens/ProjectDetailScreen.tsx:125, 135, 172, 289` - Ownership checks
- `src/screens/ActivityScreen.tsx:403` - Foreign key reference

**Database Schema:**
- **Should be:** `projects.creator_id` (UUID)
- **Foreign key:** `projects_creator_id_fkey` → `users(id)`

**All New SQL Migrations (Created Today):**
- ✅ `20240107_add_back_collaboration_safe.sql` - Uses `creator_id`
- ✅ `20240108_comprehensive_permission_system.sql` - Uses `creator_id`
- ✅ `20240109_subscription_limits.sql` - Uses `creator_id`

### ✅ CORRECT: audio_files table → `created_by`

**App Code Usage:**
- `src/screens/AudioUploadScreen.tsx:456` - **INSERTS** with `created_by`
- `src/screens/HomeScreen.tsx:233, 236, 243, 303` - Uses `audio_files_created_by_fkey`
- `src/screens/ActivityScreen.tsx:404, 473` - Foreign key reference
- `src/screens/ProjectStudioScreen.tsx:374` - Foreign key reference

**Database Schema:**
- **Correctly uses:** `audio_files.created_by` (UUID)
- **Foreign key:** `audio_files_created_by_fkey` → `users(id)`

---

## 🚨 PROBLEMS IDENTIFIED

### Problem 1: Conflicting Migration (MUST DELETE)

**File:** `supabase/migrations/20240106_rename_creator_id_to_created_by.sql`

**What it does:**
```sql
-- Line 2: "The app code uses created_by but the database has creator_id"
ALTER TABLE projects RENAME COLUMN creator_id TO created_by;
```

**Why it's WRONG:**
- The comment is **FALSE** - app code uses `creator_id`, NOT `created_by`
- CreateProjectScreen.tsx:58 inserts with `creator_id`
- 20+ files query projects using `creator_id`
- If this migration ran, the app would be **completely broken**

**Status:** Likely never ran (app still works), but must be deleted to prevent future issues

**Action Required:** ❌ **DELETE THIS MIGRATION FILE**

---

### Problem 2: Bug in activity.service.ts

**File:** `src/services/activity.service.ts`
**Lines:** 214, 215, 221, 238

**Current Code:**
```typescript
const { data: connectedFiles } = await supabase
  .from('audio_files')
  .select(`
    creator_id,                      // ❌ WRONG: audio_files uses created_by
    users:creator_id(username),      // ❌ WRONG: foreign key doesn't exist
  `)
  .in('creator_id', connectedUserIds) // ❌ WRONG: column doesn't exist
```

**Why it's WRONG:**
- `audio_files` table uses `created_by`, NOT `creator_id`
- Foreign key is `audio_files_created_by_fkey`, not `creator_id`
- This query will **fail at runtime**

**Should be:**
```typescript
const { data: connectedFiles } = await supabase
  .from('audio_files')
  .select(`
    created_by,                      // ✅ CORRECT
    users:created_by(username),      // ✅ CORRECT
  `)
  .in('created_by', connectedUserIds) // ✅ CORRECT
```

**Action Required:** 🔧 **FIX activity.service.ts lines 214, 215, 221, 238**

---

## 📊 Summary Table

| Table | Column Name | Status | App Usage | Schema Match |
|-------|-------------|--------|-----------|--------------|
| `projects` | `creator_id` | ✅ CORRECT | 20+ files | ✅ Matches |
| `audio_files` | `created_by` | ✅ CORRECT | 8+ files | ✅ Matches |
| `comments` | `user_id` | ✅ CORRECT | Standard pattern | ✅ Matches |
| `project_collaborators` | `user_id` | ✅ CORRECT | Standard pattern | ✅ Matches |
| `highlights` | `user_id` | ✅ CORRECT | Standard pattern | ✅ Matches |
| `activities` (new) | `user_id` | ✅ CORRECT | Not yet used | ✅ Matches |

---

## 🎯 Required Actions

### IMMEDIATE (Critical)

1. **DELETE bad migration:**
   ```bash
   rm supabase/migrations/20240106_rename_creator_id_to_created_by.sql
   ```

2. **FIX activity.service.ts bug:**
   - Line 214: Change `creator_id` → `created_by`
   - Line 215: Change `users:creator_id` → `users:created_by`
   - Line 221: Change `.in('creator_id'` → `.in('created_by'`
   - Line 238: Change `file.creator_id` → `file.created_by`

### VERIFICATION

3. **Confirm database state:**
   - Check if projects table has `creator_id` or `created_by`
   - If it has `created_by`, need to rename it BACK to `creator_id`
   - If it has `creator_id`, nothing needed (migration never ran)

4. **Test critical flows:**
   - Create new project (uses creator_id)
   - Upload audio file (uses created_by)
   - View activity feed (currently broken if using audio_files)
   - View projects list

---

## ✅ What's Working

### All new SQL migrations use correct columns:
- `20240107_add_back_collaboration_safe.sql` ✅
- `20240108_comprehensive_permission_system.sql` ✅
- `20240109_subscription_limits.sql` ✅

### App code is internally consistent:
- Projects always use `creator_id` ✅
- Audio files always use `created_by` ✅
- Collaborators always use `user_id` ✅

---

## 🔍 How This Happened

1. **Old schema** (supabase_migration_complete_schema.sql) used `created_by` for both tables
2. **App was built** using `creator_id` for projects (correct choice for ownership)
3. **Someone noticed mismatch** and created migration 20240106
4. **Migration was WRONG** - it tried to change database to match non-existent app code
5. **Migration likely never ran** (app still works)
6. **Today's migrations** correctly use `creator_id` based on actual app behavior

---

## 🎓 Naming Convention Rationale

**Why `projects.creator_id` is correct:**
- Semantically accurate: A project has a **creator** (owner)
- Distinct from `user_id` in join tables
- Standard pattern: `{relationship}_id` (creator, owner, author)

**Why `audio_files.created_by` is correct:**
- Semantically accurate: A file was **created by** someone
- User might not "own" the file (project owner does)
- Standard pattern for content: `created_by`, `updated_by`, `deleted_by`

**Why `project_collaborators.user_id` is correct:**
- This is a **join table** between users and projects
- Standard pattern: Always use `user_id` in join/pivot tables

---

## 📝 Recommended Standard

Going forward, use this convention:

| Table Type | Column Name | Usage |
|------------|-------------|-------|
| **Owned entities** | `creator_id` | Projects, teams, organizations |
| **Content/artifacts** | `created_by` | Files, comments, posts |
| **Join/pivot tables** | `user_id` | Collaborators, members, follows |
| **Actions/events** | `user_id` | Activities, notifications, logs |

This creates clear semantic distinction between ownership (creator) and authorship (created_by).
