-- Add event participation badges to the badge catalog

-- Add community event badges
INSERT INTO badge_catalog (slug, name, description, category, rarity, sort_order, icon_url, is_active)
VALUES 
  ('neighbor_event_first', 'First Neighbor Event', 'Attended your first neighbor event', 'community', 'common', 200, '🎉', true),
  ('neighbor_event_regular', 'Regular Neighbor', 'Attended 5 neighbor events', 'community', 'uncommon', 201, '📅', true),
  ('neighbor_event_devoted', 'Devoted Neighbor', 'Attended 10 neighbor events', 'community', 'rare', 202, '⭐', true),
  ('neighbor_event_legend', 'Legendary Neighbor', 'Attended 25 neighbor events', 'community', 'epic', 203, '🏆', true),
  ('neighbor_event_host', 'Event Host', 'Hosted a neighbor event', 'community', 'uncommon', 204, '🎭', true),
  ('neighbor_business_supporter', 'Business Supporter', 'Supported 5 local businesses', 'community', 'uncommon', 205, '🏪', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  icon_url = EXCLUDED.icon_url,
  is_active = EXCLUDED.is_active;
