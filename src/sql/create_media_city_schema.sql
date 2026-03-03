-- Media City Database Schema
-- Creates tables for songs, albums, artist profiles, record labels, and related features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Artist Profiles table
CREATE TABLE IF NOT EXISTS artist_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_name VARCHAR(255) NOT NULL,
  bio TEXT,
  profile_banner_url TEXT,
  avatar_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  total_tips INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  label_id UUID,
  genre VARCHAR(100),
  location VARCHAR(255),
  website_url TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(artist_name)
);

-- Record Labels table
CREATE TABLE IF NOT EXISTS record_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founders JSONB DEFAULT '[]',
  revenue_split_artist INTEGER DEFAULT 70, -- percentage artist keeps
  revenue_split_label INTEGER DEFAULT 30,  -- percentage label takes
  artist_count INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  total_tips INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  creation_cost_paid INTEGER DEFAULT 10000, -- coins paid to create
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Label Members (artists signed to labels)
CREATE TABLE IF NOT EXISTS label_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label_id UUID NOT NULL REFERENCES record_labels(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  contract_terms JSONB DEFAULT '{}',
  revenue_split_artist INTEGER DEFAULT 70,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(label_id, artist_id)
);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  release_type VARCHAR(50) DEFAULT 'single', -- 'single', 'ep', 'album'
  genre VARCHAR(100),
  release_date DATE,
  total_tracks INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  total_tips INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  label_id UUID REFERENCES record_labels(id) ON DELETE SET NULL,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
  label_id UUID REFERENCES record_labels(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER, -- in seconds
  genre VARCHAR(100),
  bpm INTEGER,
  key_signature VARCHAR(20),
  isrc_code VARCHAR(50),
  track_number INTEGER,
  plays INTEGER DEFAULT 0,
  unique_plays INTEGER DEFAULT 0, -- deduplicated by user
  tips_total INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_explicit BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  allow_tips BOOLEAN DEFAULT TRUE,
  allow_downloads BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}', -- for additional audio metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Song Tips table
CREATE TABLE IF NOT EXISTS song_tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  tipper_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  tip_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'super', 'mega'
  message TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  artist_earnings INTEGER NOT NULL, -- amount artist receives after label split
  label_earnings INTEGER DEFAULT 0, -- amount label receives
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song Plays table (for tracking unique plays)
CREATE TABLE IF NOT EXISTS song_plays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- null for anonymous plays
  session_id VARCHAR(255), -- for tracking anonymous plays
  play_duration INTEGER, -- how many seconds they listened
  completed BOOLEAN DEFAULT FALSE, -- did they listen to full song
  source VARCHAR(100), -- 'discover', 'profile', 'album', 'search', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  play_date DATE DEFAULT CURRENT_DATE -- for enforcing one play per user per day
);

-- Create unique index for one play per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_song_plays_unique_daily
ON song_plays(song_id, user_id, play_date)
WHERE user_id IS NOT NULL;

-- Song Likes table
CREATE TABLE IF NOT EXISTS song_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);

-- Song Comments table
CREATE TABLE IF NOT EXISTS song_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES song_comments(id) ON DELETE CASCADE, -- for replies
  likes_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Studio Projects (for drafts and WIP)
CREATE TABLE IF NOT EXISTS studio_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artist_profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) DEFAULT 'recording', -- 'recording', 'multitrack', 'mastering'
  recording_mode VARCHAR(50) DEFAULT 'voice_only', -- 'voice_only', 'voice_beat', 'multitrack'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'processing', 'completed', 'archived'
  vocal_track_url TEXT,
  beat_track_url TEXT,
  beat_url TEXT,
  mixed_track_url TEXT,
  effects_applied JSONB DEFAULT '[]',
  bpm INTEGER,
  key_signature VARCHAR(20),
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for migrations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studio_projects' AND column_name = 'recording_mode') THEN
    ALTER TABLE studio_projects ADD COLUMN recording_mode VARCHAR(50) DEFAULT 'voice_only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studio_projects' AND column_name = 'beat_url') THEN
    ALTER TABLE studio_projects ADD COLUMN beat_url TEXT;
  END IF;
END $$;

-- Trending/Charts tracking
CREATE TABLE IF NOT EXISTS chart_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  chart_type VARCHAR(50) NOT NULL, -- 'trending', 'top_tipped', 'new_releases', 'local'
  position INTEGER NOT NULL,
  previous_position INTEGER,
  plays_count INTEGER DEFAULT 0,
  tips_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chart_type, song_id, period_start)
);

