# Authentication Session Fix

## Problem Identified

**Error found in logs:**
```
ERROR  [AuthApiError: Invalid Refresh Token: Refresh Token Not Found]
```

## What This Means

Your app's authentication session is **broken**. This happens when:
1. The refresh token stored in AsyncStorage is invalid or expired
2. The Supabase backend doesn't recognize the token
3. The app UI shows you as "logged in" but database queries run as anonymous

This explains:
- ✅ Why you can't see your projects (RLS policies check `auth.uid()` which is NULL)
- ✅ Why `SELECT auth.uid();` returned NULL in Supabase SQL Editor
- ✅ Why project creation might have failed earlier
- ✅ Why all RLS-protected queries return empty results

## How to Fix (Method 1: Simple Logout/Login)

1. **Open the app** on your device/simulator
2. **Navigate to Settings** → **Sign Out**
3. **Sign back in** with your credentials
4. **Try viewing projects** again

This will:
- Clear the invalid refresh token
- Create a new valid session
- Restore database authentication

## How to Fix (Method 2: Clear App Data - If logout doesn't work)

If the logout button doesn't work due to the auth error:

1. **Close the app completely**
2. **Delete the app** from your device/simulator
3. **Rebuild and reinstall:**
   ```bash
   npx expo run:ios --device "iPhone 16e"
   ```
4. **Sign in again** with your credentials

## How to Fix (Method 3: Clear AsyncStorage)

Add temporary code to force-clear the auth session:

1. Open `App.tsx`
2. Add this code at the top of the component:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

// Add inside App component, temporarily
useEffect(() => {
  const clearAuth = async () => {
    await AsyncStorage.clear()
    console.log('Auth storage cleared - please restart app')
  }
  clearAuth()
}, [])
```

3. Run the app once (it will clear storage and log out)
4. Remove the code
5. Run the app again and sign in

## Verifying the Fix

After logging back in, check the console for:

```
===== PROJECT LOADING DIAGNOSTICS =====
User ID from context: [VALID_UUID]
User email: your@email.com
My projects query result: { count: X, ... }
```

**Success indicators:**
- ✅ No "Invalid Refresh Token" error
- ✅ User ID is a valid UUID
- ✅ Projects load successfully
- ✅ No RLS policy errors

## Why This Happened

This typically occurs when:
1. **Token expiry mismatch:** The refresh token expired but wasn't properly renewed
2. **Backend session cleared:** Supabase session was invalidated server-side
3. **Development issues:** Hot reloading or app restarts can corrupt the session
4. **Manual database changes:** If you modified the `auth.users` table directly

## Prevention

To prevent this in the future:

1. **Proper error handling:** The AuthContext should handle token refresh errors
2. **Auto-logout on auth errors:** Automatically sign out when auth fails
3. **Session validation:** Periodically check if the session is still valid

I can implement these improvements if you want.

## If Projects Still Don't Load After Re-login

If you successfully log back in but still can't see projects, it means:

1. **User ID mismatch:** You're logging in as a different user than who created the projects
2. **Check the diagnostic logs** (see `PROJECT_LOADING_DIAGNOSTICS.md`)
3. Compare the logged-in user ID with the creator IDs in the database

## Next Steps

1. **Sign out and sign back in** (Method 1)
2. **Check if projects load**
3. **Share the diagnostic logs** if issues persist

The authentication fix should resolve the core issue. Any remaining problems will be visible in the diagnostic logs.
