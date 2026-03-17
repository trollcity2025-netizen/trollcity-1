-- Migration: Add member_count and is_featured columns to troll_families
-- This optimizes the Family Browse page by eliminating client-side aggregation

-- 1. Add member_count column to troll_families for fast member count queries
ALTER TABLE public.troll_families 
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- 2. Add is_featured column for featured families section
ALTER TABLE public.troll_families 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- 3. Create function to update member count
CREATE OR REPLACE FUNCTION public.update_family_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.troll_families 
    SET member_count = member_count + 1 
    WHERE id = NEW.family_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.troll_families 
    SET member_count = GREATEST(member_count - 1, 0) 
    WHERE id = OLD.family_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for INSERT on family_members
DROP TRIGGER IF EXISTS trg_update_member_count_insert ON public.family_members;
CREATE TRIGGER trg_update_member_count_insert
AFTER INSERT ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_family_member_count();

-- 5. Create trigger for DELETE on family_members
DROP TRIGGER IF EXISTS trg_update_member_count_delete ON public.family_members;
CREATE TRIGGER trg_update_member_count_delete
AFTER DELETE ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_family_member_count();

-- 6. Create trigger for UPDATE on family_members (when family_id changes)
DROP TRIGGER IF EXISTS trg_update_member_count_update ON public.family_members;
CREATE TRIGGER trg_update_member_count_update
AFTER UPDATE OF family_id ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_family_member_count();

-- 7. Also handle troll_family_members table if it exists
-- Create function for troll_family_members updates
CREATE OR REPLACE FUNCTION public.update_troll_family_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.troll_families 
    SET member_count = member_count + 1 
    WHERE id = NEW.family_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.troll_families 
    SET member_count = GREATEST(member_count - 1, 0) 
    WHERE id = OLD.family_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create triggers for troll_family_members
DROP TRIGGER IF EXISTS trg_update_troll_member_count_insert ON public.troll_family_members;
CREATE TRIGGER trg_update_troll_member_count_insert
AFTER INSERT ON public.troll_family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_troll_family_member_count();

DROP TRIGGER IF EXISTS trg_update_troll_member_count_delete ON public.troll_family_members;
CREATE TRIGGER trg_update_troll_member_count_delete
AFTER DELETE ON public.troll_family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_troll_family_member_count();

-- 9. Create index on member_count for sorting performance
CREATE INDEX IF NOT EXISTS idx_troll_families_member_count ON public.troll_families(member_count DESC);

-- 10. Create index on is_featured for featured families query
CREATE INDEX IF NOT EXISTS idx_troll_families_is_featured ON public.troll_families(is_featured) WHERE is_featured = true;

-- 11. Initialize member_count from existing data (one-time migration)
UPDATE public.troll_families tf
SET member_count = (
  SELECT COUNT(*) FROM public.family_members fm WHERE fm.family_id = tf.id
);

-- Also update from troll_family_members if it has data
UPDATE public.troll_families tf
SET member_count = COALESCE(
  (
    SELECT COUNT(*) FROM public.family_members fm WHERE fm.family_id = tf.id
  ) + (
    SELECT COUNT(*) FROM public.troll_family_members tfm WHERE tfm.family_id = tf.id
  ), 0
);

-- Grant necessary permissions
GRANT UPDATE ON public.troll_families TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_family_member_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_troll_family_member_count() TO authenticated;
