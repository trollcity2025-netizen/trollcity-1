-- Admin HQ System - Company Operations and Staff Management
-- Separate from Troll City app features - this is corporate operations

-- 1. Company Roles (separate from app user roles)
CREATE TABLE IF NOT EXISTS company_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '{}', -- granular permissions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default company roles
INSERT INTO company_roles (name, description, permissions) VALUES
('Admin', 'Owner/Executive with full access', '{"all": true}'),
('Development Team', 'Software development and engineering', '{"tech": true, "code": true}'),
('Backend Team', 'Server-side development and infrastructure', '{"backend": true, "infra": true}'),
('Advertising/Marketing', 'Marketing and advertising management', '{"marketing": true, "ads": true}'),
('Moderation Leadership', 'Leadership for moderation team', '{"moderation": true, "leadership": true}'),
('Contractor/Freelancer', 'External contractors and freelancers', '{"contractor": true}')
ON CONFLICT (name) DO NOTHING;

-- 2. Departments/Teams
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    head_user_id UUID REFERENCES auth.users(id),
    budget_allocation DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default departments
INSERT INTO departments (name, description) VALUES
('Executive', 'Executive leadership and administration'),
('Engineering', 'Software development and engineering'),
('Operations', 'Platform operations and infrastructure'),
('Marketing', 'Marketing and advertising'),
('Moderation', 'Content moderation and community management'),
('Finance', 'Financial operations and accounting')
ON CONFLICT (name) DO NOTHING;

-- 3. Staff Management
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    company_role_id UUID NOT NULL REFERENCES company_roles(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),
    hire_date DATE NOT NULL,
    termination_date DATE,
    termination_reason TEXT,
    payroll_email TEXT,
    emergency_contact JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Revenue Sources (for revenue sharing)
CREATE TABLE IF NOT EXISTS revenue_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('coins', 'ads', 'store', 'court', 'contracts', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default revenue sources
INSERT INTO revenue_sources (name, description, category) VALUES
('Coin Sales', 'Revenue from coin purchases', 'coins'),
('Advertising Revenue', 'Ad network and sponsorship revenue', 'ads'),
('Store Fees', 'Marketplace transaction fees', 'store'),
('Court Fines', 'Court-imposed fines and penalties', 'court'),
('Contract Revenue', 'Custom contract and service revenue', 'contracts'),
('Other Revenue', 'Miscellaneous revenue sources', 'other')
ON CONFLICT (name) DO NOTHING;

-- 5. Pay Models
CREATE TABLE IF NOT EXISTS pay_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    model_type TEXT NOT NULL CHECK (model_type IN ('percentage', 'fixed', 'per_unit', 'milestone')),
    base_amount DECIMAL(10,2),
    percentage DECIMAL(5,2), -- for percentage-based models
    revenue_source_id UUID REFERENCES revenue_sources(id), -- for specific source models
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pay models
INSERT INTO pay_models (name, description, model_type, percentage) VALUES
('Platform Revenue Share', 'Percentage of total platform revenue', 'percentage', 5.00),
('Coin Sales Share', 'Percentage of coin sales revenue', 'percentage', 10.00),
('Store Fee Share', 'Percentage of marketplace fees', 'percentage', 15.00),
('Court Revenue Share', 'Percentage of court fines', 'percentage', 20.00),
('Fixed Monthly', 'Fixed monthly salary', 'fixed', 0)
ON CONFLICT (name) DO NOTHING;

-- 6. Staff Pay Assignments
CREATE TABLE IF NOT EXISTS staff_pay_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    pay_model_id UUID NOT NULL REFERENCES pay_models(id),
    effective_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Revenue Tracking
CREATE TABLE IF NOT EXISTS revenue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_source_id UUID NOT NULL REFERENCES revenue_sources(id),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 8. Invoice System
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'held', 'rejected')),
    gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_cut DECIMAL(10,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    breakdown JSONB DEFAULT '[]', -- detailed revenue breakdown
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- who performed the action
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- staff, invoice, revenue, etc.
    entity_id UUID, -- ID of the affected entity
    old_values JSONB,
    new_values JSONB,
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Staff Contracts
CREATE TABLE IF NOT EXISTS staff_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    contract_type TEXT NOT NULL CHECK (contract_type IN ('employment', 'contractor', 'consultant')),
    start_date DATE NOT NULL,
    end_date DATE,
    terms JSONB NOT NULL, -- contract terms, pay model, etc.
    signed_by_staff BOOLEAN DEFAULT false,
    signed_by_admin BOOLEAN DEFAULT false,
    signed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'terminated', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Job Positions/Applications
CREATE TABLE IF NOT EXISTS job_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    company_role_id UUID NOT NULL REFERENCES company_roles(id),
    pay_model_id UUID REFERENCES pay_models(id),
    description TEXT NOT NULL,
    requirements TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed', 'on_hold')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_position_id UUID NOT NULL REFERENCES job_positions(id),
    applicant_id UUID NOT NULL REFERENCES auth.users(id),
    cover_letter TEXT,
    resume_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'interview', 'offered', 'accepted', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_staff_period ON invoices(staff_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_tracking_date ON revenue_tracking(transaction_date);
CREATE INDEX IF NOT EXISTS idx_staff_contracts_status ON staff_contracts(status);

-- Row Level Security
ALTER TABLE company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_pay_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only access)
CREATE POLICY "Only admins can manage company roles" ON company_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage departments" ON departments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage staff" ON staff
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Staff can view their own records
CREATE POLICY "Staff can view their own records" ON staff
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage revenue sources" ON revenue_sources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage pay models" ON pay_models
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage pay assignments" ON staff_pay_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage revenue tracking" ON revenue_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins manage invoices, staff view their own" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        ) OR
        EXISTS (
            SELECT 1 FROM staff s
            WHERE s.user_id = auth.uid()
            AND s.id = invoices.staff_id
        )
    );

