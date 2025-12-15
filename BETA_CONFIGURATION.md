# Beta Testing Configuration Guide

## Automatic Pro Access for Beta Testers

During beta testing, the app automatically grants **Pro subscription tier** to the first users who sign up. This allows you to test Pro features with real users without requiring payment.

## Current Settings

- **Auto Pro User Limit**: 50 users
- **Beta Mode**: Enabled

The first 50 users to sign up will automatically receive Pro access.

---

## How to Change the Limit

### To Increase or Decrease the Number

1. Open the file: `src/config/beta.config.ts`
2. Find the line: `AUTO_PRO_USER_LIMIT: 50,`
3. Change `50` to your desired number (e.g., `100`, `200`, or `0`)
4. Save the file
5. Rebuild the app:
   ```bash
   eas build --platform ios --profile development
   ```

### Examples

**Give 200 users Pro access:**
```typescript
AUTO_PRO_USER_LIMIT: 200,
```

**Give 50 users Pro access:**
```typescript
AUTO_PRO_USER_LIMIT: 50,
```

**Disable automatic Pro access:**
```typescript
AUTO_PRO_USER_LIMIT: 0,
```

---

## How It Works

1. When a new user signs up, the system counts total users in the database
2. If the user count is ≤ the limit, they get Pro access automatically
3. Users beyond the limit get Free tier access

**Important Notes:**
- The count includes ALL users in the database
- If you have 25 users and change the limit to 50, the next 25 new users (26-50) will get Pro
- If you have 75 users and change the limit to 100, the next 25 new users (76-100) will get Pro
- Changing the limit does NOT affect existing users - only new signups

---

## Turning Off Beta Mode Completely

To disable all beta features:

1. Open `src/config/beta.config.ts`
2. Change `BETA_MODE_ENABLED: true,` to `BETA_MODE_ENABLED: false,`
3. Rebuild the app

---

## Checking Current User Count

To see how many users have signed up:

1. Log into your Supabase dashboard
2. Go to Table Editor → `users` table
3. The row count shows total users

Alternatively, run this SQL query in the SQL Editor:
```sql
SELECT COUNT(*) FROM users;
```

---

## Manually Upgrading/Downgrading Users

To manually change a user's subscription tier:

1. Log into Supabase dashboard
2. Go to Table Editor → `users` table
3. Find the user by email or username
4. Edit the `subscription_tier` column to `'pro'` or `'free'`
5. Save

Or use SQL:
```sql
-- Upgrade a user to Pro
UPDATE users
SET subscription_tier = 'pro'
WHERE email = 'user@example.com';

-- Downgrade a user to Free
UPDATE users
SET subscription_tier = 'free'
WHERE email = 'user@example.com';
```

---

## After Beta Testing

When you're ready to launch publicly:

1. Set `AUTO_PRO_USER_LIMIT: 0` (or set `BETA_MODE_ENABLED: false`)
2. Decide what to do with beta testers who have Pro access:
   - **Option A**: Let them keep Pro access as a thank you
   - **Option B**: Downgrade them and offer a discount code
   - **Option C**: Give them a grace period (e.g., 30 days) then downgrade

3. To downgrade all beta users at once, run:
   ```sql
   UPDATE users
   SET subscription_tier = 'free'
   WHERE subscription_tier = 'pro';
   ```
