# Testing Checklist for Build

## ⚠️ BEFORE TESTING - Run SQL Migration

**IMPORTANT:** Run this SQL in Supabase Dashboard first, or project creation will still fail:

```sql
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS looking_for_collaborators BOOLEAN DEFAULT false;
```

---

## Test 1: Project Creation (The Main Fix)

### Steps:
1. Launch app in simulator
2. Log in with test account
3. Navigate to **Projects** tab
4. Tap **+ Create Project** button
5. Fill out:
   - **Title:** "Test Project" ✅ (required)
   - **Description:** "Testing project creation" (optional)
   - **Genre:** "Hip Hop" (optional)
   - **BPM:** "120" (optional)
   - **Key:** "C Minor" (optional)
   - **Public Project:** Toggle ON
   - **Looking for Kollabs:** Toggle ON
6. Tap **Create Project**

### Expected Result:
- ✅ Success alert appears: "Project created!"
- ✅ Navigates to Project Detail screen
- ✅ Project appears in your Projects list
- ✅ All fields are saved correctly

### If It Fails:
- ❌ "Failed to create project" → SQL migration not run yet
- Check Supabase logs for detailed error

---

## Test 2: Account Deletion (New Feature)

### Steps:
1. In the app, go to **Profile** tab
2. Tap **Settings** (gear icon)
3. Scroll to bottom
4. Tap **Delete Account** (red text)
5. Confirm deletion in alert

### Expected Result:
- ✅ Warning appears about permanent deletion
- ✅ After confirming: "Account Deleted" alert
- ✅ Returns to login screen
- ✅ Cannot log back in (account is gone)
- ✅ All user data is removed from database

### ⚠️ Before Testing:
**Run SQL migration for delete_user function:**
```sql
-- See supabase/migrations/20240101_delete_user_function.sql
```

---

## Test 3: Activity Feed Display (Recent Fix)

### Steps:
1. Go to **Home** tab
2. Look at activity feed
3. Find a project that has Genre, BPM, or Key

### Expected Result:
- ✅ Genre, BPM, Key shown as: "Hip Hop • 120 BPM • C Minor"
- ✅ Text color is secondary gray (matches Activity tab)
- ✅ No missing/broken styles

---

## Test 4: Beta Pro Access (50 Users)

### Steps:
1. Create a new test account (sign up)
2. Check user's subscription tier in Supabase

### Expected Result:
- ✅ If user count ≤ 50: Gets Pro tier automatically
- ✅ If user count > 50: Gets Free tier
- ✅ Check console logs for: "[Beta] Auto-granted Pro access to user X/50"

---

## Test 5: ProjectStudioScreen Playback (Recent Fix)

### Steps:
1. Open an existing project with audio files
2. Tap a track to select it (should NOT auto-play)
3. Tap the **Play button**
4. Tap another track (should NOT auto-play/pause)
5. Tap **Play button** again

### Expected Result:
- ✅ Track only plays when Play button is pressed
- ✅ Switching tracks doesn't auto-play
- ✅ Play/pause indicator shows in top right of track item
- ✅ Transport buttons are larger (easier to tap)

---

## Test 6: Login/Signup Screens

### Steps:
1. Sign out (if signed in)
2. Try logging in with existing account
3. Try signing up with new account

### Expected Result:
- ✅ Login works with email/password
- ✅ Signup creates account with email/username/password
- ✅ No errors or crashes

---

## Common Issues & Solutions

### "Failed to create project"
- **Cause:** SQL migration not run
- **Fix:** Run the ALTER TABLE commands in Supabase

### TypeScript errors in console
- **Cause:** Supabase types out of sync
- **Impact:** None (runtime works fine)
- **Fix:** Regenerate types later

### "delete_user function not found"
- **Cause:** Delete user migration not run
- **Fix:** Run delete_user SQL function

### App crashes on launch
- **Check:** Console logs for detailed error
- **Common:** Missing dependencies or build issues
- **Fix:** `npm install` and rebuild

---

## Success Criteria

All tests should pass with:
- ✅ No "Failed to create project" errors
- ✅ Projects save with all fields (including public/kollabs toggles)
- ✅ Account deletion works (if migration run)
- ✅ Activity feed displays correctly
- ✅ Playback controls work as expected

---

## If Everything Works

🎉 **Ready for TestFlight!**

Build and submit:
```bash
eas build --platform ios --profile production
```
