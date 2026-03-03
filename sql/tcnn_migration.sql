-- Troll City News Network (TCNN) Database Migration
-- This migration creates all necessary tables and functions for TCNN

-- ============================================
-- PART 1: Add TCNN Role Columns to user_profiles
-- ============================================

-- Add TCNN role flags to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_journalist BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_news_caster BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_chief_news_caster BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tcnn_role_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tcnn_role_assigned_by UUID REFERENCES public.user_profiles(id);

-- Create index for TCNN role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_tcnn_roles 
ON public.user_profiles(is_journalist, is_news_caster, is_chief_news_caster) 
WHERE is_journalist = TRUE OR is_news_caster = TRUE OR is_chief_news_caster = TRUE;

-- ============================================
-- PART 2: TCNN Articles Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tcnn_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url TEXT,
    
    -- Author relationship
    author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    
    -- Article status workflow
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived')),
    
    -- Publishing info
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.user_profiles(id),
    
    -- Categorization
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[],
    is_breaking BOOLEAN DEFAULT FALSE,
    
    -- Engagement metrics
    view_count INTEGER DEFAULT 0,
    tip_count INTEGER DEFAULT 0,
    tip_total_coins INTEGER DEFAULT 0,
    
    -- SEO and metadata
    meta_description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for articles
CREATE INDEX IF NOT EXISTS idx_tcnn_articles_status ON public.tcnn_articles(status);
CREATE INDEX IF NOT EXISTS idx_tcnn_articles_author ON public.tcnn_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_tcnn_articles_published ON public.tcnn_articles(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_tcnn_articles_breaking ON public.tcnn_articles(is_breaking) WHERE is_breaking = TRUE;

-- Enable RLS on articles
ALTER TABLE public.tcnn_articles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: TCNN Ticker Queue Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tcnn_ticker_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    
    -- Submitter info
    submitted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    submitter_name TEXT,
    
    -- Ticker type and priority
    ticker_type VARCHAR(50) DEFAULT 'standard' CHECK (ticker_type IN ('standard', 'breaking')),
    priority INTEGER DEFAULT 1 CHECK (priority IN (1, 2, 3)), -- 1=low, 2=medium, 3=high/breaking
    
    -- Status workflow
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    
    -- Review info
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.user_profiles(id),
    rejection_reason TEXT,
    
    -- Display tracking
    display_count INTEGER DEFAULT 0,
    last_displayed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Cooldown tracking
    cooldown_minutes INTEGER DEFAULT 30,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ticker queue
CREATE INDEX IF NOT EXISTS idx_tcnn_ticker_status ON public.tcnn_ticker_queue(status);
CREATE INDEX IF NOT EXISTS idx_tcnn_ticker_type ON public.tcnn_ticker_queue(ticker_type);
CREATE INDEX IF NOT EXISTS idx_tcnn_ticker_submitted_by ON public.tcnn_ticker_queue(submitted_by);
CREATE INDEX IF NOT EXISTS idx_tcnn_ticker_expires ON public.tcnn_ticker_queue(expires_at);

-- Enable RLS on ticker queue
ALTER TABLE public.tcnn_ticker_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 4: TCNN Role Assignments Table (for tracking role changes)
-- ============================================

CREATE TABLE IF NOT EXISTS public.tcnn_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Role being assigned
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('journalist', 'news_caster', 'chief_news_caster')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('assigned', 'removed')),
    
    -- Assignment details
    assigned_by UUID REFERENCES public.user_profiles(id),
    reason TEXT,
    
    -- Application reference (if applicable)
    application_id UUID,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcnn_role_assignments_user ON public.tcnn_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_tcnn_role_assignments_role ON public.tcnn_role_assignments(role_type);

-- Enable RLS on role assignments
ALTER TABLE public.tcnn_role_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 5: TCNN Tips Table (for tracking journalist tips)
-- ============================================

