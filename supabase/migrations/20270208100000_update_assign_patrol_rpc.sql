CREATE OR REPLACE FUNCTION assign_officer_patrol(
  p_officer_id UUID,
  p_patrol_type TEXT,
  p_instructions TEXT,
  p_priority INTEGER DEFAULT 1
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO officer_patrols (officer_id, patrol_type, instructions, status, priority_level)
  VALUES (p_officer_id, p_patrol_type, p_instructions, 'pending', p_priority)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
