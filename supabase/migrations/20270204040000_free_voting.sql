-- Create pitch_votes table to track user votes
CREATE TABLE IF NOT EXISTS public.pitch_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID REFERENCES public.pitches(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pitch_id, voter_id)
);

-- Enable RLS
ALTER TABLE public.pitch_votes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public view votes" ON public.pitch_votes FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON public.pitch_votes FOR INSERT 
WITH CHECK (auth.uid() = voter_id);

-- Create RPC for free voting
CREATE OR REPLACE FUNCTION public.vote_for_pitch(p_pitch_id UUID, p_voter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vote_count INT;
BEGIN
    -- Check if already voted
    IF EXISTS (SELECT 1 FROM public.pitch_votes WHERE pitch_id = p_pitch_id AND voter_id = p_voter_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already voted for this pitch');
    END IF;

    -- Insert vote
    INSERT INTO public.pitch_votes (pitch_id, voter_id)
    VALUES (p_pitch_id, p_voter_id);

    -- Increment vote count
    UPDATE public.pitches
    SET vote_count = vote_count + 1
    WHERE id = p_pitch_id
    RETURNING vote_count INTO v_vote_count;

    RETURN jsonb_build_object('success', true, 'new_count', v_vote_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
