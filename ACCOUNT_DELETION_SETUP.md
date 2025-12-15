# Account Deletion Setup Instructions

Account deletion has been implemented. Before it works in your app, you need to run the database migration.

## Setup Steps

### 1. Run the Database Migration

You need to create the `delete_user()` function in your Supabase database.

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of:
   ```
   supabase/migrations/20240101_delete_user_function.sql
   ```
6. Click **Run** or press `Cmd/Ctrl + Enter`

**Option B: Using Supabase CLI**

If you have the Supabase CLI installed:

```bash
supabase db push
```

---

## How It Works

When a user deletes their account:

### 1. **User Confirms Deletion**
- Tap "Delete Account" in Settings
- Sees warning: "This action cannot be undone"
- Confirms the deletion

### 2. **Database Cascade Deletes All Data**
The `delete_user()` function deletes the user from `auth.users` and `public.users`, which triggers cascading deletes:

- ✅ User profile
- ✅ All projects they created
- ✅ All collaborations
- ✅ All audio files they uploaded
- ✅ All comments they made
- ✅ All proximity sessions
- ✅ All P2P transfers

### 3. **Automatic Sign Out**
- User is signed out automatically
- Returns to login screen
- Sees confirmation: "Your account has been permanently deleted"

### 4. **Removed from Everyone's View**
- Their profile disappears immediately
- Their projects are gone
- They're removed from collaboration lists
- Their comments/activity disappears

---

## Testing

⚠️ **WARNING**: This is a destructive operation. Test with a test account first!

### Test Flow

1. Create a test account
2. Create some test data (projects, uploads, comments)
3. Go to Settings → Delete Account
4. Confirm deletion
5. Verify:
   - Account is deleted
   - User is signed out
   - Login screen appears
   - Cannot log back in with those credentials
   - Test data is gone from database

---

## Security

The `delete_user()` function has these security features:

- ✅ **SECURITY DEFINER** - Runs with elevated permissions (needed to delete auth.users)
- ✅ **Authentication check** - Only works if user is logged in
- ✅ **Self-deletion only** - User can only delete their own account
- ✅ **Granted to authenticated users only** - Not accessible to anonymous users

---

## Rollback

If you need to disable account deletion:

**Option 1: Remove the database function**
```sql
DROP FUNCTION IF EXISTS delete_user();
```

**Option 2: Revert the code**
In `src/screens/SettingsScreen.tsx`, replace the `handleDeleteAccount` function with:
```typescript
const handleDeleteAccount = () => {
  Alert.alert(
    'Delete Account',
    'Account deletion is currently disabled. Please contact support.',
    [{ text: 'OK' }]
  )
}
```

---

## Troubleshooting

### "Failed to delete account"
- Check Supabase logs in Dashboard → Logs
- Verify the migration ran successfully
- Check if user has proper permissions

### TypeScript Error: "delete_user" not assignable
- This is expected - the RPC function isn't in generated types
- It will work at runtime
- To fix: Regenerate types with `npx supabase gen types typescript`

### User data not fully deleted
- Check ON DELETE CASCADE constraints in your schema
- Verify foreign key relationships are set up correctly
- Review `supabase/migrations/supabase_migration_complete_schema.sql`

---

## What Happens to Collaborations?

### If user created a project:
- ❌ Project is **deleted** (all files, comments, everything)
- ❌ Collaborators lose access to that project

### If user was invited to a project:
- ✅ Project **remains** (it was created by someone else)
- ❌ Their collaboration entry is **removed**
- ✅ Other collaborators still have access

---

## Post-Deletion

After a user deletes their account:

- ❌ Cannot recover the account
- ❌ Cannot recover any data
- ✅ Can create a new account with the same email (email is freed up)
- ❌ New account will have no connection to old data

---

## Support

If users need help or want to recover their account:
- Account deletion is **permanent and irreversible**
- No recovery is possible
- They must create a new account