-- Artist Followers table
CREATE TABLE IF NOT EXISTS artist_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist_id, follower_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_songs_artist_id ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_label_id ON songs(label_id);
CREATE INDEX IF NOT EXISTS idx_songs_published ON songs(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_songs_featured ON songs(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_plays ON songs(plays DESC);
CREATE INDEX IF NOT EXISTS idx_songs_tips ON songs(tips_total DESC);
CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);

CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_label_id ON albums(label_id);
CREATE INDEX IF NOT EXISTS idx_albums_published ON albums(is_published) WHERE is_published = TRUE;

CREATE INDEX IF NOT EXISTS idx_artist_profiles_user_id ON artist_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_profiles_verified ON artist_profiles(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_artist_profiles_label_id ON artist_profiles(label_id);

CREATE INDEX IF NOT EXISTS idx_record_labels_owner ON record_labels(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_record_labels_featured ON record_labels(featured) WHERE featured = TRUE;

CREATE INDEX IF NOT EXISTS idx_song_tips_song_id ON song_tips(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tips_artist_id ON song_tips(artist_id);
CREATE INDEX IF NOT EXISTS idx_song_tips_tipper ON song_tips(tipper_user_id);

CREATE INDEX IF NOT EXISTS idx_song_plays_song_id ON song_plays(song_id);
CREATE INDEX IF NOT EXISTS idx_song_plays_user_id ON song_plays(user_id);
CREATE INDEX IF NOT EXISTS idx_song_plays_created ON song_plays(created_at);

CREATE INDEX IF NOT EXISTS idx_song_likes_song_id ON song_likes(song_id);
CREATE INDEX IF NOT EXISTS idx_song_likes_user_id ON song_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_chart_entries_chart_type ON chart_entries(chart_type);
CREATE INDEX IF NOT EXISTS idx_chart_entries_period ON chart_entries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_chart_entries_position ON chart_entries(position);

CREATE INDEX IF NOT EXISTS idx_artist_followers_artist_id ON artist_followers(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_followers_follower ON artist_followers(follower_user_id);

-- Enable Row Level Security
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for artist_profiles
CREATE POLICY "Artist profiles are viewable by everyone" ON artist_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own artist profile" ON artist_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own artist profile" ON artist_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own artist profile" ON artist_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for record_labels
CREATE POLICY "Record labels are viewable by everyone" ON record_labels
  FOR SELECT USING (true);

CREATE POLICY "Users can create record labels" ON record_labels
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can update their record labels" ON record_labels
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete their record labels" ON record_labels
  FOR DELETE USING (auth.uid() = owner_user_id);

-- RLS Policies for label_members
CREATE POLICY "Label members are viewable by everyone" ON label_members
  FOR SELECT USING (true);

CREATE POLICY "Label owners can add members" ON label_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM record_labels 
      WHERE id = label_id AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Label owners can update members" ON label_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM record_labels 
      WHERE id = label_id AND owner_user_id = auth.uid()
    )
  );

-- RLS Policies for albums
CREATE POLICY "Published albums are viewable by everyone" ON albums
  FOR SELECT USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Artists can create albums" ON albums
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Artists can update their own albums" ON albums
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Artists can delete their own albums" ON albums
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for songs
CREATE POLICY "Published songs are viewable by everyone" ON songs
  FOR SELECT USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Artists can create songs" ON songs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Artists can update their own songs" ON songs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Artists can delete their own songs" ON songs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for song_tips
CREATE POLICY "Song tips are viewable by everyone" ON song_tips
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can tip songs" ON song_tips
  FOR INSERT WITH CHECK (auth.uid() = tipper_user_id);

-- RLS Policies for song_plays
CREATE POLICY "Song plays are viewable by everyone" ON song_plays
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can record plays" ON song_plays
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for song_likes
CREATE POLICY "Song likes are viewable by everyone" ON song_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like songs" ON song_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike songs" ON song_likes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for song_comments
CREATE POLICY "Song comments are viewable by everyone" ON song_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment" ON song_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON song_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON song_comments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for studio_projects
CREATE POLICY "Users can view their own studio projects" ON studio_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create studio projects" ON studio_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON studio_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON studio_projects
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chart_entries
CREATE POLICY "Chart entries are viewable by everyone" ON chart_entries
  FOR SELECT USING (true);

-- RLS Policies for artist_followers
CREATE POLICY "Artist followers are viewable by everyone" ON artist_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow artists" ON artist_followers
  FOR INSERT WITH CHECK (auth.uid() = follower_user_id);

CREATE POLICY "Users can unfollow artists" ON artist_followers
  FOR DELETE USING (auth.uid() = follower_user_id);

-- Functions for updating counts
CREATE OR REPLACE FUNCTION increment_artist_followers()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE artist_profiles 
  SET followers_count = followers_count + 1 
  WHERE id = NEW.artist_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_artist_followers()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE artist_profiles 
  SET followers_count = GREATEST(0, followers_count - 1)
  WHERE id = OLD.artist_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_followers
  AFTER INSERT ON artist_followers
  FOR EACH ROW EXECUTE FUNCTION increment_artist_followers();

CREATE TRIGGER trg_decrement_followers
  AFTER DELETE ON artist_followers
  FOR EACH ROW EXECUTE FUNCTION decrement_artist_followers();

-- Function to update song likes count
CREATE OR REPLACE FUNCTION update_song_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET likes_count = likes_count + 1 WHERE id = NEW.song_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE songs SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.song_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_song_likes
  AFTER INSERT OR DELETE ON song_likes
  FOR EACH ROW EXECUTE FUNCTION update_song_likes_count();

-- Function to process song tip with label split
CREATE OR REPLACE FUNCTION process_song_tip(
  p_song_id UUID,
  p_tipper_user_id UUID,
  p_amount INTEGER,
  p_message TEXT DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_artist_id UUID;
  v_label_id UUID;
  v_artist_user_id UUID;
  v_revenue_split_artist INTEGER;
  v_revenue_split_label INTEGER;
  v_artist_earnings INTEGER;
  v_label_earnings INTEGER;
  v_tip_id UUID;
BEGIN
  -- Get song and artist info
  SELECT s.artist_id, s.user_id, s.label_id INTO v_artist_id, v_artist_user_id, v_label_id
  FROM songs s WHERE s.id = p_song_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Song not found');
  END IF;
  
  -- Get revenue split
  IF v_label_id IS NOT NULL THEN
    SELECT revenue_split_artist, revenue_split_label 
    INTO v_revenue_split_artist, v_revenue_split_label
    FROM label_members 
    WHERE label_id = v_label_id AND artist_id = v_artist_id AND is_active = true;
    
    IF v_revenue_split_artist IS NULL THEN
      v_revenue_split_artist := 70;
      v_revenue_split_label := 30;
    END IF;
  ELSE
    v_revenue_split_artist := 100;
    v_revenue_split_label := 0;
  END IF;
  
  -- Calculate earnings
  v_artist_earnings := (p_amount * v_revenue_split_artist) / 100;
  v_label_earnings := (p_amount * v_revenue_split_label) / 100;
  
  -- Create tip record
  INSERT INTO song_tips (
    song_id, artist_id, tipper_user_id, amount, tip_type, message, is_anonymous,
    artist_earnings, label_earnings
  ) VALUES (
    p_song_id, v_artist_id, p_tipper_user_id, p_amount,
    CASE 
      WHEN p_amount >= 500 THEN 'mega'
      WHEN p_amount >= 100 THEN 'super'
      ELSE 'standard'
    END,
    p_message, p_is_anonymous, v_artist_earnings, v_label_earnings
  ) RETURNING id INTO v_tip_id;
  
  -- Update song tips total
  UPDATE songs SET tips_total = tips_total + p_amount WHERE id = p_song_id;
  
  -- Update artist profile coins earned
  UPDATE artist_profiles SET 
    total_tips = total_tips + p_amount,
    coins_earned = coins_earned + v_artist_earnings
  WHERE id = v_artist_id;
  
  -- Update label stats if applicable
  IF v_label_id IS NOT NULL THEN
    UPDATE record_labels SET 
      total_tips = total_tips + p_amount
    WHERE id = v_label_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'artist_earnings', v_artist_earnings,
    'label_earnings', v_label_earnings
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record song play
CREATE OR REPLACE FUNCTION record_song_play(
  p_song_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id VARCHAR DEFAULT NULL,
  p_play_duration INTEGER DEFAULT NULL,
  p_source VARCHAR DEFAULT 'unknown'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_already_played_today BOOLEAN;
BEGIN
  -- Check if user already played today
  SELECT EXISTS(
    SELECT 1 FROM song_plays 
    WHERE song_id = p_song_id 
    AND user_id = p_user_id 
    AND DATE(created_at) = CURRENT_DATE
  ) INTO v_already_played_today;
  
  -- Insert play record
  INSERT INTO song_plays (song_id, user_id, session_id, play_duration, completed, source)
  VALUES (p_song_id, p_user_id, p_session_id, p_play_duration, 
          CASE WHEN p_play_duration IS NOT NULL THEN false END, p_source);
  
  -- Update play counts (only count unique plays once per day per user)
  UPDATE songs SET plays = plays + 1 WHERE id = p_song_id;
  
  IF NOT v_already_played_today AND p_user_id IS NOT NULL THEN
    UPDATE songs SET unique_plays = unique_plays + 1 WHERE id = p_song_id;
  END IF;
  
  -- Update artist total plays
  UPDATE artist_profiles 
  SET total_plays = total_plays + 1
  WHERE id = (SELECT artist_id FROM songs WHERE id = p_song_id);
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the schema
COMMENT ON TABLE artist_profiles IS 'Artist profiles for Media City - public music identities';
COMMENT ON TABLE record_labels IS 'Record labels that artists can sign with';
COMMENT ON TABLE songs IS 'Music tracks uploaded by artists';
COMMENT ON TABLE albums IS 'Albums, EPs, and singles collections';
COMMENT ON TABLE song_tips IS 'Tips/donations given to songs by users';
COMMENT ON TABLE studio_projects IS 'Work-in-progress recordings and studio sessions';