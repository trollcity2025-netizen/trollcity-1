-- Create payout audit log table
CREATE TABLE IF NOT EXISTS payout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid REFERENCES payout_requests(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'processed', 'approved', 'rejected', etc.
  processed_by uuid REFERENCES user_profiles(id),
  paypal_batch_id text,
  amount decimal(10,2),
  recipient_email text, -- Partially masked for security
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_payout_request_id ON payout_audit_log(payout_request_id);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_processed_by ON payout_audit_log(processed_by);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_created_at ON payout_audit_log(created_at);

-- Add PayPal-specific columns to existing payout_requests table if they don't exist
ALTER TABLE payout_requests 
ADD COLUMN IF NOT EXISTS paypal_batch_id text,
ADD COLUMN IF NOT EXISTS paypal_batch_status text;

-- Create RLS policies for payout_audit_log
ALTER TABLE payout_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow admins and lead officers to read all audit logs
CREATE POLICY "Allow admins and lead officers to read payout audit logs"
ON payout_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR officer_role = 'lead_officer')
  )
);

-- Allow service role full access
CREATE POLICY "Allow service role full access to payout audit logs"
ON payout_audit_log FOR ALL
USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE payout_audit_log IS 'Audit trail for all payout processing actions';
COMMENT ON COLUMN payout_audit_log.action IS 'Type of action: processed, approved, rejected, etc.';
COMMENT ON COLUMN payout_audit_log.recipient_email IS 'Partially masked PayPal email for security';