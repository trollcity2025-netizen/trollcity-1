-- ==========================================
-- TROLL CITY GOVERNMENT SYSTEM
-- Complete Government Migration
-- ==========================================

-- 1. LAWS TABLE (Legislation System)
CREATE TABLE IF NOT EXISTS public.government_laws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    effect_type TEXT NOT NULL DEFAULT 'none',
    effect_value JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voting', 'active', 'expired', 'rejected')),
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    required_votes INTEGER DEFAULT 10,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    is_emergency BOOLEAN DEFAULT FALSE,
    overridden_by UUID REFERENCES public.user_profiles(id),
    overridden_at TIMESTAMPTZ,
    overridden_reason TEXT
);

-- Index for law status queries
CREATE INDEX IF NOT EXISTS idx_government_laws_status ON public.government_laws(status);
CREATE INDEX IF NOT EXISTS idx_government_laws_category ON public.government_laws(category);

-- 2. LAW VOTES TABLE
CREATE TABLE IF NOT EXISTS public.law_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    law_id UUID NOT NULL REFERENCES public.government_laws(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    weight INTEGER DEFAULT 1,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(law_id, user_id)
);

-- Index for vote queries
CREATE INDEX IF NOT EXISTS idx_law_votes_law ON public.law_votes(law_id);
CREATE INDEX IF NOT EXISTS idx_law_votes_user ON public.law_votes(user_id);

-- 3. EXTEND FAMILIES FOR POLITICAL PARTIES
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS is_political_party BOOLEAN DEFAULT FALSE;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS party_leader_id UUID REFERENCES public.user_profiles(id);
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS party_ideology TEXT;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS party_established_at TIMESTAMPTZ;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS party_membership_count INTEGER DEFAULT 0;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS party_treasury BIGINT DEFAULT 0;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS election_wins INTEGER DEFAULT 0;

-- 4. CANDIDATE PARTY AFFILIATIONS
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.families(id);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_candidate BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS campaign_slogan TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS campaign_started_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS campaign_ended_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS election_votes INTEGER DEFAULT 0;

-- 5. BRIBE LOGS (Corruption System)
CREATE TABLE IF NOT EXISTS public.bribe_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briber_id UUID NOT NULL REFERENCES public.user_profiles(id),
    bribee_id UUID REFERENCES public.user_profiles(id),
    amount BIGINT NOT NULL,
    purpose TEXT,
    is_exposed BOOLEAN DEFAULT FALSE,
    exposed_at TIMESTAMPTZ,
    exposed_by UUID REFERENCES public.user_profiles(id),
    exposure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'secret' CHECK (status IN ('secret', 'exposed', 'investigated'))
);

-- Index for bribe queries
CREATE INDEX IF NOT EXISTS idx_bribe_logs_briber ON public.bribe_logs(briber_id);
CREATE INDEX IF NOT EXISTS idx_bribe_logs_bribee ON public.bribe_logs(bribee_id);
CREATE INDEX IF NOT EXISTS idx_bribe_logs_exposed ON public.bribe_logs(is_exposed);

-- 6. PROTESTS TABLE
CREATE TABLE IF NOT EXISTS public.protests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    organizer_id UUID NOT NULL REFERENCES public.user_profiles(id),
    target_law_id UUID REFERENCES public.government_laws(id),
    intensity INTEGER DEFAULT 1 CHECK (intensity BETWEEN 1 AND 10),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'growing', 'crisis', 'resolved', 'dispersed')),
    participant_count INTEGER DEFAULT 1,
    max_participants INTEGER DEFAULT 100,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    effect_on_law DOUBLE PRECISION DEFAULT 0,
    effect_on_reputation DOUBLE PRECISION DEFAULT 0,
    location TEXT
);

-- Index for protest queries
CREATE INDEX IF NOT EXISTS idx_protests_status ON public.protests(status);
CREATE INDEX IF NOT EXISTS idx_protests_intensity ON public.protests(intensity);

