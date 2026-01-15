
-- Civil Court System Migration

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS troll_court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number SERIAL,
    plaintiff_id UUID NOT NULL REFERENCES auth.users(id),
    defendant_id UUID NOT NULL REFERENCES auth.users(id),
    assigned_judge_id UUID REFERENCES auth.users(id),
    
    status TEXT NOT NULL DEFAULT 'filed' CHECK (status IN ('filed', 'assigned', 'dismissed', 'ruled')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_url TEXT,
    claim_amount INT DEFAULT 0,
    filing_fee_paid INT DEFAULT 500,
    
    ruling_verdict TEXT CHECK (ruling_verdict IN ('dismissed', 'plaintiff_favored', 'defendant_favored')),
    ruling_notes TEXT,
    judgment_amount INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE troll_court_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public cases" ON troll_court_cases
    FOR SELECT USING (true);

CREATE POLICY "Users can create cases via RPC" ON troll_court_cases
    FOR INSERT WITH CHECK (auth.uid() = plaintiff_id);

-- 2. Ledger for Court Financials

CREATE TABLE IF NOT EXISTS troll_court_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES troll_court_cases(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('FILING_FEE', 'JUDGMENT_AWARD')),
    amount INT NOT NULL,
    from_user_id UUID REFERENCES auth.users(id),
    to_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE troll_court_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view ledger" ON troll_court_ledger FOR SELECT USING (true);

-- 3. Reserved Ledger (for locking funds if needed, or tracking potential payouts)
CREATE TABLE IF NOT EXISTS reserved_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    amount INT NOT NULL,
    reference_id UUID, -- e.g. case_id
    reference_type TEXT, -- 'court_case'
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'consumed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reserved_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own reserved" ON reserved_ledger FOR SELECT USING (auth.uid() = user_id);


-- 4. RPC: File Civil Lawsuit
CREATE OR REPLACE FUNCTION file_civil_lawsuit(
    p_defendant_id UUID,
    p_category TEXT,
    p_description TEXT,
    p_evidence_url TEXT,
    p_claim_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_case_id UUID;
    v_plaintiff_id UUID;
    v_filing_fee INT := 500;
    v_plaintiff_balance INT;
    v_active_case_count INT;
    v_judge_id UUID;
BEGIN
    v_plaintiff_id := auth.uid();
    
    IF v_plaintiff_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    
    IF p_defendant_id IS NULL OR p_defendant_id = v_plaintiff_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid defendant selected.');
    END IF;
    
    IF p_category IS NULL OR length(trim(p_category)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Category is required.');
    END IF;
    
    IF p_description IS NULL OR length(trim(p_description)) < 10 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Description too short.');
    END IF;
    
    SELECT COUNT(*) INTO v_active_case_count
    FROM troll_court_cases
    WHERE plaintiff_id = v_plaintiff_id
      AND status NOT IN ('dismissed', 'ruled');
      
    IF v_active_case_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'You already have an active court case.');
    END IF;

    SELECT troll_coins INTO v_plaintiff_balance
    FROM user_profiles
    WHERE id = v_plaintiff_id;
    
    IF v_plaintiff_balance IS NULL OR v_plaintiff_balance < v_filing_fee THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds for filing fee (500 coins).');
    END IF;

    UPDATE user_profiles
    SET troll_coins = troll_coins - v_filing_fee
    WHERE id = v_plaintiff_id;
    
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, coin_type, source)
    VALUES (v_plaintiff_id, -v_filing_fee, 'court_filing_fee', 'Filing fee for civil lawsuit', 'troll_coins', 'troll_court');

    -- 4. Assign Judge (Random Lead Officer or Admin)
    -- This is a simple assignment strategy. Can be improved.
    SELECT id INTO v_judge_id
    FROM user_profiles
    WHERE role IN ('admin', 'lead_troll_officer')
    ORDER BY random()
    LIMIT 1;

    -- 5. Create Case
    INSERT INTO troll_court_cases (
        plaintiff_id,
        defendant_id,
        category,
        description,
        evidence_url,
        claim_amount,
        filing_fee_paid,
        assigned_judge_id,
        status
    ) VALUES (
        v_plaintiff_id,
        p_defendant_id,
        p_category,
        p_description,
        p_evidence_url,
        p_claim_amount,
        v_filing_fee,
        v_judge_id,
        'assigned'
    ) RETURNING id INTO v_case_id;

    -- 6. Log to Court Ledger
    INSERT INTO troll_court_ledger (
        case_id,
        transaction_type,
        amount,
        from_user_id,
        to_user_id
    ) VALUES (
        v_case_id,
        'FILING_FEE',
        v_filing_fee,
        v_plaintiff_id,
        NULL -- To System
    );

    RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'message', 'Case filed successfully.');
