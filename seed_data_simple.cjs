const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://yjxpwfalenorzrqxwmtr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'
);

async function seedData() {
  try {
    console.log('Seeding entrance effects, perks, and insurance data...');
    
    // Insert entrance effects
    const effects = [
      { id: 'effect_flame_burst', name: '🔥 Flame Burst', icon: '🔥', coin_cost: 500, rarity: 'Rare', description: 'Enter with a burst of flames', animation_type: 'flame' },
      { id: 'effect_money_shower', name: '💸 Money Shower', icon: '💸', coin_cost: 1500, rarity: 'Epic', description: 'Rain money when you arrive', animation_type: 'money_shower' },
      { id: 'effect_electric_flash', name: '⚡ Electric Flash', icon: '⚡', coin_cost: 2800, rarity: 'Epic', description: 'Electric lightning entrance', animation_type: 'electric' },
      { id: 'effect_royal_throne', name: '👑 Royal Throne', icon: '👑', coin_cost: 5200, rarity: 'Legendary', description: 'Descend on a royal throne', animation_type: 'throne' },
      { id: 'effect_rainbow_descent', name: '🌈 Rainbow Descent', icon: '🌈', coin_cost: 8500, rarity: 'Legendary', description: 'Arrive on a rainbow', animation_type: 'rainbow' },
      { id: 'effect_troll_rollup', name: '🚗 Troll Roll-Up', icon: '🚗', coin_cost: 12000, rarity: 'Mythic', description: 'Drive in with style', animation_type: 'car' },
      { id: 'effect_vip_siren', name: '🚨 VIP Siren Rush', icon: '🚨', coin_cost: 25000, rarity: 'Mythic', description: 'VIP siren announcement', animation_type: 'siren' },
      { id: 'effect_firework', name: '🎆 Firework Explosion', icon: '🎆', coin_cost: 50000, rarity: 'Mythic', description: 'Explode onto the scene', animation_type: 'firework' },
      { id: 'effect_troll_king', name: '🧌 Troll King Arrival', icon: '🧌', coin_cost: 100000, rarity: 'Exclusive', description: 'Ultimate king entrance', animation_type: 'king' }
    ];

    for (const effect of effects) {
      await supabase.from('entrance_effects').upsert(effect, { onConflict: 'id' });
    }
    
    // Insert perks
    const perks = [
      { id: 'perk_disappear_chat', name: 'Disappearing Chats (30m)', cost: 500, description: 'Your chats auto-hide after 10s for 30 minutes', duration_minutes: 30, perk_type: 'visibility' },
      { id: 'perk_ghost_mode', name: 'Ghost Mode (30m)', cost: 1200, description: 'View streams in stealth without status indicators', duration_minutes: 30, perk_type: 'visibility' },
      { id: 'perk_message_admin', name: 'Message Admin (Officer Only)', cost: 250, description: 'Unlock DM to Admin', duration_minutes: 10080, perk_type: 'chat' },
      { id: 'perk_global_highlight', name: 'Glowing Username (1h)', cost: 8000, description: 'Your username glows neon in all chats & gift animations', duration_minutes: 60, perk_type: 'cosmetic' },
      { id: 'perk_slowmo_chat', name: 'Slow-Motion Chat Control (5hrs)', cost: 15000, description: 'Activate chat slow-mode in any live stream', duration_minutes: 300, perk_type: 'chat' },
      { id: 'perk_troll_alarm', name: 'Troll Alarm Arrival (100hrs)', cost: 2000, description: 'Sound + flash announces your arrival', duration_minutes: 6000, perk_type: 'cosmetic' },
      { id: 'perk_ban_shield', name: 'Ban Shield (2hrs)', cost: 1700, description: 'Immunity from kick, mute, or ban for 2 hours', duration_minutes: 120, perk_type: 'protection' },
      { id: 'perk_double_xp', name: 'Double XP Mode (1h)', cost: 1300, description: 'Earn 2x XP for the next hour', duration_minutes: 60, perk_type: 'boost' },
      { id: 'perk_flex_banner', name: 'Golden Flex Banner (100h)', cost: 3500, description: 'Golden crown banner on all your messages', duration_minutes: 6000, perk_type: 'cosmetic' },
      { id: 'perk_troll_spell', name: 'Troll Spell (1h)', cost: 2800, description: 'Randomly change another user\'s username style & emoji for 100 hour', duration_minutes: 60, perk_type: 'cosmetic' }
    ];

    for (const perk of perks) {
      await supabase.from('perks').upsert(perk, { onConflict: 'id' });
    }
    
    // Insert insurance options
    const insurance = [
      { id: 'insurance_bankrupt_24h', name: 'Bankrupt Insurance (24h)', cost: 1500, description: 'Protect from wheel bankrupt for 24 hours', duration_hours: 24, protection_type: 'bankrupt' },
      { id: 'insurance_kick_24h', name: 'Kick Insurance (24h)', cost: 1200, description: 'Protect from kick penalties for 24 hours', duration_hours: 24, protection_type: 'kick' },
      { id: 'insurance_full_24h', name: 'Full Protection (24h)', cost: 2500, description: 'Complete protection for 24 hours', duration_hours: 24, protection_type: 'full' },
      { id: 'insurance_bankrupt_week', name: 'Bankrupt Insurance (1 Week)', cost: 8000, description: 'Protect from wheel bankrupt for 1 week', duration_hours: 168, protection_type: 'bankrupt' },
      { id: 'insurance_full_week', name: 'Full Protection (1 Week)', cost: 15000, description: 'Complete protection for 1 week', duration_hours: 168, protection_type: 'full' }
    ];

    for (const ins of insurance) {
      await supabase.from('insurance_options').upsert(ins, { onConflict: 'id' });
    }
    
    console.log('Data seeded successfully!');
    
    // Verify the data
    const effectsResult = await supabase.from('entrance_effects').select('id, name').limit(10);
    const perksResult = await supabase.from('perks').select('id, name').limit(10);
    const insuranceResult = await supabase.from('insurance_options').select('id, name').limit(10);
    
    console.log('Entrance Effects:', effectsResult.data?.length || 0, 'records');
    console.log('Perks:', perksResult.data?.length || 0, 'records');
    console.log('Insurance Options:', insuranceResult.data?.length || 0, 'records');
    
    if (effectsResult.data && effectsResult.data.length > 0) {
      console.log('Sample effects:', effectsResult.data.map(e => e.name));
    }
    
    if (perksResult.data && perksResult.data.length > 0) {
      console.log('Sample perks:', perksResult.data.map(p => p.name));
    }
    
    if (insuranceResult.data && insuranceResult.data.length > 0) {
      console.log('Sample insurance:', insuranceResult.data.map(i => i.name));
    }
    
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

seedData();