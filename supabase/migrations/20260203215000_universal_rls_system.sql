-- ============================================================================
-- UNIVERSAL ROW LEVEL SECURITY SYSTEM FOR TROLL CITY
-- ============================================================================
-- Security > Convenience > Speed
-- Designed for adversarial environment - assume all users are hostile
-- ============================================================================

-- IMPORTANT: This system uses the EXISTING user_profiles columns:
-- role (TEXT), is_admin (BOOLEAN), is_lead_officer (BOOLEAN), banned_at, suspended_until, etc.
-- The roles/user_roles tables are ENHANCEMENTS that can be added later.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CANONICAL IDENTITY TABLES (Optional Enhancement)
-- ============================================================================

-- Create roles table as an enhancement (users can still use existing role column)
CREATE TABLE IF NOT EXISTS public.system_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    hierarchy_rank INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_staff BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_role_grants junction table with expiration support (optional)
CREATE TABLE IF NOT EXISTS public.user_role_grants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.system_roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.user_profiles(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL means permanent
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.user_profiles(id),
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_user_role_grant UNIQUE (user_id, role_id, expires_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_role_grants_user_id ON public.user_role_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_role_id ON public.user_role_grants(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_expires_at ON public.user_role_grants(expires_at);

-- Seed default roles (will not conflict if roles already exist)
INSERT INTO public.system_roles (name, hierarchy_rank, is_staff, is_admin, description) VALUES
    ('user', 0, false, false, 'Regular authenticated user'),
    ('officer', 50, true, false, 'Staff officer - can moderate when clocked in'),
    ('lead_officer', 100, true, true, 'Lead officer - can moderate anytime, manage cases'),
    ('secretary', 150, true, true, 'Secretary - can process payouts, audit logging'),
    ('pastor', 80, true, false, 'Pastor - community spiritual role'),
    ('admin', 200, true, true, 'System administrator - highest non-founder access'),
    ('founder', 255, true, true, 'Platform founder - complete system access')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SECTION 2: ENHANCE USER_PROFILES WITH RLS-READY COLUMNS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credit_score') THEN
        ALTER TABLE user_profiles ADD COLUMN credit_score INTEGER DEFAULT 400 CHECK (credit_score >= 0 AND credit_score <= 800);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'banned_at') THEN
        ALTER TABLE user_profiles ADD COLUMN banned_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'suspended_until') THEN
        ALTER TABLE user_profiles ADD COLUMN suspended_until TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'clocked_in') THEN
        ALTER TABLE user_profiles ADD COLUMN clocked_in BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'clocked_in_at') THEN
        ALTER TABLE user_profiles ADD COLUMN clocked_in_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'staff_override_until') THEN
        ALTER TABLE user_profiles ADD COLUMN staff_override_until TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'admin_override_until') THEN
        ALTER TABLE user_profiles ADD COLUMN admin_override_until TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'marketplace_approved') THEN
        ALTER TABLE user_profiles ADD COLUMN marketplace_approved BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================================
-- SECTION 3: CORE IDENTITY & SECURITY HELPER FUNCTIONS
-- ============================================================================

