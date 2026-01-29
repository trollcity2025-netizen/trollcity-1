
-- Add purchase_price to property_types
ALTER TABLE public.property_types ADD COLUMN IF NOT EXISTS purchase_price INTEGER DEFAULT 10000;

-- Update seed prices
UPDATE public.property_types SET purchase_price = 5000 WHERE id = 'trailer';
UPDATE public.property_types SET purchase_price = 20000 WHERE id = 'apartment';
UPDATE public.property_types SET purchase_price = 100000 WHERE id = 'house';
UPDATE public.property_types SET purchase_price = 1000000 WHERE id = 'mansion';

-- Add price and sale status to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN DEFAULT false;

-- Update existing properties to be for sale if they are system owned (owner_id is null)
UPDATE public.properties 
SET 
    is_for_sale = true, 
    price = (SELECT purchase_price FROM public.property_types WHERE id = properties.type_id)
WHERE owner_id IS NULL;

-- Loans Table
CREATE TABLE IF NOT EXISTS public.property_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id),
    property_id UUID REFERENCES public.properties(id),
    total_amount INTEGER NOT NULL,
    remaining_amount INTEGER NOT NULL,
    monthly_payment INTEGER NOT NULL,
    interest_rate NUMERIC DEFAULT 0.05,
    next_payment_due_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    missed_payments INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.property_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own loans" ON public.property_loans;
CREATE POLICY "Users read own loans" ON public.property_loans FOR SELECT USING (user_id = auth.uid());

-- RPC: Buy Property with Loan
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_balance INTEGER;
    v_loan_amount INTEGER;
    v_monthly_payment INTEGER;
    v_min_down_payment INTEGER;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    IF v_property.is_for_sale = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not for sale');
    END IF;
    
    -- Check both owner columns if needed, but we synced them so owner_id is enough
    IF v_property.owner_id IS NOT NULL AND v_property.owner_id != v_user_id THEN
        -- Buying from another user
        NULL;
    END IF;
    
    IF v_property.owner_id = v_user_id THEN
         RETURN jsonb_build_object('success', false, 'error', 'You already own this property');
    END IF;

    -- Calculate Loan
    v_min_down_payment := v_property.price * 0.10; -- 10% min down
    
    IF p_down_payment < v_min_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    IF p_down_payment > v_property.price THEN
        p_down_payment := v_property.price;
    END IF;

    v_loan_amount := v_property.price - p_down_payment;
    
    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for down payment');
    END IF;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;
    
    -- Log transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -p_down_payment, 'purchase', 'housing', 'Down payment for ' || v_property.name);

    -- Transfer Ownership
    IF v_property.owner_id IS NOT NULL THEN
        -- Pay previous owner full price
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_property.price WHERE id = v_property.owner_id;
        
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_property.owner_id, v_property.price, 'sale', 'housing', 'Sold property ' || v_property.name);
    END IF;

    -- Update both owner columns
    UPDATE public.properties 
    SET owner_id = v_user_id, 
        owner_user_id = v_user_id, 
        is_for_sale = false, 
        is_for_rent = true 
    WHERE id = p_property_id;

    -- Create Loan if amount > 0
    IF v_loan_amount > 0 THEN
        INSERT INTO public.property_loans (
            user_id, property_id, total_amount, remaining_amount, monthly_payment, next_payment_due_at
        ) VALUES (
            v_user_id, p_property_id, v_loan_amount, v_loan_amount, ceil(v_loan_amount / 4.0), NOW() + INTERVAL '7 days'
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Pay Loan
CREATE OR REPLACE FUNCTION public.pay_loan(p_loan_id UUID, p_amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_loan RECORD;
    v_balance INTEGER;
BEGIN
    SELECT * INTO v_loan FROM public.property_loans WHERE id = p_loan_id;
    
    IF NOT FOUND OR v_loan.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status != 'active' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    IF p_amount > v_loan.remaining_amount THEN
        p_amount := v_loan.remaining_amount;
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_amount THEN
         RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_amount WHERE id = v_user_id;
    
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -p_amount, 'loan_repayment', 'housing', 'Loan repayment');

    -- Update Loan
    UPDATE public.property_loans 
    SET remaining_amount = remaining_amount - p_amount,
        last_payment_at = NOW(),
        next_payment_due_at = NOW() + INTERVAL '7 days' -- Extend due date
    WHERE id = p_loan_id;

    -- Close if paid
    IF (v_loan.remaining_amount - p_amount) <= 0 THEN
        UPDATE public.property_loans SET status = 'paid', remaining_amount = 0 WHERE id = p_loan_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Check Defaults (Repo)
CREATE OR REPLACE FUNCTION public.check_loan_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan RECORD;
BEGIN
    -- Find loans where last payment was > 30 days ago
    FOR v_loan IN 
        SELECT * FROM public.property_loans 
        WHERE status = 'active' 
        AND (
            (last_payment_at IS NULL AND created_at < NOW() - INTERVAL '30 days') OR
            (last_payment_at < NOW() - INTERVAL '30 days')
        )
    LOOP
        -- Repo
        UPDATE public.properties 
        SET owner_id = NULL, 
            owner_user_id = NULL,
            is_for_sale = true 
        WHERE id = v_loan.property_id;
        
        UPDATE public.property_loans SET status = 'defaulted' WHERE id = v_loan.id;
    END LOOP;
END;
$$;
