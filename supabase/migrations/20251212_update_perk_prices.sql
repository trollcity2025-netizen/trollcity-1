-- Migration: Update Perk Prices
-- Created: 2025-12-12
-- Purpose: Update perk prices to range from 200 to 5000 paid coins

-- Update existing perk prices
UPDATE perks SET cost = 200 WHERE id = 'perk_disappear_chat'; -- Disappearing Chats (30m)
UPDATE perks SET cost = 500 WHERE id = 'perk_ghost_mode'; -- Ghost Mode (30m)
UPDATE perks SET cost = 300 WHERE id = 'perk_message_admin'; -- Message Admin (Officer Only)
UPDATE perks SET cost = 5000 WHERE id = 'perk_global_highlight'; -- Glowing Username (1h)
UPDATE perks SET cost = 4000 WHERE id = 'perk_slowmo_chat'; -- Slow-Motion Chat Control (5hrs)
UPDATE perks SET cost = 2500 WHERE id = 'perk_troll_alarm'; -- Troll Alarm Arrival (100hrs)
UPDATE perks SET cost = 1500 WHERE id = 'perk_ban_shield'; -- Ban Shield (2hrs)
UPDATE perks SET cost = 800 WHERE id = 'perk_double_xp'; -- Double XP Mode (1h)
UPDATE perks SET cost = 3000 WHERE id = 'perk_flex_banner'; -- Golden Flex Banner (100h)
UPDATE perks SET cost = 2000 WHERE id = 'perk_troll_spell'; -- Troll Spell (1h)

-- Verification query
SELECT id, name, cost, description FROM perks ORDER BY cost ASC;