CREATE TABLE IF NOT EXISTS public.tcnn_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tipper info
    tipper_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    tipper_name TEXT,
    
    -- Recipient info
    recipient_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_name TEXT,
    
    -- Tip details
    amount INTEGER NOT NULL CHECK (amount > 0),
    coin_type VARCHAR(20) DEFAULT 'troll_coins' CHECK (coin_type IN ('troll_coins', 'paid_coins')),
    
    -- Context
    article_id UUID REFERENCES public.tcnn_articles(id) ON DELETE SET NULL,
    stream_id TEXT, -- For live broadcast tips
    message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcnn_tips_recipient ON public.tcnn_tips(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tcnn_tips_article ON public.tcnn_tips(article_id);
CREATE INDEX IF NOT EXISTS idx_tcnn_tips_created ON public.tcnn_tips(created_at DESC);

-- Enable RLS on tips
ALTER TABLE public.tcnn_tips ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 6: Update coin_transactions table type enum
-- ============================================

-- Add TCNN tip type to coin_transactions if using enum
DO $$
BEGIN
    -- Check if the coin_transactions table has a type column with check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coin_transactions' 
        AND column_name = 'type'
    ) THEN
        -- Add TCNN tip as a valid type if using text column
        ALTER TABLE public.coin_transactions 
        ADD COLUMN IF NOT EXISTS tcnn_tip_id UUID REFERENCES public.tcnn_tips(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- PART 7: Row Level Security Policies
-- ============================================

-- Policies for tcnn_articles
DROP POLICY IF EXISTS "Articles are viewable by everyone when published" ON public.tcnn_articles;
CREATE POLICY "Articles are viewable by everyone when published"
    ON public.tcnn_articles FOR SELECT
    USING (status = 'published' OR author_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin')));

DROP POLICY IF EXISTS "Journalists can create articles" ON public.tcnn_articles;
CREATE POLICY "Journalists can create articles"
    ON public.tcnn_articles FOR INSERT
    WITH CHECK (auth.uid() = author_id AND 
                EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_journalist = TRUE OR is_news_caster = TRUE OR is_chief_news_caster = TRUE)));

DROP POLICY IF EXISTS "Authors can update their own draft articles" ON public.tcnn_articles;
CREATE POLICY "Authors can update their own draft articles"
    ON public.tcnn_articles FOR UPDATE
    USING (auth.uid() = author_id OR 
           EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_chief_news_caster = TRUE));

DROP POLICY IF EXISTS "Chief News Casters can delete articles" ON public.tcnn_articles;
CREATE POLICY "Chief News Casters can delete articles"
    ON public.tcnn_articles FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin')));

-- Policies for tcnn_ticker_queue
DROP POLICY IF EXISTS "News Casters can submit tickers" ON public.tcnn_ticker_queue;
CREATE POLICY "News Casters can submit tickers"
    ON public.tcnn_ticker_queue FOR INSERT
    WITH CHECK (auth.uid() = submitted_by AND 
                EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_news_caster = TRUE OR is_chief_news_caster = TRUE)));

DROP POLICY IF EXISTS "Users can view their own tickers" ON public.tcnn_ticker_queue;
CREATE POLICY "Users can view their own tickers"
    ON public.tcnn_ticker_queue FOR SELECT
    USING (submitted_by = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_chief_news_caster = TRUE) OR
           status = 'approved');

DROP POLICY IF EXISTS "Chief News Casters can approve tickers" ON public.tcnn_ticker_queue;
CREATE POLICY "Chief News Casters can approve tickers"
    ON public.tcnn_ticker_queue FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_chief_news_caster = TRUE));

