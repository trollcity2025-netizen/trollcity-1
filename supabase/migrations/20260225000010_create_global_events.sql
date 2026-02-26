
-- Create the global events table
CREATE TABLE global_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- e.g., 'gift', 'property', 'jail', 'announcement'
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- e.g., 'coins', 'home', 'gavel'
    priority INT DEFAULT 1, -- 1=normal, 2=important, 3=huge
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE global_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access" ON global_events FOR SELECT USING (true);
CREATE POLICY "Allow service_role to insert" ON global_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow service_role to delete" ON global_events FOR DELETE USING (auth.role() = 'service_role');

-- Create an index on created_at for faster sorting
CREATE INDEX idx_global_events_created_at ON global_events(created_at DESC);