END;
$$;


-- 5. RPC: Rule on Case
CREATE OR REPLACE FUNCTION rule_civil_lawsuit(
    p_case_id UUID,
    p_verdict TEXT, -- 'dismissed', 'plaintiff_favored', 'defendant_favored'
    p_ruling_notes TEXT,
    p_award_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_case RECORD;
    v_judge_id UUID;
    v_defendant_balance INT;
    v_actual_transfer INT;
BEGIN
    v_judge_id := auth.uid();
    
    SELECT * INTO v_case
    FROM troll_court_cases
    WHERE id = p_case_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Case not found.');
    END IF;
    
    -- Verify Judge (or Admin override)
    IF v_case.assigned_judge_id != v_judge_id AND 
       NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_judge_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized to rule on this case.');
    END IF;

    IF v_case.status IN ('dismissed', 'ruled') THEN
         RETURN jsonb_build_object('success', false, 'message', 'Case already resolved.');
    END IF;

    -- Update Case
    UPDATE troll_court_cases
    SET status = 'ruled',
        ruling_verdict = p_verdict,
        ruling_notes = p_ruling_notes,
        judgment_amount = p_award_amount,
        updated_at = NOW()
    WHERE id = p_case_id;

    -- Handle Money if Plaintiff Favored and Award > 0
    IF p_verdict = 'plaintiff_favored' AND p_award_amount > 0 THEN
        -- Check Defendant Balance
        SELECT troll_coins INTO v_defendant_balance
        FROM user_profiles
        WHERE id = v_case.defendant_id;
        
        -- Determine Transfer Amount (Cap at balance? Or go negative? Let's cap at balance for now to avoid debt spiraling without checks)
        -- User Requirement: "Atomic coin transfers"
        IF v_defendant_balance >= p_award_amount THEN
            v_actual_transfer := p_award_amount;
        ELSE
            v_actual_transfer := v_defendant_balance; -- Take what they have
        END IF;
        
        IF v_actual_transfer > 0 THEN
            -- Deduct from Defendant
            UPDATE user_profiles
            SET troll_coins = troll_coins - v_actual_transfer
            WHERE id = v_case.defendant_id;
            
            -- Add to Plaintiff
            UPDATE user_profiles
            SET troll_coins = troll_coins + v_actual_transfer
            WHERE id = v_case.plaintiff_id;
            
            -- Log Transactions
            INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
            VALUES (v_case.defendant_id, -v_actual_transfer, 'COURT_JUDGMENT_DEBIT', 'Judgment for case #' || v_case.case_number);
            
            INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
            VALUES (v_case.plaintiff_id, v_actual_transfer, 'COURT_JUDGMENT_CREDIT', 'Judgment award for case #' || v_case.case_number);
            
            -- Log to Court Ledger
            INSERT INTO troll_court_ledger (
                case_id,
                transaction_type,
                amount,
                from_user_id,
                to_user_id
            ) VALUES (
                p_case_id,
                'JUDGMENT_AWARD',
                v_actual_transfer,
                v_case.defendant_id,
                v_case.plaintiff_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Ruling issued successfully.');
END;
$$;
