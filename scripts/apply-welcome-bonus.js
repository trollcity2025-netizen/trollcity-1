// Script to apply 1000 Tromonds welcome bonus to all existing users
// Run this once to give current users the same welcome bonus as new users

import { createClient } from '@supabase/supabase-js';

// Get environment variables (should be available from the project)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyWelcomeBonus() {
  try {
    console.log('🚀 Applying 1000 Tromonds welcome bonus to all existing users...');

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, username, free_coin_balance, total_earned_coins');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log(`📊 Found ${users.length} users to update`);

    // Update each user with the bonus
    let updatedCount = 0;
    for (const user of users) {
      try {
        // Update user balance
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            free_coin_balance: (user.free_coin_balance || 0) + 1000,
            total_earned_coins: (user.total_earned_coins || 0) + 1000,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ Error updating user ${user.username}:`, updateError);
          continue;
        }

        // Add transaction record
        const { error: transactionError } = await supabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            type: 'welcome_bonus',
            amount: 1000,
            description: 'Welcome bonus for existing Troll City users!',
            created_at: new Date().toISOString()
          });

        if (transactionError) {
          console.error(`❌ Error creating transaction for user ${user.username}:`, transactionError);
        } else {
          console.log(`✅ Updated ${user.username} (+1000 Tromonds)`);
          updatedCount++;
        }
      } catch (err) {
        console.error(`❌ Error processing user ${user.username}:`, err);
      }
    }

    console.log(`\n🎉 Successfully applied welcome bonus to ${updatedCount} users!`);
    console.log('💰 Each user received 1000 Tromonds added to their free coin balance.');

  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
applyWelcomeBonus();