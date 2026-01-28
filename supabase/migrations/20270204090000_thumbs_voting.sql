
-- Add columns to pitches for granular vote tracking
ALTER TABLE public.pitches 
ADD COLUMN IF NOT EXISTS up_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS down_votes INTEGER DEFAULT 0;

-- Add vote_type to pitch_votes
ALTER TABLE public.pitch_votes 
ADD COLUMN IF NOT EXISTS vote_type TEXT CHECK (vote_type IN ('up', 'down'));

-- Update existing votes to be 'up' votes by default (since previous system was just a positive vote)
UPDATE public.pitch_votes SET vote_type = 'up' WHERE vote_type IS NULL;
ALTER TABLE public.pitch_votes ALTER COLUMN vote_type SET NOT NULL;
ALTER TABLE public.pitch_votes ALTER COLUMN vote_type SET DEFAULT 'up';

-- Update pitches up_votes to match current vote_count (assuming all were up votes)
UPDATE public.pitches SET up_votes = vote_count WHERE up_votes = 0 AND vote_count > 0;

-- Recreate vote_for_pitch function to handle up/down votes
CREATE OR REPLACE FUNCTION public.vote_for_pitch(
    p_pitch_id UUID, 
    p_voter_id UUID,
    p_vote_type TEXT DEFAULT 'up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_vote_type TEXT;
    v_new_counts RECORD;
BEGIN
    -- Validate vote type
    IF p_vote_type NOT IN ('up', 'down') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
    END IF;

    -- Check if already voted
    SELECT vote_type INTO v_current_vote_type
    FROM public.pitch_votes 
    WHERE pitch_id = p_pitch_id AND voter_id = p_voter_id;

    IF v_current_vote_type IS NOT NULL THEN
        -- User has voted
        IF v_current_vote_type = p_vote_type THEN
            RETURN jsonb_build_object('success', false, 'error', 'Already voted ' || p_vote_type);
        ELSE
            -- Switch vote
            UPDATE public.pitch_votes 
            SET vote_type = p_vote_type 
            WHERE pitch_id = p_pitch_id AND voter_id = p_voter_id;

            -- Update counts
            IF p_vote_type = 'up' THEN
                -- Switched from down to up
                UPDATE public.pitches
                SET up_votes = up_votes + 1,
                    down_votes = GREATEST(0, down_votes - 1),
                    vote_count = vote_count + 2
                WHERE id = p_pitch_id
                RETURNING vote_count, up_votes, down_votes INTO v_new_counts;
            ELSE
                -- Switched from up to down
                UPDATE public.pitches
                SET down_votes = down_votes + 1,
                    up_votes = GREATEST(0, up_votes - 1),
                    vote_count = vote_count - 2
                WHERE id = p_pitch_id
                RETURNING vote_count, up_votes, down_votes INTO v_new_counts;
            END IF;

            RETURN jsonb_build_object(
                'success', true, 
                'vote_count', v_new_counts.vote_count,
                'up_votes', v_new_counts.up_votes,
                'down_votes', v_new_counts.down_votes,
                'switched', true
            );
        END IF;
    ELSE
        -- New vote
        INSERT INTO public.pitch_votes (pitch_id, voter_id, vote_type)
        VALUES (p_pitch_id, p_voter_id, p_vote_type);

        IF p_vote_type = 'up' THEN
            UPDATE public.pitches
            SET up_votes = up_votes + 1,
                vote_count = vote_count + 1
            WHERE id = p_pitch_id
            RETURNING vote_count, up_votes, down_votes INTO v_new_counts;
        ELSE
            UPDATE public.pitches
            SET down_votes = down_votes + 1,
                vote_count = vote_count - 1
            WHERE id = p_pitch_id
            RETURNING vote_count, up_votes, down_votes INTO v_new_counts;
        END IF;

        RETURN jsonb_build_object(
            'success', true, 
            'vote_count', v_new_counts.vote_count,
            'up_votes', v_new_counts.up_votes,
            'down_votes', v_new_counts.down_votes,
            'switched', false
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