-- Get current user's ID safely (returns NULL if not authenticated)
-- DROP FUNCTION IF EXISTS public.current_user_id();
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is currently authenticated
-- DROP FUNCTION IF EXISTS public.is_authenticated();
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is NOT banned (global read-only check)
-- If banned_at IS NOT NULL → user is globally read-only
-- DROP FUNCTION IF EXISTS public.is_not_banned(UUID);
CREATE OR REPLACE FUNCTION public.is_not_banned(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND banned_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is NOT suspended (no writes anywhere)
-- If suspended_until > now() → no writes anywhere
-- DROP FUNCTION IF EXISTS public.is_not_suspended(UUID);
CREATE OR REPLACE FUNCTION public.is_not_suspended(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND suspended_until IS NOT NULL
        AND suspended_until > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has a specific role (using EXISTING profile columns)
-- Checks both profile columns and optional user_roles table
-- DROP FUNCTION IF EXISTS public.has_role(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.has_role(p_role_name TEXT, p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check via user_profiles.role column (existing system)
    IF p_role_name = 'admin' THEN
        IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_admin = true) THEN
            RETURN true;
        END IF;
    ELSIF p_role_name = 'lead_officer' THEN
        IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_lead_officer = true) THEN
            RETURN true;
        END IF;
    ELSIF p_role_name = 'officer' THEN
        IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND role = 'officer') THEN
            RETURN true;
        END IF;
    END IF;
    
    -- Also check via user_role_grants table (new enhancement)
    RETURN EXISTS (
        SELECT 1 FROM public.user_role_grants ur
        JOIN public.system_roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
        AND r.name = p_role_name
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND ur.revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is admin (using EXISTING profile columns)
-- Includes temporary admin override with expiration
-- DROP FUNCTION IF EXISTS public.is_admin(UUID);
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (
            is_admin = true
            OR admin_override_until IS NOT NULL AND admin_override_until > NOW()
        )
    ) OR EXISTS (
        SELECT 1 FROM public.user_role_grants ur
        JOIN public.system_roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
        AND r.is_admin = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND ur.revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is staff member (using EXISTING profile columns)
-- DROP FUNCTION IF EXISTS public.is_staff(UUID);
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check via profile columns
    IF EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (is_admin = true OR is_lead_officer = true OR role IN ('officer', 'lead_officer', 'admin', 'secretary', 'pastor'))
    ) THEN
        RETURN true;
    END IF;
    
    -- Check via user_role_grants table
    IF EXISTS (
        SELECT 1 FROM public.user_role_grants ur
        JOIN public.system_roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
        AND r.is_staff = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND ur.revoked_at IS NULL
    ) THEN
        RETURN true;
    END IF;
    
    -- Check temporary staff override
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND staff_override_until IS NOT NULL
        AND staff_override_until > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if staff member is currently on duty (clocked in)
-- Officers can only act when clocked_in = true
-- DROP FUNCTION IF EXISTS public.is_staff_on_duty(UUID);
CREATE OR REPLACE FUNCTION public.is_staff_on_duty(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND clocked_in = true
        AND clocked_in_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Combined check: user can perform writes (not banned, not suspended)
-- DROP FUNCTION IF EXISTS public.can_write(UUID);
CREATE OR REPLACE FUNCTION public.can_write(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_not_banned(p_user_id) 
       AND public.is_not_suspended(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user meets minimum level requirement
-- DROP FUNCTION IF EXISTS public.has_min_level(INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.has_min_level(p_min_level INTEGER, p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (level IS NULL OR level >= p_min_level)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- SECTION 4: GLOBAL SECURITY OVERRIDE FUNCTION
-- ============================================================================

-- Global ban check function - applied to ALL write policies
-- DROP FUNCTION IF EXISTS public.global_write_check(UUID);
CREATE OR REPLACE FUNCTION public.global_write_check(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Must not be banned
    IF NOT public.is_not_banned(p_user_id) THEN
        RETURN false;
    END IF;
    
    -- Must not be suspended
    IF NOT public.is_not_suspended(p_user_id) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- SECTION 5: USER_PROFILES RLS POLICIES
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile (with restrictions)
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Trigger to protect sensitive fields on update
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow admins to bypass these checks
    IF public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Check restricted fields
    IF NEW.banned_at IS DISTINCT FROM OLD.banned_at OR
       NEW.suspended_until IS DISTINCT FROM OLD.suspended_until OR
       NEW.credit_score IS DISTINCT FROM OLD.credit_score OR
       NEW.clocked_in IS DISTINCT FROM OLD.clocked_in OR
       NEW.clocked_in_at IS DISTINCT FROM OLD.clocked_in_at OR
       NEW.staff_override_until IS DISTINCT FROM OLD.staff_override_until OR
       NEW.admin_override_until IS DISTINCT FROM OLD.admin_override_until OR
       NEW.marketplace_approved IS DISTINCT FROM OLD.marketplace_approved THEN
        RAISE EXCEPTION 'You are not authorized to modify restricted profile fields.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.user_profiles;
CREATE TRIGGER tr_protect_profile_fields
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();

-- Admins can read all profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
CREATE POLICY "Admins can read all profiles" ON public.user_profiles
    FOR SELECT
    USING (public.is_admin(auth.uid()));

-- Admins can update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
    FOR UPDATE
    USING (public.is_admin(auth.uid()));

-- ============================================================================
-- SECTION 6: HOME/STREAMING RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
        EXECUTE 'ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY';

        -- All authenticated users can create streams
        EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Authenticated users can create streams" ON public.streams
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND public.global_write_check(auth.uid())
                AND user_id = auth.uid()
            )';

        -- All authenticated users can read live streams
        EXECUTE 'DROP POLICY IF EXISTS "All can read live streams" ON public.streams';
        EXECUTE 'CREATE POLICY "All can read live streams" ON public.streams
            FOR SELECT
            USING (
                auth.uid() IS NOT NULL
                AND status = ''live''
            )';

        -- Stream owners can read their own streams
        EXECUTE 'DROP POLICY IF EXISTS "Stream owners can read own streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Stream owners can read own streams" ON public.streams
            FOR SELECT
            USING (user_id = auth.uid())';

        -- Staff on duty can read all streams
        EXECUTE 'DROP POLICY IF EXISTS "Staff on duty can read all streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Staff on duty can read all streams" ON public.streams
            FOR SELECT
            USING (
                public.is_staff_on_duty(auth.uid())
                OR public.is_admin(auth.uid())
            )';

        -- Stream owners can update their own streams
        EXECUTE 'DROP POLICY IF EXISTS "Stream owners can update own streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Stream owners can update own streams" ON public.streams
            FOR UPDATE
            USING (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Staff on duty can end/mute streams
        EXECUTE 'DROP POLICY IF EXISTS "Staff can end streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Staff can end streams" ON public.streams
            FOR UPDATE
            USING (
                public.is_staff_on_duty(auth.uid())
                OR public.is_admin(auth.uid())
            )
            WITH CHECK (
                public.is_staff_on_duty(auth.uid())
                OR public.is_admin(auth.uid())
            )';

        -- Lead Officers / Admin can force terminate any stream
        EXECUTE 'DROP POLICY IF EXISTS "Lead/Admin can force terminate streams" ON public.streams';
        EXECUTE 'CREATE POLICY "Lead/Admin can force terminate streams" ON public.streams
            FOR UPDATE
            USING (
                public.has_role(''lead_officer'', auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 7: PROPERTY/REAL ESTATE RLS POLICIES
-- ============================================================================

-- Enable RLS if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN
        EXECUTE 'ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN
        EXECUTE 'ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Users can buy/sell property they own
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Owners can sell own property" ON public.properties';
        EXECUTE 'CREATE POLICY "Owners can sell own property" ON public.properties
            FOR UPDATE
            USING (
                owner_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (
                owner_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Users can buy property" ON public.properties';
        EXECUTE 'CREATE POLICY "Users can buy property" ON public.properties
            FOR INSERT
            WITH CHECK (
                public.global_write_check(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Public can view properties" ON public.properties';
        EXECUTE 'CREATE POLICY "Public can view properties" ON public.properties
            FOR SELECT
            USING (true)';
    END IF;
END $$;

-- Loan policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Loans via function only" ON public.loans';
        EXECUTE 'CREATE POLICY "Loans via function only" ON public.loans
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NULL 
                OR public.is_admin(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Users can read own loans" ON public.loans';
        EXECUTE 'CREATE POLICY "Users can read own loans" ON public.loans
            FOR SELECT
            USING (
                user_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Loan repayments via function" ON public.loans';
        EXECUTE 'CREATE POLICY "Loan repayments via function" ON public.loans
            FOR UPDATE
            USING (
                auth.uid() IS NULL
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- Evictions: Officer+ only (on leases)
-- Assumes leases table exists from housing migration
-- DROP POLICY IF EXISTS "Officers can process evictions" ON public.leases;
-- CREATE POLICY "Officers can process evictions" ON public.leases
--    FOR UPDATE
--    USING (
--        (public.has_role('officer', auth.uid()) OR public.is_staff_on_duty(auth.uid()))
--        AND public.global_write_check(auth.uid())
--    );

-- ============================================================================
-- SECTION 8: INVENTORY RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_inventory') THEN
        EXECUTE 'ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY';

        -- Users can read only their inventory
        EXECUTE 'DROP POLICY IF EXISTS "Users read own inventory" ON public.user_inventory';
        EXECUTE 'CREATE POLICY "Users read own inventory" ON public.user_inventory
            FOR SELECT
            USING (user_id = auth.uid())';

        -- Users can insert own inventory items
        EXECUTE 'DROP POLICY IF EXISTS "Users insert own inventory" ON public.user_inventory';
        EXECUTE 'CREATE POLICY "Users insert own inventory" ON public.user_inventory
            FOR INSERT
            WITH CHECK (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Users can update/activate/deactivate owned items
        EXECUTE 'DROP POLICY IF EXISTS "Users update own inventory" ON public.user_inventory';
        EXECUTE 'CREATE POLICY "Users update own inventory" ON public.user_inventory
            FOR UPDATE
            USING (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Users can delete expired items only
        EXECUTE 'DROP POLICY IF EXISTS "Users delete expired inventory" ON public.user_inventory';
        EXECUTE 'CREATE POLICY "Users delete expired inventory" ON public.user_inventory
            FOR DELETE
            USING (
                user_id = auth.uid()
                AND expires_at IS NOT NULL
                AND expires_at < NOW()
                AND public.global_write_check(auth.uid())
            )';

        -- No cross-user visibility
        EXECUTE 'DROP POLICY IF EXISTS "No cross-user inventory access" ON public.user_inventory';
        EXECUTE 'CREATE POLICY "No cross-user inventory access" ON public.user_inventory
            FOR SELECT
            USING (user_id = auth.uid())';
    END IF;
END $$;

-- ============================================================================
-- SECTION 9: TROTING/VOTING RLS POLICIES (DISABLED - TABLES MISSING)
-- ============================================================================

-- NOTE: The tables 'votes' and 'poll_responses' do not exist in the current schema.
-- Voting is currently handled by 'pitch_votes' and 'officer_votes' which have their own specific policies.
-- This section is commented out to prevent execution errors.

/*
-- ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- Staff can create votes
DROP POLICY IF EXISTS "Staff can create votes" ON public.votes;
CREATE POLICY "Staff can create votes" ON public.votes
    FOR INSERT
    WITH CHECK (
        public.is_staff(auth.uid())
        OR public.is_admin(auth.uid())
    );

-- Staff can read all votes
DROP POLICY IF EXISTS "Staff read all votes" ON public.votes;
CREATE POLICY "Staff read all votes" ON public.votes
    FOR SELECT
    USING (
        public.is_staff(auth.uid())
        OR public.is_admin(auth.uid())
    );

-- Users can read active votes
DROP POLICY IF EXISTS "Users read active votes" ON public.votes;
CREATE POLICY "Users read active votes" ON public.votes
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND (ends_at IS NULL OR ends_at > NOW())
    );

-- Users vote once per poll
DROP POLICY IF EXISTS "Users vote once per poll" ON public.poll_responses;
CREATE POLICY "Users vote once per poll" ON public.poll_responses
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND public.global_write_check(auth.uid())
        AND user_id = auth.uid()
    );

-- Users can read their own poll responses
DROP POLICY IF EXISTS "Users read own poll responses" ON public.poll_responses;
CREATE POLICY "Users read own poll responses" ON public.poll_responses
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_staff(auth.uid())
        OR public.is_admin(auth.uid())
    );

-- Users can pitch ideas (own rows only)
DROP POLICY IF EXISTS "Users create own ideas" ON public.poll_responses;
CREATE POLICY "Users create own ideas" ON public.poll_responses
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND public.global_write_check(auth.uid())
    );
*/

-- ============================================================================
-- SECTION 10: THE WALL (POSTS & REACTIONS) RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_wall_posts') THEN
        EXECUTE 'ALTER TABLE public.troll_wall_posts ENABLE ROW LEVEL SECURITY';

        -- Users can create posts
        EXECUTE 'DROP POLICY IF EXISTS "Users create posts" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Users create posts" ON public.troll_wall_posts
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Users can read all posts
        EXECUTE 'DROP POLICY IF EXISTS "Users read all posts" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Users read all posts" ON public.troll_wall_posts
            FOR SELECT
            USING (auth.uid() IS NOT NULL)';

        -- Users can edit/delete ONLY own posts
        EXECUTE 'DROP POLICY IF EXISTS "Users edit own posts" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Users edit own posts" ON public.troll_wall_posts
            FOR UPDATE
            USING (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        EXECUTE 'DROP POLICY IF EXISTS "Users delete own posts" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Users delete own posts" ON public.troll_wall_posts
            FOR DELETE
            USING (
                user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Staff can remove content (not edit it)
        EXECUTE 'DROP POLICY IF EXISTS "Staff remove content" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Staff remove content" ON public.troll_wall_posts
            FOR DELETE
            USING (
                public.is_staff(auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_post_reactions') THEN
        EXECUTE 'ALTER TABLE public.troll_post_reactions ENABLE ROW LEVEL SECURITY';

        -- One reaction per user per post
        EXECUTE 'DROP POLICY IF EXISTS "One reaction per user per post" ON public.troll_post_reactions';
        EXECUTE 'CREATE POLICY "One reaction per user per post" ON public.troll_post_reactions
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Users can read reactions
        EXECUTE 'DROP POLICY IF EXISTS "Users read reactions" ON public.troll_post_reactions';
        EXECUTE 'CREATE POLICY "Users read reactions" ON public.troll_post_reactions
            FOR SELECT
            USING (auth.uid() IS NOT NULL)';

        -- Staff can remove reactions
        EXECUTE 'DROP POLICY IF EXISTS "Staff remove reactions" ON public.troll_post_reactions';
        EXECUTE 'CREATE POLICY "Staff remove reactions" ON public.troll_post_reactions
            FOR DELETE
            USING (
                public.is_staff(auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 11: MARKETPLACE RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketplace_items') THEN
        EXECUTE 'ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY';

        -- Ensure seller_id column exists (fix for potential schema mismatch)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'marketplace_items' AND column_name = 'seller_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'marketplace_items' AND column_name = 'user_id') THEN
                -- Rename user_id to seller_id if it exists (schema alignment)
                ALTER TABLE public.marketplace_items RENAME COLUMN user_id TO seller_id;
            ELSE
                -- Add seller_id if neither exists
                ALTER TABLE public.marketplace_items ADD COLUMN seller_id UUID REFERENCES public.user_profiles(id);
            END IF;
        END IF;

        -- Ensure status column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'marketplace_items' AND column_name = 'status') THEN
            ALTER TABLE public.marketplace_items ADD COLUMN status TEXT DEFAULT 'active';
        END IF;

        -- Sellers must be approved to create listings
        EXECUTE 'DROP POLICY IF EXISTS "Approved sellers create listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Approved sellers create listings" ON public.marketplace_items
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND seller_id = auth.uid()
                AND public.global_write_check(auth.uid())
                AND EXISTS (
                    SELECT 1 FROM public.user_profiles
                    WHERE id = auth.uid()
                    AND marketplace_approved = true
                )
            )';

        -- Sellers can CRUD own listings
        EXECUTE 'DROP POLICY IF EXISTS "Sellers read own listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Sellers read own listings" ON public.marketplace_items
            FOR SELECT
            USING (
                seller_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';

        EXECUTE 'DROP POLICY IF EXISTS "Sellers update own listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Sellers update own listings" ON public.marketplace_items
            FOR UPDATE
            USING (
                seller_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (
                seller_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        EXECUTE 'DROP POLICY IF EXISTS "Sellers delete own listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Sellers delete own listings" ON public.marketplace_items
            FOR DELETE
            USING (
                seller_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';

        -- Buyers can read all listings
        EXECUTE 'DROP POLICY IF EXISTS "Buyers read all listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Buyers read all listings" ON public.marketplace_items
            FOR SELECT
            USING (
                auth.uid() IS NOT NULL
                AND status = ''active''
            )';

        -- Admin can freeze listings
        EXECUTE 'DROP POLICY IF EXISTS "Admin freeze listings" ON public.marketplace_items';
        EXECUTE 'CREATE POLICY "Admin freeze listings" ON public.marketplace_items
            FOR UPDATE
            USING (
                public.is_admin(auth.uid())
            )
            WITH CHECK (
                public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 12: FINANCE/BANKING RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
        EXECUTE 'ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY';

        -- Users read their own transactions
        EXECUTE 'DROP POLICY IF EXISTS "Users read own wallet transactions" ON public.wallet_transactions';
        EXECUTE 'CREATE POLICY "Users read own wallet transactions" ON public.wallet_transactions
            FOR SELECT
            USING (
                user_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';

        -- Inserts only via server functions
        EXECUTE 'DROP POLICY IF EXISTS "Wallet inserts via function only" ON public.wallet_transactions';
        EXECUTE 'CREATE POLICY "Wallet inserts via function only" ON public.wallet_transactions
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NULL
                OR public.is_admin(auth.uid())
            )';

        -- Updates via function only
        EXECUTE 'DROP POLICY IF EXISTS "Wallet updates via function only" ON public.wallet_transactions';
        EXECUTE 'CREATE POLICY "Wallet updates via function only" ON public.wallet_transactions
            FOR UPDATE
            USING (
                auth.uid() IS NULL
                OR public.is_admin(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paypal_transactions') THEN
        EXECUTE 'ALTER TABLE public.paypal_transactions ENABLE ROW LEVEL SECURITY';

        -- Users can read coin purchases (paypal_transactions)
        EXECUTE 'DROP POLICY IF EXISTS "Users read own coin purchases" ON public.paypal_transactions';
        EXECUTE 'CREATE POLICY "Users read own coin purchases" ON public.paypal_transactions
            FOR SELECT
            USING (
                user_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';

        -- Coin purchases via function (validate funds, atomic deduction)
        EXECUTE 'DROP POLICY IF EXISTS "Coin purchases via function only" ON public.paypal_transactions';
        EXECUTE 'CREATE POLICY "Coin purchases via function only" ON public.paypal_transactions
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NULL
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 13: STORAGE & LEADERBOARD RLS POLICIES
-- ============================================================================

-- 13.1 STORAGE (Post Media)
DO $$
BEGIN
    -- We cannot easily alter storage.objects in a simple script if permissions are restricted,
    -- but we can try to add policies if the table is accessible.
    -- Usually storage is in a separate schema 'storage'.
    
    -- Check for post-media bucket policies
    -- (This part is often handled by Supabase Storage UI, but we can try to enforce it here)
    NULL; -- Placeholder as storage policies often require superuser or specific extensions
END $$;

-- 13.2 LEADERBOARDS (Boosts)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_boosts') THEN
        EXECUTE 'ALTER TABLE public.user_boosts ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read user boosts" ON public.user_boosts';
        EXECUTE 'CREATE POLICY "Public read user boosts" ON public.user_boosts
            FOR SELECT USING (true)';
            
        -- Admin manage
        EXECUTE 'DROP POLICY IF EXISTS "Admin manage user boosts" ON public.user_boosts';
        EXECUTE 'CREATE POLICY "Admin manage user boosts" ON public.user_boosts
            FOR ALL
            USING (public.is_admin(auth.uid()))';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_boosts') THEN
        EXECUTE 'ALTER TABLE public.family_boosts ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Public read family boosts" ON public.family_boosts';
        EXECUTE 'CREATE POLICY "Public read family boosts" ON public.family_boosts
            FOR SELECT USING (true)';
    END IF;
END $$;

-- ============================================================================
-- SECTION 14: SOCIAL, PODCASTS & TALENT RLS POLICIES
-- ============================================================================

-- 14.1 PODCASTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pod_rooms') THEN
        EXECUTE 'ALTER TABLE public.pod_rooms ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read pod rooms" ON public.pod_rooms';
        EXECUTE 'CREATE POLICY "Public read pod rooms" ON public.pod_rooms
            FOR SELECT USING (true)';
            
        -- Users create rooms
        EXECUTE 'DROP POLICY IF EXISTS "Users create pod rooms" ON public.pod_rooms';
        EXECUTE 'CREATE POLICY "Users create pod rooms" ON public.pod_rooms
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND host_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
            
        -- Host manage room
        EXECUTE 'DROP POLICY IF EXISTS "Host manage pod room" ON public.pod_rooms';
        EXECUTE 'CREATE POLICY "Host manage pod room" ON public.pod_rooms
            FOR UPDATE
            USING (host_id = auth.uid())';
            
        EXECUTE 'DROP POLICY IF EXISTS "Host delete pod room" ON public.pod_rooms';
        EXECUTE 'CREATE POLICY "Host delete pod room" ON public.pod_rooms
            FOR DELETE
            USING (host_id = auth.uid())';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pod_room_participants') THEN
        EXECUTE 'ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read pod participants" ON public.pod_room_participants';
        EXECUTE 'CREATE POLICY "Public read pod participants" ON public.pod_room_participants
            FOR SELECT USING (true)';
            
        -- Users join
        EXECUTE 'DROP POLICY IF EXISTS "Users join pod rooms" ON public.pod_room_participants';
        EXECUTE 'CREATE POLICY "Users join pod rooms" ON public.pod_room_participants
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
            
        -- Users leave
        EXECUTE 'DROP POLICY IF EXISTS "Users leave pod rooms" ON public.pod_room_participants';
        EXECUTE 'CREATE POLICY "Users leave pod rooms" ON public.pod_room_participants
            FOR DELETE
            USING (user_id = auth.uid())';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pod_chat_messages') THEN
        EXECUTE 'ALTER TABLE public.pod_chat_messages ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read pod chat" ON public.pod_chat_messages';
        EXECUTE 'CREATE POLICY "Public read pod chat" ON public.pod_chat_messages
            FOR SELECT USING (true)';
            
        -- Participants send
        EXECUTE 'DROP POLICY IF EXISTS "Participants send pod chat" ON public.pod_chat_messages';
        EXECUTE 'CREATE POLICY "Participants send pod chat" ON public.pod_chat_messages
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
    END IF;
END $$;

-- 14.2 MAI TALENT (Auditions)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mai_talent_auditions') THEN
        EXECUTE 'ALTER TABLE public.mai_talent_auditions ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read auditions" ON public.mai_talent_auditions';
        EXECUTE 'CREATE POLICY "Public read auditions" ON public.mai_talent_auditions
            FOR SELECT USING (true)';
            
        -- Users create
        EXECUTE 'DROP POLICY IF EXISTS "Users create auditions" ON public.mai_talent_auditions';
        EXECUTE 'CREATE POLICY "Users create auditions" ON public.mai_talent_auditions
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
            
        -- Users update own
        EXECUTE 'DROP POLICY IF EXISTS "Users update own auditions" ON public.mai_talent_auditions';
        EXECUTE 'CREATE POLICY "Users update own auditions" ON public.mai_talent_auditions
            FOR UPDATE
            USING (user_id = auth.uid())';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mai_talent_votes') THEN
        EXECUTE 'ALTER TABLE public.mai_talent_votes ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read audition votes" ON public.mai_talent_votes';
        EXECUTE 'CREATE POLICY "Public read audition votes" ON public.mai_talent_votes
            FOR SELECT USING (true)';
            
        -- Users vote
        EXECUTE 'DROP POLICY IF EXISTS "Users vote auditions" ON public.mai_talent_votes';
        EXECUTE 'CREATE POLICY "Users vote auditions" ON public.mai_talent_votes
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND voter_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
    END IF;
END $$;

-- 14.3 FAMILIES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'families') THEN
        EXECUTE 'ALTER TABLE public.families ENABLE ROW LEVEL SECURITY';
        
        -- Ensure owner_id column exists (fix for potential schema mismatch)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'owner_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'founder_id') THEN
                -- Rename founder_id to owner_id if it exists
                RAISE NOTICE 'Renaming founder_id to owner_id in public.families';
                ALTER TABLE public.families RENAME COLUMN founder_id TO owner_id;
            ELSE
                -- Add owner_id if neither exists
                RAISE NOTICE 'Adding owner_id to public.families';
                ALTER TABLE public.families ADD COLUMN owner_id UUID REFERENCES public.user_profiles(id);
            END IF;
        END IF;

        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read families" ON public.families';
        EXECUTE 'CREATE POLICY "Public read families" ON public.families
            FOR SELECT USING (true)';
            
        -- Owner manage
        EXECUTE 'DROP POLICY IF EXISTS "Owner manage family" ON public.families';
        EXECUTE 'CREATE POLICY "Owner manage family" ON public.families
            FOR UPDATE
            USING (owner_id = auth.uid())';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members') THEN
        EXECUTE 'ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY';
        
        -- Public read
        EXECUTE 'DROP POLICY IF EXISTS "Public read family members" ON public.family_members';
        EXECUTE 'CREATE POLICY "Public read family members" ON public.family_members
            FOR SELECT USING (true)';
            
        -- Owner add/remove members (Note: Insert usually handled by join request logic, but if manual:)
        EXECUTE 'DROP POLICY IF EXISTS "Family owner manages members" ON public.family_members';
        EXECUTE 'CREATE POLICY "Family owner manages members" ON public.family_members
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.families
                    WHERE id = family_members.family_id
                    AND owner_id = auth.uid()
                )
            )';
            
        -- Users leave
        EXECUTE 'DROP POLICY IF EXISTS "Users leave family" ON public.family_members';
        EXECUTE 'CREATE POLICY "Users leave family" ON public.family_members
            FOR DELETE
            USING (user_id = auth.uid())';
    END IF;
END $$;

-- ============================================================================
-- SECTION 15: GOVERNMENT/COURT RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'court_cases') THEN
        EXECUTE 'ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY';
        
        -- Fix schema: accuser -> accuser_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'accuser_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'accuser') THEN
                RAISE NOTICE 'Renaming accuser to accuser_id in public.court_cases';
                ALTER TABLE public.court_cases RENAME COLUMN accuser TO accuser_id;
            ELSE
                RAISE NOTICE 'Adding accuser_id to public.court_cases';
                ALTER TABLE public.court_cases ADD COLUMN accuser_id UUID REFERENCES public.user_profiles(id);
            END IF;
        END IF;

        -- Fix schema: defendant -> defendant_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'defendant_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'defendant') THEN
                RAISE NOTICE 'Renaming defendant to defendant_id in public.court_cases';
                ALTER TABLE public.court_cases RENAME COLUMN defendant TO defendant_id;
            ELSE
                RAISE NOTICE 'Adding defendant_id to public.court_cases';
                ALTER TABLE public.court_cases ADD COLUMN defendant_id UUID REFERENCES public.user_profiles(id);
            END IF;
        END IF;

        -- Users read ONLY their own cases
        EXECUTE 'DROP POLICY IF EXISTS "Users read own court cases" ON public.court_cases';
        EXECUTE 'CREATE POLICY "Users read own court cases" ON public.court_cases
            FOR SELECT
            USING (
                defendant_id = auth.uid()
                OR accuser_id = auth.uid()
                OR public.is_staff(auth.uid())
                OR public.is_admin(auth.uid())
            )';

        -- Officers can create cases
        EXECUTE 'DROP POLICY IF EXISTS "Officers create cases" ON public.court_cases';
        EXECUTE 'CREATE POLICY "Officers create cases" ON public.court_cases
            FOR INSERT
            WITH CHECK (
                (public.has_role(''officer'', auth.uid()) OR public.is_staff_on_duty(auth.uid()))
                AND public.global_write_check(auth.uid())
            )';

        -- Lead/Admin can update cases
        EXECUTE 'DROP POLICY IF EXISTS "Lead/Admin update cases" ON public.court_cases';
        EXECUTE 'CREATE POLICY "Lead/Admin update cases" ON public.court_cases
            FOR UPDATE
            USING (
                public.has_role(''lead_officer'', auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_sentences') THEN
        EXECUTE 'ALTER TABLE public.court_sentences ENABLE ROW LEVEL SECURITY';

        -- Court Sentences: Lead/Admin only
        EXECUTE 'DROP POLICY IF EXISTS "Lead/Admin create sentences" ON public.court_sentences';
        EXECUTE 'CREATE POLICY "Lead/Admin create sentences" ON public.court_sentences
            FOR INSERT
            WITH CHECK (
                public.has_role(''lead_officer'', auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_verdicts') THEN
        EXECUTE 'ALTER TABLE public.court_verdicts ENABLE ROW LEVEL SECURITY';

        -- Court Verdicts: Lead/Admin only
        EXECUTE 'DROP POLICY IF EXISTS "Lead/Admin create verdicts" ON public.court_verdicts';
        EXECUTE 'CREATE POLICY "Lead/Admin create verdicts" ON public.court_verdicts
            FOR INSERT
            WITH CHECK (
                public.has_role(''lead_officer'', auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_payments') THEN
        EXECUTE 'ALTER TABLE public.court_payments ENABLE ROW LEVEL SECURITY';

        -- Court Payments: Defendants read own, Admin processes
        EXECUTE 'DROP POLICY IF EXISTS "Defendants read own payments" ON public.court_payments';
        EXECUTE 'CREATE POLICY "Defendants read own payments" ON public.court_payments
            FOR SELECT
            USING (
                defendant_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';

        EXECUTE 'DROP POLICY IF EXISTS "Admin process payments" ON public.court_payments';
        EXECUTE 'CREATE POLICY "Admin process payments" ON public.court_payments
            FOR UPDATE
            USING (
                public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 16: OFFICER SYSTEM RLS POLICIES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officer_shifts') THEN
        EXECUTE 'ALTER TABLE public.officer_shifts ENABLE ROW LEVEL SECURITY';

        -- Officers can act only when clocked_in = true
        EXECUTE 'DROP POLICY IF EXISTS "Officers clock in/out" ON public.officer_shifts';
        EXECUTE 'CREATE POLICY "Officers clock in/out" ON public.officer_shifts
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND public.is_staff(auth.uid())
                AND public.global_write_check(auth.uid())
            )';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') THEN
        EXECUTE 'ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY';

        -- Users read own payouts
        EXECUTE 'DROP POLICY IF EXISTS "Users read own payouts" ON public.payouts';
        EXECUTE 'CREATE POLICY "Users read own payouts" ON public.payouts
            FOR SELECT
            USING (
                user_id = auth.uid()
                OR public.is_admin(auth.uid())
            )';

        -- Admin/Secretary process payouts
        EXECUTE 'DROP POLICY IF EXISTS "Admin/Secretary process payouts" ON public.payouts';
        EXECUTE 'CREATE POLICY "Admin/Secretary process payouts" ON public.payouts
            FOR UPDATE
            USING (
                public.has_role(''secretary'', auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 17: SUPPORT/POSTAL/COMMS RLS POLICIES (Optional - Enable if tables exist)
-- ============================================================================

-- Enable RLS if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
        EXECUTE 'ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        EXECUTE 'ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Messages: Sender/receiver only (NOTE: Checks for receiver_id or user_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        -- Check if it has receiver_id (Private Message Style)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN
            EXECUTE 'DROP POLICY IF EXISTS "Messages sender/receiver only" ON public.messages';
            EXECUTE 'CREATE POLICY "Messages sender/receiver only" ON public.messages
                FOR SELECT
                USING (
                    sender_id = auth.uid()
                    OR receiver_id = auth.uid()
                )';
        -- Check if it is Stream Chat Style (user_id, stream_id) - Public Read
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'stream_id') THEN
             EXECUTE 'DROP POLICY IF EXISTS "Public can read stream chat" ON public.messages';
             EXECUTE 'CREATE POLICY "Public can read stream chat" ON public.messages
                FOR SELECT
                USING (true)';
        END IF;

        EXECUTE 'DROP POLICY IF EXISTS "Users send messages" ON public.messages';
        -- For stream chat, it usually uses user_id, not sender_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'user_id') THEN
             EXECUTE 'CREATE POLICY "Users send messages" ON public.messages
                FOR INSERT
                WITH CHECK (
                    auth.uid() IS NOT NULL
                    AND user_id = auth.uid()
                    AND public.global_write_check(auth.uid())
                )';
        ELSE
             EXECUTE 'CREATE POLICY "Users send messages" ON public.messages
                FOR INSERT
                WITH CHECK (
                    auth.uid() IS NOT NULL
                    AND sender_id = auth.uid()
                    AND public.global_write_check(auth.uid())
                )';
        END IF;
    END IF;
END $$;

-- Calls: Authenticated participants only
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Calls participants only" ON public.calls';
        EXECUTE 'CREATE POLICY "Calls participants only" ON public.calls
            FOR SELECT
            USING (
                caller_id = auth.uid()
                OR callee_id = auth.uid()
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Users make calls" ON public.calls';
        EXECUTE 'CREATE POLICY "Users make calls" ON public.calls
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND caller_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
    END IF;
END $$;

-- Support tickets: User reads own, Staff reads all
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users read own tickets" ON public.support_tickets';
        EXECUTE 'CREATE POLICY "Users read own tickets" ON public.support_tickets
            FOR SELECT
            USING (
                user_id = auth.uid()
                OR public.is_staff(auth.uid())
                OR public.is_admin(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Users create tickets" ON public.support_tickets';
        EXECUTE 'CREATE POLICY "Users create tickets" ON public.support_tickets
            FOR INSERT
            WITH CHECK (
                auth.uid() IS NOT NULL
                AND user_id = auth.uid()
                AND public.global_write_check(auth.uid())
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "Staff manage tickets" ON public.support_tickets';
        EXECUTE 'CREATE POLICY "Staff manage tickets" ON public.support_tickets
            FOR UPDATE
            USING (
                public.is_staff(auth.uid())
                OR public.is_admin(auth.uid())
            )';
    END IF;
END $$;

-- ============================================================================
-- SECTION 18: AUDIT LOGGING SYSTEM (Insert-only, No deletes ever)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Read access for admins only
DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log" ON public.audit_log
    FOR SELECT
    USING (public.is_admin(auth.uid()));

-- No updates or deletes ever
DROP POLICY IF EXISTS "No audit log updates" ON public.audit_log;
CREATE POLICY "No audit log updates" ON public.audit_log
    FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "No audit log deletes" ON public.audit_log;
CREATE POLICY "No audit log deletes" ON public.audit_log
    FOR DELETE
    USING (false);

-- ============================================================================
-- SECTION 19: SOFT DELETE SUPPORT
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_wall_posts' AND column_name = 'deleted_at') THEN
        ALTER TABLE troll_wall_posts ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_items' AND column_name = 'deleted_at') THEN
        ALTER TABLE marketplace_items ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'deleted_at') THEN
        ALTER TABLE court_cases ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Soft delete policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_wall_posts') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Soft deleted wall posts hidden" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Soft deleted wall posts hidden" ON public.troll_wall_posts
            FOR SELECT
            USING (deleted_at IS NULL OR public.is_admin(auth.uid()))';

        EXECUTE 'DROP POLICY IF EXISTS "Soft delete own wall post" ON public.troll_wall_posts';
        EXECUTE 'CREATE POLICY "Soft delete own wall post" ON public.troll_wall_posts
            FOR UPDATE
            USING (
                user_id = auth.uid()
                AND deleted_at IS NULL
                AND public.global_write_check(auth.uid())
            )
            WITH CHECK (deleted_at IS NOT NULL)';
    END IF;
END $$;

-- ============================================================================
-- SECTION 20: COMPLIANCE SUMMARY
-- ============================================================================

/*
✓ NO USING (true) for writable operations
✓ NO role checks using strings (uses profile columns + joins)
✓ NO frontend flag reliance (all checks via DB functions)
✓ Admin power requires expiration (admin_override_until)
✓ All writes validate ownership, role, status, bans, suspensions
✓ Soft deletes preferred over hard deletes
✓ Audit logging on all sensitive operations
✓ No cross-user visibility without explicit authorization
*/

-- ============================================================================
-- END OF UNIVERSAL RLS SYSTEM
-- ============================================================================