CREATE POLICY "Only admins can view audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins manage contracts, staff view their own" ON staff_contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        ) OR
        EXISTS (
            SELECT 1 FROM staff s
            WHERE s.user_id = auth.uid()
            AND s.id = staff_contracts.staff_id
        )
    );

CREATE POLICY "Only admins can manage job positions" ON job_positions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Users can view job positions, admins manage all" ON job_positions
    FOR SELECT USING (status = 'open' OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    ));

CREATE POLICY "Users can manage their own applications, admins manage all" ON job_applications
    FOR ALL USING (
        applicant_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Functions

-- Function to calculate staff earnings for a period
CREATE OR REPLACE FUNCTION calculate_staff_earnings(
    p_staff_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS TABLE (
    revenue_source TEXT,
    gross_amount DECIMAL,
    percentage DECIMAL,
    earnings DECIMAL
) AS $$
DECLARE
    staff_pay RECORD;
    revenue_record RECORD;
BEGIN
    -- Get active pay assignments for this staff member during the period
    FOR staff_pay IN
        SELECT spa.*, pm.*, rs.name as revenue_source_name
        FROM staff_pay_assignments spa
        JOIN pay_models pm ON spa.pay_model_id = pm.id
        LEFT JOIN revenue_sources rs ON pm.revenue_source_id = rs.id
        WHERE spa.staff_id = p_staff_id
        AND spa.is_active = true
        AND spa.effective_date <= p_period_end
        AND (spa.end_date IS NULL OR spa.end_date >= p_period_start)
    LOOP
        -- Calculate earnings based on pay model
        IF staff_pay.model_type = 'percentage' THEN
            FOR revenue_record IN
                SELECT rs.name, SUM(rt.amount) as total_amount
                FROM revenue_tracking rt
                JOIN revenue_sources rs ON rt.revenue_source_id = rs.id
                WHERE rt.transaction_date BETWEEN p_period_start AND p_period_end
                AND (staff_pay.revenue_source_id IS NULL OR rt.revenue_source_id = staff_pay.revenue_source_id)
                GROUP BY rs.name
            LOOP
                RETURN QUERY SELECT
                    revenue_record.name,
                    revenue_record.total_amount,
                    staff_pay.percentage,
                    (revenue_record.total_amount * staff_pay.percentage / 100)::DECIMAL(10,2);
            END LOOP;
        ELSIF staff_pay.model_type = 'fixed' THEN
            -- For fixed amounts, prorate if partial period
            RETURN QUERY SELECT
                'Fixed Amount'::TEXT,
                staff_pay.base_amount::DECIMAL,
                100::DECIMAL,
                staff_pay.base_amount;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate invoices for a pay period
CREATE OR REPLACE FUNCTION generate_payroll_invoices(
    p_period_start DATE,
    p_period_end DATE
)
RETURNS INTEGER AS $$
DECLARE
    staff_record RECORD;
    earnings_record RECORD;
    total_gross DECIMAL := 0;
    total_earnings DECIMAL := 0;
    invoice_count INTEGER := 0;
BEGIN
    -- Generate invoice for each active staff member
    FOR staff_record IN
        SELECT s.*, up.username
        FROM staff s
        JOIN user_profiles up ON s.user_id = up.id
        WHERE s.employment_status = 'active'
    LOOP
        total_gross := 0;
        total_earnings := 0;

        -- Calculate earnings breakdown
        CREATE TEMP TABLE temp_earnings ON COMMIT DROP AS
        SELECT * FROM calculate_staff_earnings(staff_record.id, p_period_start, p_period_end);

        -- Calculate totals
        SELECT COALESCE(SUM(gross_amount), 0), COALESCE(SUM(earnings), 0)
        INTO total_gross, total_earnings
        FROM temp_earnings;

        -- Only create invoice if there are earnings
        IF total_earnings > 0 THEN
            INSERT INTO invoices (
                staff_id,
                period_start,
                period_end,
                gross_amount,
                net_amount,
                breakdown
            )
            SELECT
                staff_record.id,
                p_period_start,
                p_period_end,
                total_gross,
                total_earnings,
                jsonb_agg(jsonb_build_object(
                    'revenue_source', revenue_source,
                    'gross_amount', gross_amount,
                    'percentage', percentage,
                    'earnings', earnings
                ))
            FROM temp_earnings;

            invoice_count := invoice_count + 1;
        END IF;

        DROP TABLE temp_earnings;
    END LOOP;

    RETURN invoice_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_description TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_log (
        user_id,
        action_type,
        entity_type,
        entity_id,
        old_values,
        new_values,
        description
    ) VALUES (
        auth.uid(),
        p_action_type,
        p_entity_type,
        p_entity_id,
        p_old_values,
        p_new_values,
        p_description
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to terminate staff
CREATE OR REPLACE FUNCTION terminate_staff(
    p_staff_id UUID,
    p_reason TEXT,
    p_final_pay BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
DECLARE
    staff_record RECORD;
BEGIN
    -- Get staff info
    SELECT * INTO staff_record FROM staff WHERE id = p_staff_id;

    -- Update staff status
    UPDATE staff
    SET
        employment_status = 'terminated',
        termination_date = CURRENT_DATE,
        termination_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_staff_id;

    -- Deactivate pay assignments
    UPDATE staff_pay_assignments
    SET
        is_active = false,
        end_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE staff_id = p_staff_id AND is_active = true;

    -- Generate final invoice if requested
    IF p_final_pay THEN
        -- This would trigger final invoice generation
        PERFORM generate_payroll_invoices(CURRENT_DATE, CURRENT_DATE);
    END IF;

    -- Log termination
    PERFORM log_audit_event(
        'terminate_staff',
        'staff',
        p_staff_id,
        'Staff member terminated: ' || p_reason,
        jsonb_build_object('status', staff_record.employment_status),
        jsonb_build_object('status', 'terminated', 'termination_reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hire staff
CREATE OR REPLACE FUNCTION hire_staff(
    p_user_id UUID,
    p_company_role_id UUID,
    p_department_id UUID,
    p_pay_model_id UUID,
    p_payroll_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_staff_id UUID;
BEGIN
    -- Create staff record
    INSERT INTO staff (
        user_id,
        company_role_id,
        department_id,
        hire_date,
        payroll_email
    ) VALUES (
        p_user_id,
        p_company_role_id,
        p_department_id,
        CURRENT_DATE,
        COALESCE(p_payroll_email, (SELECT email FROM auth.users WHERE id = p_user_id))
    ) RETURNING id INTO new_staff_id;

    -- Create pay assignment
    INSERT INTO staff_pay_assignments (
        staff_id,
        pay_model_id,
        effective_date
    ) VALUES (
        new_staff_id,
        p_pay_model_id,
        CURRENT_DATE
    );

    -- Log hiring
    PERFORM log_audit_event(
        'hire_staff',
        'staff',
        new_staff_id,
        'New staff member hired',
        NULL,
        jsonb_build_object('user_id', p_user_id, 'role_id', p_company_role_id)
    );

    RETURN new_staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_staff_earnings(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payroll_invoices(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, UUID, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION terminate_staff(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION hire_staff(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE company_roles IS 'Company-level roles separate from app user roles';
COMMENT ON TABLE departments IS 'Company departments and teams';
COMMENT ON TABLE staff IS 'Staff management with employment details';
COMMENT ON TABLE revenue_sources IS 'Sources of company revenue for sharing';
COMMENT ON TABLE pay_models IS 'Different pay model types and configurations';
COMMENT ON TABLE invoices IS 'Payroll invoices with detailed breakdowns';
COMMENT ON TABLE audit_log IS 'Audit trail for all admin actions';
COMMENT ON TABLE staff_contracts IS 'Digital staff contracts';
COMMENT ON TABLE job_positions IS 'Open job positions';
COMMENT ON TABLE job_applications IS 'Job applications from users';

COMMENT ON FUNCTION calculate_staff_earnings IS 'Calculate earnings for a staff member over a period';
COMMENT ON FUNCTION generate_payroll_invoices IS 'Generate payroll invoices for all staff for a period';
COMMENT ON FUNCTION terminate_staff IS 'Terminate staff member with final invoice';
COMMENT ON FUNCTION hire_staff IS 'Hire new staff member with pay assignment';