
-- Create the show sessions table
CREATE TABLE mai_show_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    host_id uuid REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, live, ended
    auditions_completed INT DEFAULT 0,
    max_auditions INT DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the stage slots table
CREATE TABLE mai_stage_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES mai_show_sessions(id) ON DELETE CASCADE,
    slot TEXT NOT NULL, -- A, B
    user_id uuid REFERENCES auth.users(id),
    role TEXT NOT NULL, -- performer, judge
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, slot)
);

-- Create the audition queue table
CREATE TABLE mai_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES mai_show_sessions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    position INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, on_stage, completed, left
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, user_id)
);

-- Create the performance timer table
CREATE TABLE mai_performance_timer (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES mai_show_sessions(id) ON DELETE CASCADE,
    performer_user_id uuid REFERENCES auth.users(id),
    slot TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    active BOOLEAN DEFAULT true,
    UNIQUE(session_id, performer_user_id, slot)
);

-- Enable RLS for the new tables
ALTER TABLE mai_show_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_stage_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_performance_timer ENABLE ROW LEVEL SECURITY;

-- Create policies for the new tables (adjust as needed for your security model)
CREATE POLICY "Allow public read access" ON mai_show_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON mai_stage_slots FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON mai_queue FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON mai_performance_timer FOR SELECT USING (true);

CREATE POLICY "Allow authorized users to insert" ON mai_show_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized users to insert" ON mai_stage_slots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized users to insert" ON mai_queue FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized users to insert" ON mai_performance_timer FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow host to update" ON mai_show_sessions FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Allow authorized users to update" ON mai_stage_slots FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized users to update" ON mai_queue FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized users to update" ON mai_performance_timer FOR UPDATE USING (auth.role() = 'authenticated');
