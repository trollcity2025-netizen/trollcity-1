-- Create a left sidebar ad
INSERT INTO public.city_ads (
  title,
  subtitle,
  description,
  image_url,
  placement,
  is_active,
  start_at,
  end_at,
  priority,
  display_order,
  label,
  campaign_type,
  created_by
) VALUES (
  'Welcome to Troll City!',
  'Join the Fun',
  'Get 5% bonus on all coin purchases!',
  'https://yjxpwfalenorzrqxwmtr.supabase.co/storage/v1/object/public/city-ads/8dff9f37-21b5-4b8e-adc2-b9286874be1a/1774122673569.jpeg',
  'left_sidebar_screensaver',
  true,
  NULL,
  NULL,
  1,
  0,
  'Troll City Promo',
  'troll_coins',
  '8dff9f37-21b5-4b8e-adc2-b9286874be1a'
);