-- Policies for tcnn_tips
DROP POLICY IF EXISTS "Tips are viewable by tipper and recipient" ON public.tcnn_tips;
CREATE POLICY "Tips are viewable by tipper and recipient"
    ON public.tcnn_tips FOR SELECT
    USING (tipper_id = auth.uid() OR recipient_id = auth.uid() OR
           EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin')));

DROP POLICY IF EXISTS "Anyone can create tips" ON public.tcnn_tips;
CREATE POLICY "Anyone can create tips"
    ON public.tcnn_tips FOR INSERT
    WITH CHECK (auth.uid() = tipper_id);

-- Policies for tcnn_role_assignments
DROP POLICY IF EXISTS "Role assignments viewable by Chiefs and Admins" ON public.tcnn_role_assignments;
CREATE POLICY "Role assignments viewable by Chiefs and Admins"
    ON public.tcnn_role_assignments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin')));

-- ============================================
-- PART 8: Database Functions
-- ============================================

-- Function to check if user can submit ticker (cooldown check)
CREATE OR REPLACE FUNCTION public.check_ticker_cooldown(p_user_id UUID)
RETURNS TABLE(can_submit BOOLEAN, minutes_remaining INTEGER) AS $$
DECLARE
    last_submission TIMESTAMP WITH TIME ZONE;
    cooldown_minutes INTEGER := 30; -- Default cooldown
    time_diff INTEGER;
BEGIN
    -- Get last ticker submission
    SELECT created_at INTO last_submission
    FROM public.tcnn_ticker_queue
    WHERE submitted_by = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF last_submission IS NULL THEN
        RETURN QUERY SELECT TRUE, 0;
        RETURN;
    END IF;
    
    -- Calculate time difference in minutes
    time_diff := EXTRACT(EPOCH FROM (NOW() - last_submission)) / 60;
    
    IF time_diff >= cooldown_minutes THEN
        RETURN QUERY SELECT TRUE, 0;
    ELSE
        RETURN QUERY SELECT FALSE, (cooldown_minutes - time_diff)::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment article view count
CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.tcnn_articles
    SET view_count = view_count + 1
    WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process tip to journalist
CREATE OR REPLACE FUNCTION public.tip_journalist(
    p_tipper_id UUID,
    p_recipient_id UUID,
    p_amount INTEGER,
    p_coin_type TEXT,
    p_article_id UUID DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT, tip_id UUID) AS $$
DECLARE
    v_tip_id UUID;
    v_tipper_balance INTEGER;
    v_recipient_username TEXT;
BEGIN
    -- Get recipient username
    SELECT username INTO v_recipient_username
    FROM public.user_profiles
    WHERE id = p_recipient_id;
    
    IF v_recipient_username IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Recipient not found', NULL::UUID;
        RETURN;
    END IF;
    
    -- Check tipper balance
    IF p_coin_type = 'troll_coins' THEN
        SELECT troll_coins INTO v_tipper_balance
        FROM public.user_profiles
        WHERE id = p_tipper_id;
    ELSE
        SELECT free_coin_balance INTO v_tipper_balance
        FROM public.user_profiles
        WHERE id = p_tipper_id;
    END IF;
    
    IF v_tipper_balance IS NULL OR v_tipper_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, 'Insufficient balance', NULL::UUID;
        RETURN;
    END IF;
    
    -- Deduct from tipper
    IF p_coin_type = 'troll_coins' THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - p_amount
        WHERE id = p_tipper_id;
    ELSE
        UPDATE public.user_profiles
        SET free_coin_balance = free_coin_balance - p_amount
        WHERE id = p_tipper_id;
    END IF;
    
    -- Add to recipient
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount
    WHERE id = p_recipient_id;
    
    -- Create tip record
    INSERT INTO public.tcnn_tips (
        tipper_id, recipient_id, amount, coin_type, 
        article_id, message, recipient_name
    ) VALUES (
        p_tipper_id, p_recipient_id, p_amount, p_coin_type,
        p_article_id, p_message, v_recipient_username
    )
    RETURNING id INTO v_tip_id;
    
    -- Update article tip metrics if applicable
    IF p_article_id IS NOT NULL THEN
        UPDATE public.tcnn_articles
        SET tip_count = tip_count + 1,
            tip_total_coins = tip_total_coins + p_amount
        WHERE id = p_article_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_tip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign/remove TCNN roles (Chief only)
CREATE OR REPLACE FUNCTION public.manage_tcnn_role(
    p_target_user_id UUID,
    p_role_type TEXT,
    p_action TEXT, -- 'assign' or 'remove'
    p_assigned_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT) AS $$
DECLARE
    v_is_chief BOOLEAN;
BEGIN
    -- Check if assigned_by is Chief News Caster or Admin
    SELECT (is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin') INTO v_is_chief
    FROM public.user_profiles
    WHERE id = p_assigned_by;
    
    IF NOT v_is_chief THEN
        RETURN QUERY SELECT FALSE, 'Only Chief News Casters or Admins can manage TCNN roles';
        RETURN;
    END IF;
    
    -- Update user profile
    IF p_role_type = 'journalist' THEN
        UPDATE public.user_profiles
        SET is_journalist = (p_action = 'assign'),
            tcnn_role_assigned_at = CASE WHEN p_action = 'assign' THEN NOW() ELSE NULL END,
            tcnn_role_assigned_by = CASE WHEN p_action = 'assign' THEN p_assigned_by ELSE NULL END
        WHERE id = p_target_user_id;
    ELSIF p_role_type = 'news_caster' THEN
        UPDATE public.user_profiles
        SET is_news_caster = (p_action = 'assign'),
            tcnn_role_assigned_at = CASE WHEN p_action = 'assign' THEN NOW() ELSE NULL END,
            tcnn_role_assigned_by = CASE WHEN p_action = 'assign' THEN p_assigned_by ELSE NULL END
        WHERE id = p_target_user_id;
    ELSIF p_role_type = 'chief_news_caster' THEN
        -- Only admins can assign chief roles
        IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_assigned_by AND (is_admin = TRUE OR role = 'admin')) THEN
            RETURN QUERY SELECT FALSE, 'Only admins can assign Chief News Caster roles';
            RETURN;
        END IF;
        
        -- Check max chiefs limit (2-3)
        IF p_action = 'assign' THEN
            IF (SELECT COUNT(*) FROM public.user_profiles WHERE is_chief_news_caster = TRUE) >= 3 THEN
                RETURN QUERY SELECT FALSE, 'Maximum of 3 Chief News Casters allowed';
                RETURN;
            END IF;
        END IF;
        
        UPDATE public.user_profiles
        SET is_chief_news_caster = (p_action = 'assign'),
            tcnn_role_assigned_at = CASE WHEN p_action = 'assign' THEN NOW() ELSE NULL END,
            tcnn_role_assigned_by = CASE WHEN p_action = 'assign' THEN p_assigned_by ELSE NULL END
        WHERE id = p_target_user_id;
    END IF;
    
    -- Log the assignment
    INSERT INTO public.tcnn_role_assignments (
        user_id, role_type, action, assigned_by, reason
    ) VALUES (
        p_target_user_id, p_role_type, p_action || 'ed', p_assigned_by, p_reason
    );
    
    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get published articles with author info
CREATE OR REPLACE FUNCTION public.get_tcnn_articles(
    p_status TEXT DEFAULT 'published',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    slug TEXT,
    excerpt TEXT,
    featured_image_url TEXT,
    author_id UUID,
    author_name TEXT,
    author_avatar TEXT,
    status TEXT,
    category TEXT,
    is_breaking BOOLEAN,
    view_count INTEGER,
    tip_count INTEGER,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.featured_image_url,
        a.author_id,
        COALESCE(a.author_name, p.username) as author_name,
        p.avatar_url as author_avatar,
        a.status::TEXT,
        a.category,
        a.is_breaking,
        a.view_count,
        a.tip_count,
        a.published_at,
        a.created_at
    FROM public.tcnn_articles a
    LEFT JOIN public.user_profiles p ON a.author_id = p.id
    WHERE a.status = p_status
    ORDER BY 
        CASE WHEN a.is_breaking THEN 0 ELSE 1 END,
        a.published_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 9: Triggers
-- ============================================

-- Trigger to update updated_at timestamp on articles
CREATE OR REPLACE FUNCTION public.update_tcnn_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tcnn_articles_updated_at ON public.tcnn_articles;
CREATE TRIGGER trigger_tcnn_articles_updated_at
    BEFORE UPDATE ON public.tcnn_articles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tcnn_articles_updated_at();

-- Trigger to update updated_at timestamp on ticker queue
CREATE OR REPLACE FUNCTION public.update_tcnn_ticker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tcnn_ticker_updated_at ON public.tcnn_ticker_queue;
CREATE TRIGGER trigger_tcnn_ticker_updated_at
    BEFORE UPDATE ON public.tcnn_ticker_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tcnn_ticker_updated_at();

-- ============================================
-- PART 10: Grant Permissions
-- ============================================

GRANT ALL ON public.tcnn_articles TO authenticated;
GRANT ALL ON public.tcnn_articles TO anon;
GRANT ALL ON public.tcnn_ticker_queue TO authenticated;
GRANT ALL ON public.tcnn_ticker_queue TO anon;
GRANT ALL ON public.tcnn_tips TO authenticated;
GRANT ALL ON public.tcnn_tips TO anon;
GRANT ALL ON public.tcnn_role_assignments TO authenticated;
GRANT ALL ON public.tcnn_role_assignments TO anon;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

COMMIT;
