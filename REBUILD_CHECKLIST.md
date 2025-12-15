# Clean Rebuild Checklist

## What's Happening

I've cleared all caches and started a fresh build:
```bash
rm -rf node_modules/.cache  # Clear Node cache
rm -rf .expo                # Clear Expo cache
npx expo start --clear --ios # Start with cleared bundler cache
```

This gives you a completely clean slate with:
- ✅ New RLS policies (from the SQL migration)
- ✅ Cleared authentication cache
- ✅ Fresh app state

## When the App Loads

### Step 1: Sign Out and Sign Back In

**IMPORTANT:** Even with a clean build, your old auth token might still be in AsyncStorage.

1. Open the app
2. Navigate to **Settings** → **Sign Out**
3. Sign back in with your credentials

This ensures:
- Fresh authentication token
- New session with updated RLS policies
- Clean connection to database

### Step 2: Test Basic Functions

After signing back in, test in this order:

**✅ 1. View Projects**
- Navigate to Projects screen
- Should see your projects without errors
- Check console for diagnostic logs:
  ```
  ===== PROJECT LOADING DIAGNOSTICS =====
  User ID from context: [your-id]
  My projects query result: { count: X, error: null }
  ```

**✅ 2. Open Project Details**
- Tap on a project
- Should load collaborators, audio files, comments
- **NO** "infinite recursion" error

**✅ 3. Create New Project**
- Tap "Create Project"
- Fill in title
- Tap "Create"
- Should succeed without RLS errors

**✅ 4. Invite Collaborator**
- Open a project
- Try to invite someone
- Should work without policy errors

**✅ 5. Upload Audio**
- Try uploading an audio file to a project
- Should work

## Expected Success Patterns

### Console Logs (Good):
```
LOG  ===== PROJECT LOADING DIAGNOSTICS =====
LOG  User ID from context: abc-123-def-456
LOG  User email: your@email.com
LOG  My projects query result: { count: 2, error: null, projects: [...] }
LOG  Collaborations query result: { count: 0, error: null }
LOG  FINAL: Total projects loaded: 2
LOG  ======================================
```

### Console Logs (Bad - Report These):
```
ERROR  Collaborators error: infinite recursion detected
ERROR  Error creating project: row violates row-level security policy
ERROR  [AuthApiError: Invalid Refresh Token]
```

## If Problems Persist

### Auth Issues:
**Symptoms:** Can't create, can't view details, auth errors
**Fix:**
1. Delete the app from simulator
2. Rebuild: `npx expo run:ios`
3. Sign in fresh

### RLS Policy Issues:
**Symptoms:** Specific operations fail (create, invite, etc.)
**Fix:**
1. Verify the SQL migration ran successfully
2. Check Supabase Dashboard → Database → Tables → Policies
3. Confirm new policy names exist:
   - `projects_select_policy`
   - `projects_insert_policy`
   - `collaborators_select_policy`
   - etc.

### Infinite Recursion Still Happening:
**This means:** The SQL migration didn't take effect
**Fix:**
1. Go to Supabase Dashboard → SQL Editor
2. Run this to check for old policies:
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public'
   AND tablename IN ('projects', 'project_collaborators')
   ORDER BY tablename, policyname;
   ```
3. You should ONLY see the new `_policy` suffixed names
4. If you see old policy names, re-run the migration

### User ID Mismatch:
**Symptoms:** Projects exist but don't show up
**Check:** Compare user ID in logs with creator_id in database
**If different:** You're logged in as a different user

## Share This Info If Issues Continue

If problems persist after the clean rebuild:

1. **Copy the diagnostic logs:**
   ```
   ===== PROJECT LOADING DIAGNOSTICS =====
   [everything between the === lines]
   ======================================
   ```

2. **Share specific error messages:**
   - What action you tried (create project, view details, etc.)
   - Exact error message from console
   - What you expected to happen

3. **Current policy names from Supabase:**
   Run this SQL and share results:
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public'
   AND tablename IN ('projects', 'project_collaborators');
   ```

## Next Steps

1. ⏳ **Wait for build to complete** (should see "Logs for your project will appear below")
2. 🔄 **Sign out and sign back in**
3. ✅ **Test all functions** using the checklist above
4. 📊 **Check diagnostic logs** for user ID and query results
5. 🐛 **Report any errors** with specific details

The combination of new RLS policies + clean build + fresh auth session should resolve all the issues!