-- 7. PROTEST PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.protest_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protest_id UUID NOT NULL REFERENCES public.protests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    contribution INTEGER DEFAULT 1,
    UNIQUE(protest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_protest_participants_protest ON public.protest_participants(protest_id);

-- 8. EMERGENCY POWERS LOG
CREATE TABLE IF NOT EXISTS public.emergency_powers_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    president_id UUID NOT NULL REFERENCES public.user_profiles(id),
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES public.user_profiles(id),
    target_law_id UUID REFERENCES public.government_laws(id),
    target_protest_id UUID REFERENCES public.protests(id),
    reason TEXT,
    backlash_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cooldown_ends_at TIMESTAMPTZ,
    CHECK (action_type IN ('override_vote', 'force_law', 'end_protest', 'jail_user', 'emergency_declaration'))
);

CREATE INDEX IF NOT EXISTS idx_emergency_powers_president ON public.emergency_powers_log(president_id);
CREATE INDEX IF NOT EXISTS idx_emergency_powers_created ON public.emergency_powers_log(created_at);

-- 9. GOVERNMENT REPUTATION SYSTEM
CREATE TABLE IF NOT EXISTS public.government_reputation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) UNIQUE,
    government_trust DOUBLE PRECISION DEFAULT 50.0 CHECK (government_trust BETWEEN 0 AND 100),
    player_influence DOUBLE PRECISION DEFAULT 0 CHECK (player_influence >= 0),
    party_reputation DOUBLE PRECISION DEFAULT 50.0 CHECK (party_reputation BETWEEN 0 AND 100),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_government_reputation_user ON public.government_reputation(user_id);

-- 10. CITY REPUTATION (Overall government stats)
CREATE TABLE IF NOT EXISTS public.city_reputation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_laws_passed INTEGER DEFAULT 0,
    active_laws INTEGER DEFAULT 0,
    average_trust DOUBLE PRECISION DEFAULT 50.0,
    protest_count INTEGER DEFAULT 0,
    corruption_exposed_count INTEGER DEFAULT 0,
    emergency_declarations INTEGER DEFAULT 0,
    last_election_date TIMESTAMPTZ,
    election_participation_rate DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize city reputation if not exists
INSERT INTO public.city_reputation (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 11. GOVERNMENT HISTORY (Audit Log)
CREATE TABLE IF NOT EXISTS public.government_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES public.user_profiles(id),
    target_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_government_history_type ON public.government_history(event_type);
CREATE INDEX IF NOT EXISTS idx_government_history_created ON public.government_history(created_at);

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Government Laws RLS
ALTER TABLE public.government_laws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active laws" ON public.government_laws FOR SELECT
    USING (status IN ('active', 'voting'));

CREATE POLICY "Staff can manage laws" ON public.government_laws FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'secretary', 'president') OR is_admin = true OR role = 'lead_troll_officer')
    ));

-- Law Votes RLS
ALTER TABLE public.law_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view law votes" ON public.law_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.law_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" ON public.law_votes FOR UPDATE
    USING (auth.uid() = user_id);

-- Families (Political Parties) RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view political parties" ON public.families FOR SELECT
    USING (is_political_party = true);

CREATE POLICY "Party leaders can update party" ON public.families FOR UPDATE
    USING (
        auth.uid() = leader_id 
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR is_admin = true OR role = 'president')
        )
    );

-- Bribe Logs RLS
ALTER TABLE public.bribe_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bribes" ON public.bribe_logs FOR SELECT
    USING (briber_id = auth.uid());

CREATE POLICY "Staff can view all bribes" ON public.bribe_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'secretary', 'president', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
    ));

CREATE POLICY "Users can log bribes" ON public.bribe_logs FOR INSERT
    WITH CHECK (briber_id = auth.uid());

-- Protests RLS
ALTER TABLE public.protests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view protests" ON public.protests FOR SELECT USING (true);

CREATE POLICY "Users can create protests" ON public.protests FOR INSERT
    WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Participants can update protests" ON public.protests FOR UPDATE
    USING (
        organizer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'president', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
        )
    );

