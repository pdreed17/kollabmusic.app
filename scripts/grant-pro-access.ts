/**
 * Utility script to grant Pro access to specific users
 *
 * Usage:
 *   npx ts-node scripts/grant-pro-access.ts pdreed17@gmail.com
 *   npx ts-node scripts/grant-pro-access.ts user1@example.com user2@example.com
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Make sure .env file is configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function grantProAccess(email: string) {
  console.log(`\n🔄 Granting Pro access to: ${email}`);

  // Update user to Pro tier
  const { data, error } = await supabase
    .from('users')
    .update({ subscription_tier: 'pro' })
    .eq('email', email)
    .select('id, email, username, subscription_tier');

  if (error) {
    console.error(`❌ Error granting Pro access to ${email}:`, error.message);
    return false;
  }

  if (!data || data.length === 0) {
    console.error(`❌ User not found: ${email}`);
    return false;
  }

  console.log(`✅ Successfully granted Pro access to ${email}`);
  console.log(`   Username: ${data[0].username}`);
  console.log(`   User ID: ${data[0].id}`);
  console.log(`   New tier: ${data[0].subscription_tier}`);

  return true;
}

async function main() {
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log('Usage: npx ts-node scripts/grant-pro-access.ts <email1> [email2] [email3]...');
    console.log('Example: npx ts-node scripts/grant-pro-access.ts pdreed17@gmail.com');
    process.exit(1);
  }

  console.log(`📝 Granting Pro access to ${emails.length} user(s)...\n`);

  let successCount = 0;
  for (const email of emails) {
    const success = await grantProAccess(email);
    if (success) successCount++;
  }

  console.log(`\n✅ Successfully granted Pro access to ${successCount}/${emails.length} user(s)`);
}

main().catch(console.error);
