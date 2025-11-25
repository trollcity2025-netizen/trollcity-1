-- Recreate family system tables
CREATE TABLE IF NOT EXISTS families (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    founder_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    total_coins INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('founder', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    coins_contributed INTEGER DEFAULT 0,
    UNIQUE(family_id, user_id)
);

CREATE TABLE IF NOT EXISTS family_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_coins INTEGER DEFAULT 0,
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS family_lounge_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_lounge_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for families table
CREATE POLICY "Anyone can view families" ON families FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create families" ON families FOR INSERT WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "Founders can update their families" ON families FOR UPDATE USING (auth.uid() = founder_id);
CREATE POLICY "Founders can delete their families" ON families FOR DELETE USING (auth.uid() = founder_id);

-- Create policies for family_members table
CREATE POLICY "Anyone can view family members" ON family_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join families" ON family_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Founders can manage members" ON family_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM families 
        WHERE families.id = family_members.family_id 
        AND families.founder_id = auth.uid()
    )
);
CREATE POLICY "Users can leave families" ON family_members FOR DELETE USING (auth.uid() = user_id);

-- Create policies for family_tasks table
CREATE POLICY "Family members can view tasks" ON family_tasks FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_members.family_id = family_tasks.family_id 
        AND family_members.user_id = auth.uid()
    )
);
CREATE POLICY "Family admins can create tasks" ON family_tasks FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_members.family_id = family_tasks.family_id 
        AND family_members.user_id = auth.uid()
        AND family_members.role IN ('founder', 'admin')
    )
);
CREATE POLICY "Assigned users can update task status" ON family_tasks FOR UPDATE USING (
    auth.uid() = assigned_to OR
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_members.family_id = family_tasks.family_id 
        AND family_members.user_id = auth.uid()
        AND family_members.role IN ('founder', 'admin')
    )
);

-- Create policies for family_lounge_messages table
CREATE POLICY "Family members can view messages" ON family_lounge_messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_members.family_id = family_lounge_messages.family_id 
        AND family_members.user_id = auth.uid()
    )
);
CREATE POLICY "Family members can send messages" ON family_lounge_messages FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_members.family_id = family_lounge_messages.family_id 
        AND family_members.user_id = auth.uid()
    )
);

-- Grant permissions
GRANT SELECT ON families TO anon, authenticated;
GRANT INSERT ON families TO authenticated;
GRANT UPDATE ON families TO authenticated;
GRANT DELETE ON families TO authenticated;

GRANT SELECT ON family_members TO anon, authenticated;
GRANT INSERT ON family_members TO authenticated;
GRANT UPDATE ON family_members TO authenticated;
GRANT DELETE ON family_members TO authenticated;

GRANT SELECT ON family_tasks TO anon, authenticated;
GRANT INSERT ON family_tasks TO authenticated;
GRANT UPDATE ON family_tasks TO authenticated;

GRANT SELECT ON family_lounge_messages TO anon, authenticated;
GRANT INSERT ON family_lounge_messages TO authenticated;