-- Protest Participants RLS
ALTER TABLE public.protest_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view protest participants" ON public.protest_participants FOR SELECT USING (true);

CREATE POLICY "Users can join protests" ON public.protest_participants FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Emergency Powers Log RLS
ALTER TABLE public.emergency_powers_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view emergency powers log" ON public.emergency_powers_log FOR SELECT USING (true);

CREATE POLICY "Presidents can log emergency actions" ON public.emergency_powers_log FOR INSERT
    WITH CHECK (
        president_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Government Reputation RLS
ALTER TABLE public.government_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reputation" ON public.government_reputation FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Anyone can view public reputation" ON public.government_reputation FOR SELECT
    USING (true);

CREATE POLICY "Users can update own reputation" ON public.government_reputation FOR UPDATE
    USING (user_id = auth.uid());

-- City Reputation RLS
ALTER TABLE public.city_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view city reputation" ON public.city_reputation FOR SELECT USING (true);

CREATE POLICY "Staff can update city reputation" ON public.city_reputation FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'president', 'secretary') OR is_admin = true)
    ));

-- Government History RLS
ALTER TABLE public.government_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view government history" ON public.government_history FOR SELECT USING (true);

CREATE POLICY "Staff can log history" ON public.government_history FOR INSERT
    WITH CHECK (TRUE);

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Function to calculate vote weight based on user stats
CREATE OR REPLACE FUNCTION public.get_vote_weight(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_weight INTEGER := 1;
    v_profile RECORD;
    v_reputation RECORD;
BEGIN
    SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id;
    SELECT * INTO v_reputation FROM public.government_reputation WHERE user_id = p_user_id;
    
    -- Base weight from role
    IF v_profile.role = 'admin' OR v_profile.is_admin = true THEN
        v_weight := v_weight + 10;
    ELSIF v_profile.role = 'president' THEN
        v_weight := v_weight + 8;
    ELSIF v_profile.role = 'secretary' OR v_profile.is_lead_officer = true THEN
        v_weight := v_weight + 5;
    ELSIF v_profile.is_troll_officer = true THEN
        v_weight := v_weight + 3;
    END IF;
    
    -- Reputation bonus
    IF v_reputation.player_influence > 100 THEN
        v_weight := v_weight + 2;
    ELSIF v_reputation.player_influence > 50 THEN
        v_weight := v_weight + 1;
    END IF;
    
    -- Level bonus
    IF v_profile.level >= 50 THEN
        v_weight := v_weight + 3;
    ELSIF v_profile.level >= 25 THEN
        v_weight := v_weight + 2;
    ELSIF v_profile.level >= 10 THEN
        v_weight := v_weight + 1;
    END IF;
    
    RETURN v_weight;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log government action
CREATE OR REPLACE FUNCTION public.log_government_action(
    p_event_type TEXT,
    p_actor_id UUID,
    p_target_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.government_history (event_type, actor_id, target_id, description, event_data)
    VALUES (p_event_type, p_actor_id, p_target_id, p_description, p_event_data);
END;
$$ LANGUAGE plpgsql;

-- Function to update law status based on votes
CREATE OR REPLACE FUNCTION public.check_law_votes(p_law_id UUID)
RETURNS void AS $$
DECLARE
    v_law RECORD;
    v_required INTEGER;
    v_total_votes INTEGER;
BEGIN
    SELECT * INTO v_law FROM public.government_laws WHERE id = p_law_id;
    
    IF v_law.status != 'voting' THEN
        RETURN;
    END IF;
    
    -- Check if voting period has ended
    IF v_law.voting_ends_at < NOW() THEN
        v_required := v_law.required_votes;
        v_total_votes := v_law.yes_votes + v_law.no_votes;
        
        IF v_law.yes_votes > v_law.no_votes AND v_total_votes >= v_required THEN
            UPDATE public.government_laws 
            SET status = 'active', activated_at = NOW()
            WHERE id = p_law_id;
            
            -- Log the law activation
            PERFORM public.log_government_action(
                'law_passed',
                v_law.created_by,
                p_law_id,
                'Law passed: ' || v_law.title
            );
        ELSE
            UPDATE public.government_laws 
            SET status = 'rejected'
            WHERE id = p_law_id;
            
            PERFORM public.log_government_action(
                'law_rejected',
                v_law.created_by,
                p_law_id,
                'Law rejected: ' || v_law.title
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to expose a bribe
CREATE OR REPLACE FUNCTION public.expose_bribe(p_bribe_id UUID, p_exposed_by UUID, p_reason TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.bribe_logs 
    SET is_exposed = true, 
        exposed_at = NOW(), 
        exposed_by = p_exposed_by,
        exposure_reason = p_reason,
        status = 'exposed'
    WHERE id = p_bribe_id;
    
    -- Reduce briber reputation
    UPDATE public.government_reputation
    SET government_trust = GREATEST(0, government_trust - 20),
        player_influence = GREATEST(0, player_influence - 10)
    WHERE user_id = (SELECT briber_id FROM public.bribe_logs WHERE id = p_bribe_id);
    
    -- Log the exposure
    PERFORM public.log_government_action(
        'bribe_exposed',
        p_exposed_by,
        p_bribe_id,
        'Bribe exposed: ' || p_reason
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate protest effect
CREATE OR REPLACE FUNCTION public.calculate_protest_effect(p_protest_id UUID)
RETURNS void AS $$
DECLARE
    v_protest RECORD;
    v_effect DOUBLE PRECISION;
BEGIN
    SELECT * INTO v_protest FROM public.protests WHERE id = p_protest_id;
    
    -- Effect increases with intensity and participant count
    v_effect := (v_protest.intensity * v_protest.participant_count) / 100.0;
    
    UPDATE public.protests 
    SET effect_on_reputation = v_effect
    WHERE id = p_protest_id;
    
    -- If target law exists, reduce its effectiveness
    IF v_protest.target_law_id IS NOT NULL THEN
        UPDATE public.government_laws
        SET effect_value = effect_value - (v_effect / 10)
        WHERE id = v_protest.target_law_id;
    END IF;
    
    -- Update city reputation
    UPDATE public.city_reputation
    SET protest_count = protest_count + 1,
        average_trust = GREATEST(0, average_trust - v_effect)
    WHERE true;
END;
$$ LANGUAGE plpgsql;

-- Function for emergency power cooldown check
CREATE OR REPLACE FUNCTION public.check_emergency_cooldown(p_president_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_action RECORD;
    v_cooldown_minutes INTEGER := 60;
BEGIN
    SELECT * INTO v_last_action 
    FROM public.emergency_powers_log 
    WHERE president_id = p_president_id 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    
    IF v_last_action.created_at + (v_cooldown_minutes || ' minutes')::interval > NOW() THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to update city reputation
CREATE OR REPLACE FUNCTION public.update_city_reputation()
RETURNS void AS $$
DECLARE
    v_avg_trust DOUBLE PRECISION;
    v_active_laws INTEGER;
BEGIN
    SELECT AVG(government_trust), COUNT(*)
    INTO v_avg_trust, v_active_laws
    FROM public.government_reputation;
    
    UPDATE public.city_reputation
    SET average_trust = COALESCE(v_avg_trust, 50),
        active_laws = v_active_laws,
        updated_at = NOW()
    WHERE true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger to update law vote counts
CREATE OR REPLACE FUNCTION public.update_law_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote = 'yes' THEN
            UPDATE public.government_laws SET yes_votes = yes_votes + NEW.weight WHERE id = NEW.law_id;
        ELSIF NEW.vote = 'no' THEN
            UPDATE public.government_laws SET no_votes = no_votes + NEW.weight WHERE id = NEW.law_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Remove old vote
        IF OLD.vote = 'yes' THEN
            UPDATE public.government_laws SET yes_votes = yes_votes - OLD.weight WHERE id = OLD.law_id;
        ELSIF OLD.vote = 'no' THEN
            UPDATE public.government_laws SET no_votes = no_votes - OLD.weight WHERE id = OLD.law_id;
        END IF;
        -- Add new vote
        IF NEW.vote = 'yes' THEN
            UPDATE public.government_laws SET yes_votes = yes_votes + NEW.weight WHERE id = NEW.law_id;
        ELSIF NEW.vote = 'no' THEN
            UPDATE public.government_laws SET no_votes = no_votes + NEW.weight WHERE id = NEW.law_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote = 'yes' THEN
            UPDATE public.government_laws SET yes_votes = yes_votes - OLD.weight WHERE id = OLD.law_id;
        ELSIF OLD.vote = 'no' THEN
            UPDATE public.government_laws SET no_votes = no_votes - OLD.weight WHERE id = OLD.law_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_law_vote_counts ON public.law_votes;
CREATE TRIGGER trg_update_law_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.law_votes
    FOR EACH ROW EXECUTE FUNCTION public.update_law_vote_counts();

-- Trigger to update protest participant count
CREATE OR REPLACE FUNCTION public.update_protest_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.protests 
        SET participant_count = participant_count + 1
        WHERE id = NEW.protest_id;
        
        -- Check if protest is growing
        UPDATE public.protests
        SET status = 'growing'
        WHERE id = NEW.protest_id AND participant_count > 10 AND status = 'active';
        
        -- Check if crisis
        UPDATE public.protests
        SET status = 'crisis'
        WHERE id = NEW.protest_id AND participant_count > 50 AND status = 'growing';
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.protests 
        SET participant_count = participant_count - 1
        WHERE id = OLD.protest_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_protest_count ON public.protest_participants;
CREATE TRIGGER trg_update_protest_count
    AFTER INSERT OR DELETE ON public.protest_participants
    FOR EACH ROW EXECUTE FUNCTION public.update_protest_count();

-- Trigger to create government reputation for new users
CREATE OR REPLACE FUNCTION public.create_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.government_reputation (user_id, government_trust, player_influence, party_reputation)
    VALUES (NEW.id, 50.0, 0, 50.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_user_reputation ON public.user_profiles;
CREATE TRIGGER trg_create_user_reputation
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_user_reputation();

-- ==========================================
-- SEED DATA
-- ==========================================

-- Insert default city reputation
INSERT INTO public.city_reputation (id, average_trust)
VALUES (gen_random_uuid(), 50.0)
ON CONFLICT DO NOTHING;

-- Add government reputation for existing users (batch)
INSERT INTO public.government_reputation (user_id, government_trust, player_influence, party_reputation)
SELECT id, 50.0, 0, 50.0
FROM public.user_profiles
WHERE NOT EXISTS (SELECT 1 FROM public.government_reputation WHERE user_id = public.user_profiles.id)
ON CONFLICT DO NOTHING;

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE public.government_laws IS 'Stores city laws and legislation';
COMMENT ON TABLE public.law_votes IS 'Tracks votes on laws';
COMMENT ON TABLE public.bribe_logs IS 'Tracks bribery/corruption incidents';
COMMENT ON TABLE public.protests IS 'Stores protest events';
COMMENT ON TABLE public.protest_participants IS 'Links users to protests';
COMMENT ON TABLE public.emergency_powers_log IS 'Logs presidential emergency actions';
COMMENT ON TABLE public.government_reputation IS 'Tracks user reputation in government';
COMMENT ON TABLE public.city_reputation IS 'Overall city government statistics';
COMMENT ON TABLE public.government_history IS 'Audit log for government actions';

COMMENT ON COLUMN public.government_laws.effect_type IS 'Type of effect: xp_boost, coin_tax, marketplace_fee, family_bonus, etc';
COMMENT ON COLUMN public.government_laws.effect_value IS 'JSON object with effect parameters';
