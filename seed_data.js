const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://yjxpwfalenorzrqxwmtr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'
);

// SQL to seed the data
const seedSQL = `
-- Insert entrance effects
INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type) VALUES
  ('effect_flame_burst', '🔥 Flame Burst', '🔥', 500, 'Rare', 'Enter with a burst of flames', 'flame'),
  ('effect_money_shower', '💸 Money Shower', '💸', 1500, 'Epic', 'Rain money when you arrive', 'money_shower'),
  ('effect_electric_flash', '⚡ Electric Flash', '⚡', 2800, 'Epic', 'Electric lightning entrance', 'electric'),
  ('effect_royal_throne', '👑 Royal Throne', '👑', 5200, 'Legendary', 'Descend on a royal throne', 'throne'),
  ('effect_rainbow_descent', '🌈 Rainbow Descent', '🌈', 8500, 'Legendary', 'Arrive on a rainbow', 'rainbow'),
  ('effect_troll_rollup', '🚗 Troll Roll-Up', '🚗', 12000, 'Mythic', 'Drive in with style', 'car'),
  ('effect_vip_siren', '🚨 VIP Siren Rush', '🚨', 25000, 'Mythic', 'VIP siren announcement', 'siren'),
  ('effect_firework', '🎆 Firework Explosion', '🎆', 50000, 'Mythic', 'Explode onto the scene', 'firework'),
  ('effect_troll_king', '🧌 Troll King Arrival', '🧌', 100000, 'Exclusive', 'Ultimate king entrance', 'king')
ON CONFLICT (id) DO NOTHING;

-- Insert perks
INSERT INTO perks (id, name, cost, description, duration_minutes, perk_type) VALUES
  ('perk_disappear_chat', 'Disappearing Chats (30m)', 500, 'Your chats auto-hide after 10s for 30 minutes', 30, 'visibility'),
  ('perk_ghost_mode', 'Ghost Mode (30m)', 1200, 'View streams in stealth without status indicators', 30, 'visibility'),
  ('perk_message_admin', 'Message Admin (Officer Only)', 250, 'Unlock DM to Admin', 10080, 'chat'),
  ('perk_global_highlight', 'Glowing Username (1h)', 8000, 'Your username glows neon in all chats & gift animations', 60, 'cosmetic'),
  ('perk_rgb_username', 'RGB Username (24h)', 420, 'Rainbow glow visible to everyone', 1440, 'cosmetic'),
  ('perk_slowmo_chat', 'Slow-Motion Chat Control (5hrs)', 15000, 'Activate chat slow-mode in any live stream', 300, 'chat'),
  ('perk_troll_alarm', 'Troll Alarm Arrival (100hrs)', 2000, 'Sound + flash announces your arrival', 6000, 'cosmetic'),
  ('perk_ban_shield', 'Ban Shield (2hrs)', 1700, 'Immunity from kick, mute, or ban for 2 hours', 120, 'protection'),
  ('perk_double_xp', 'Double XP Mode (1h)', 1300, 'Earn 2x XP for the next hour', 60, 'boost'),
  ('perk_flex_banner', 'Golden Flex Banner (100h)', 3500, 'Golden crown banner on all your messages', 6000, 'cosmetic'),
  ('perk_troll_spell', 'Troll Spell (1h)', 2800, 'Randomly change another user''s username style & emoji for 100 hour', 60, 'cosmetic')
ON CONFLICT (id) DO NOTHING;

-- Insert insurance options
INSERT INTO insurance_options (id, name, cost, description, duration_hours, protection_type) VALUES
  ('insurance_bankrupt_24h', 'Bankrupt Insurance (24h)', 1500, 'Protect from wheel bankrupt for 24 hours', 24, 'bankrupt'),
  ('insurance_kick_24h', 'Kick Insurance (24h)', 1200, 'Protect from kick penalties for 24 hours', 24, 'kick'),
  ('insurance_full_24h', 'Full Protection (24h)', 2500, 'Complete protection for 24 hours', 24, 'full'),
  ('insurance_bankrupt_week', 'Bankrupt Insurance (1 Week)', 8000, 'Protect from wheel bankrupt for 1 week', 168, 'bankrupt'),
  ('insurance_full_week', 'Full Protection (1 Week)', 15000, 'Complete protection for 1 week', 168, 'full')
ON CONFLICT (id) DO NOTHING;
`;

async function seedData() {
  try {
    console.log('Seeding entrance effects, perks, and insurance data...');
    
    // Execute the seed SQL
    const result = await supabase.rpc('execute_sql', { sql: seedSQL });
    
    if (result.error) {
      console.error('Error seeding data:', result.error);
      return;
    }
    
    console.log('Data seeded successfully!');
    
    // Verify the data
    const effects = await supabase.from('entrance_effects').select('id, name').limit(10);
    const perks = await supabase.from('perks').select('id, name').limit(10);
    const insurance = await supabase.from('insurance_options').select('id, name').limit(10);
    
    console.log('Entrance Effects:', effects.data?.length || 0, 'records');
    console.log('Perks:', perks.data?.length || 0, 'records');
    console.log('Insurance Options:', insurance.data?.length || 0, 'records');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

seedData();
