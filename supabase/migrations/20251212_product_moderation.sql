-- Product Moderation System
-- Add moderation status to marketplace_items

-- 1. Add moderation fields to marketplace_items
ALTER TABLE marketplace_items
ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'draft' CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
ADD COLUMN IF NOT EXISTS moderation_notes text;

-- 2. Create product_moderation_queue view for admins
CREATE OR REPLACE VIEW product_moderation_queue AS
SELECT
  mi.*,
  up.username as seller_username,
  up.email as seller_email
FROM marketplace_items mi
LEFT JOIN user_profiles up ON mi.seller_id = up.id
WHERE mi.moderation_status IN ('pending_review', 'rejected')
ORDER BY mi.created_at ASC;

-- 3. Function to submit product for review
CREATE OR REPLACE FUNCTION submit_product_for_review(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE marketplace_items
  SET moderation_status = 'pending_review',
      updated_at = now()
  WHERE id = p_item_id AND seller_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found or not owned by you');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Product submitted for review');
END;
$$;

-- 4. Function for admins to approve/reject products
CREATE OR REPLACE FUNCTION moderate_product(
  p_item_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can moderate products');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE marketplace_items
    SET moderation_status = 'approved',
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_notes = p_notes,
        status = 'active',
        updated_at = now()
    WHERE id = p_item_id;
  ELSIF p_action = 'reject' THEN
    UPDATE marketplace_items
    SET moderation_status = 'rejected',
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_notes = p_notes,
        status = 'removed',
        updated_at = now()
    WHERE id = p_item_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use "approve" or "reject"');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action, 'notes', p_notes);
END;
$$;

-- 5. Update RLS policies to only show approved products to regular users
DROP POLICY IF EXISTS "Users can view marketplace items" ON marketplace_items;
CREATE POLICY "Users can view approved marketplace items" ON marketplace_items
  FOR SELECT USING (
    moderation_status = 'approved' OR
    seller_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'officer')
    )
  );

-- Sellers can update their own products
CREATE POLICY "Sellers can update own products" ON marketplace_items
  FOR UPDATE USING (seller_id = auth.uid());

-- Grant permissions
GRANT EXECUTE ON FUNCTION submit_product_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION moderate_product(uuid, text, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION submit_product_for_review IS 'Allows sellers to submit their products for admin review';
COMMENT ON FUNCTION moderate_product IS 'Allows admins to approve or reject products with optional notes';