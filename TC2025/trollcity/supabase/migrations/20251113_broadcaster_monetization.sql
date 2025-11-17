-- Broadcaster monetization system
-- High paying broadcasters who spend $1000+ per month

CREATE TABLE broadcaster_spending (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: YYYY-MM
  total_spent INTEGER DEFAULT 0, -- Amount in cents
  is_high_paying BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- YouTube Music integration for live streams
CREATE TABLE youtube_music_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id TEXT,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost INTEGER DEFAULT 3000, -- 3000 coins
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin broadcaster box assignments
CREATE TABLE broadcaster_boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  box_title TEXT,
  box_description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to calculate monthly spending
CREATE OR REPLACE FUNCTION calculate_user_monthly_spending(user_uuid UUID, target_month TEXT)
RETURNS INTEGER AS $$
DECLARE
  total_cents INTEGER := 0;
BEGIN
  -- Sum up all coin purchases for the month
  SELECT COALESCE(SUM(cents_amount), 0)
  INTO total_cents
  FROM coin_purchases 
  WHERE user_id = user_uuid 
    AND TO_CHAR(created_at, 'YYYY-MM') = target_month
    AND payment_status = 'completed';

  RETURN total_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update high paying broadcaster status
CREATE OR REPLACE FUNCTION update_high_paying_status(user_uuid UUID, target_month TEXT)
RETURNS VOID AS $$
DECLARE
  monthly_spending INTEGER;
  is_high_paying BOOLEAN;
BEGIN
  monthly_spending := calculate_user_monthly_spending(user_uuid, target_month);
  is_high_paying := (monthly_spending >= 100000); -- $1000 in cents

  INSERT INTO broadcaster_spending (user_id, month_year, total_spent, is_high_paying)
  VALUES (user_uuid, target_month, monthly_spending, is_high_paying)
  ON CONFLICT (user_id, month_year) 
  DO UPDATE SET 
    total_spent = monthly_spending,
    is_high_paying = is_high_paying,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month's high paying broadcasters
CREATE OR REPLACE FUNCTION get_current_high_paying_broadcasters()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  total_spent INTEGER,
  is_high_paying BOOLEAN,
  avatar_url TEXT,
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.user_id,
    p.username,
    bs.total_spent,
    bs.is_high_paying,
    p.avatar_url,
    p.level
  FROM broadcaster_spending bs
  JOIN profiles p ON bs.user_id = p.id
  WHERE bs.month_year = TO_CHAR(NOW(), 'YYYY-MM')
    AND bs.is_high_paying = TRUE
    AND p.role = 'broadcaster'
  ORDER BY bs.total_spent DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE broadcaster_spending ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_music_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcaster_boxes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcaster_spending
CREATE POLICY "Users can view own spending" ON broadcaster_spending
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all spending" ON broadcaster_spending
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- RLS Policies for youtube_music_purchases
CREATE POLICY "Users can view own purchases" ON youtube_music_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own purchases" ON youtube_music_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for broadcaster_boxes
CREATE POLICY "Anyone can view active boxes" ON broadcaster_boxes
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage all boxes" ON broadcaster_boxes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Grant permissions
GRANT SELECT ON broadcaster_spending TO anon, authenticated;
GRANT SELECT, INSERT ON youtube_music_purchases TO anon, authenticated;
GRANT SELECT ON broadcaster_boxes TO anon, authenticated;
GRANT ALL ON broadcaster_spending, youtube_music_purchases, broadcaster_boxes TO authenticated;