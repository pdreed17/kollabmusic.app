-- Grant Pro access to specific user(s)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Grant Pro to pdreed17@gmail.com
UPDATE users
SET subscription_tier = 'pro'
WHERE email = 'pdreed17@gmail.com';

-- Verify the update
SELECT id, email, username, subscription_tier, created_at
FROM users
WHERE email = 'pdreed17@gmail.com';
