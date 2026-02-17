CREATE TABLE public.cashout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    amount INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to see their own cashout requests" ON public.cashout_requests
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow users to create cashout requests" ON public.cashout_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION public.request_cash_out(p_amount int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    user_id uuid := auth.uid();
    current_earned_balance int;
BEGIN
    -- Get current earned balance
    SELECT earned_balance INTO current_earned_balance FROM public.user_profiles WHERE id = user_id;

    -- Check if the user has enough earned balance
    IF current_earned_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient earned balance';
    END IF;

    -- Deduct the amount from the user's earned balance
    UPDATE public.user_profiles
    SET earned_balance = earned_balance - p_amount
    WHERE id = user_id;

    -- Create a cashout request record
    INSERT INTO public.cashout_requests (user_id, amount)
    VALUES (user_id, p_amount);
END;
$$;
