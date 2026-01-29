-- Fix bank_loans schema and update buy_property_with_loan
-- 1. Add property_id to bank_loans
ALTER TABLE public.bank_loans ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id);

-- 2. Update buy_property_with_loan to store property_id
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_price INTEGER;
    v_loan_amount INTEGER;
    v_min_down INTEGER;
    v_balance INTEGER;
    v_loan_id UUID;
    v_prev_owner_id UUID;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    -- Use price column
    v_price := v_property.price;
    v_min_down := ceil(v_price * 0.10); -- 10% minimum

    IF p_down_payment < v_min_down THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for down payment');
    END IF;

    v_loan_amount := v_price - p_down_payment;
    v_prev_owner_id := v_property.owner_id;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;

    -- Create Loan
    INSERT INTO public.bank_loans (user_id, loan_type, amount, remaining_balance, status, property_id)
    VALUES (v_user_id, 'rent_loan', v_loan_amount, v_loan_amount, 'active', p_property_id)
    RETURNING id INTO v_loan_id;

    -- Transfer Ownership
    UPDATE public.properties SET owner_id = v_user_id, is_for_rent = true, is_for_sale = false WHERE id = p_property_id;

    -- Pay Previous Owner (if exists)
    IF v_prev_owner_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_price WHERE id = v_prev_owner_id;
        -- Log sale
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_prev_owner_id, v_price, 'sale', 'housing', 'Property Sold (Bank Financed)', 'in');
    END IF;

    RETURN jsonb_build_object('success', true, 'loan_id', v_loan_id);
END;
$$;
