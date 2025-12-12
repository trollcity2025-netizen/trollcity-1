-- Add new pricing and enhancement columns to streams table
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS pricing_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gift_multiplier TEXT DEFAULT 'off',
ADD COLUMN IF NOT EXISTS like_price TEXT DEFAULT '1',
ADD COLUMN IF NOT EXISTS family_xp_bonus BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS family_coin_bonus BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_followers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_family BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_officer_free_join BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS moderator_mode BOOLEAN DEFAULT false;

-- Create stream_presets table
CREATE TABLE IF NOT EXISTS stream_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_stream_presets_user_id ON stream_presets(user_id);

-- Create stream_entries table for tracking paid entries
CREATE TABLE IF NOT EXISTS stream_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  has_paid_entry BOOLEAN DEFAULT false,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stream_entries_stream_id ON stream_entries(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_entries_user_id ON stream_entries(user_id);

-- Enable RLS
ALTER TABLE stream_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_presets
CREATE POLICY "Users can view their own presets" ON stream_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presets" ON stream_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets" ON stream_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets" ON stream_presets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for stream_entries
CREATE POLICY "Users can view their own entries" ON stream_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries" ON stream_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries" ON stream_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow broadcasters to view entries for their streams
CREATE POLICY "Broadcasters can view entries for their streams" ON stream_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_entries.stream_id
      AND streams.broadcaster_id = auth.uid()
    )
  );