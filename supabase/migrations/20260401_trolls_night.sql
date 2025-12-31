-- Trolls @ Night feature schema updates (applications, guests, stream flags)
BEGIN;

-- Extend user_profiles with Trolls Night metadata
ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS is_trolls_night_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trolls_night_rejection_count INTEGER DEFAULT 0;

-- Helper function for staff checking
CREATE OR REPLACE FUNCTION public.is_trolls_night_staff(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND (
        up.is_admin = TRUE
        OR up.role = 'admin'
        OR up.is_troll_officer = TRUE
        OR up.role = 'troll_officer'
        OR up.is_lead_officer = TRUE
        OR up.role = 'lead_troll_officer'
      )
  );
$$;

-- Trolls Night applications table
CREATE TABLE IF NOT EXISTS public.trolls_night_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  id_type TEXT,
  id_number TEXT,
  id_document_url TEXT,
  category_preference TEXT,
  additional_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disqualified')),
  rejection_reason TEXT,
  rejection_count INTEGER DEFAULT 0,
  last_reviewed_by UUID,
  last_reviewed_at TIMESTAMPTZ,
  disqualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trolls_night_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tna_user ON public.trolls_night_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tna_status ON public.trolls_night_applications(status);

ALTER TABLE public.trolls_night_applications ENABLE ROW LEVEL SECURITY;

-- Application trigger to sync profiles and enforce rejection limits
CREATE OR REPLACE FUNCTION public.trolls_night_application_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.rejection_count := COALESCE(NEW.rejection_count, 0);

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NOW());
  END IF;

  IF NEW.status = 'approved' THEN
    NEW.rejection_count := 0;
    NEW.disqualified_at := NULL;
    UPDATE public.user_profiles
    SET is_trolls_night_approved = TRUE,
        trolls_night_rejection_count = 0
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'rejected' THEN
    IF COALESCE(OLD.status, '') <> 'rejected' THEN
      NEW.rejection_count := COALESCE(OLD.rejection_count, 0) + 1;
    ELSE
      NEW.rejection_count := COALESCE(OLD.rejection_count, 0);
    END IF;
    IF NEW.rejection_count >= 3 THEN
      NEW.status := 'disqualified';
      NEW.disqualified_at := NOW();
    ELSE
      NEW.disqualified_at := NULL;
    END IF;
    UPDATE public.user_profiles
    SET is_trolls_night_approved = FALSE,
        trolls_night_rejection_count = NEW.rejection_count
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'disqualified' THEN
    NEW.disqualified_at := COALESCE(NEW.disqualified_at, NOW());
    NEW.rejection_count := GREATEST(NEW.rejection_count, COALESCE(OLD.rejection_count, 0));
    UPDATE public.user_profiles
    SET is_trolls_night_approved = FALSE,
        trolls_night_rejection_count = NEW.rejection_count
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.user_profiles
    SET is_trolls_night_approved = FALSE,
        trolls_night_rejection_count = NEW.rejection_count
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trolls_night_application_status ON public.trolls_night_applications;
CREATE TRIGGER trg_trolls_night_application_status
BEFORE INSERT OR UPDATE ON public.trolls_night_applications
FOR EACH ROW
EXECUTE FUNCTION public.trolls_night_application_status_trigger();

-- Row level security policies for applications
CREATE POLICY "Users can submit their own Trolls Night application"
  ON public.trolls_night_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.trolls_night_applications tna
      WHERE tna.user_id = auth.uid()
        AND tna.status IN ('pending', 'approved')
    )
  );

CREATE POLICY "Users can view their Trolls Night application"
  ON public.trolls_night_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their pending Trolls Night application"
  ON public.trolls_night_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Trolls Night staff can manage applications"
  ON public.trolls_night_applications FOR SELECT, UPDATE, DELETE
  USING (public.is_trolls_night_staff(auth.uid()))
  WITH CHECK (public.is_trolls_night_staff(auth.uid()));

-- Ensure streams can be flagged as Trolls Night
ALTER TABLE IF EXISTS public.streams
ADD COLUMN IF NOT EXISTS is_trolls_night BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trolls_night_category TEXT;

-- Guest agreements for verified guests
CREATE TABLE IF NOT EXISTS public.trolls_night_guest_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trolls_night_guest_agreements_broadcaster_id_fkey FOREIGN KEY (broadcaster_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT trolls_night_guest_agreements_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT trolls_night_guest_agreements_unique_pair UNIQUE (broadcaster_id, guest_id),
  CONSTRAINT trolls_night_guest_not_self CHECK (broadcaster_id <> guest_id)
);

CREATE INDEX IF NOT EXISTS idx_tnga_broadcaster ON public.trolls_night_guest_agreements(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_tnga_guest ON public.trolls_night_guest_agreements(guest_id);

ALTER TABLE public.trolls_night_guest_agreements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.trolls_night_guest_limit_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  verified BOOLEAN;
  active_count INTEGER;
BEGIN
  IF NEW.guest_id IS NULL THEN
    RAISE EXCEPTION 'Guest identifier required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = NEW.guest_id
      AND is_verified = TRUE
  ) INTO verified;

  IF NOT verified THEN
    RAISE EXCEPTION 'Guest must be a verified user';
  END IF;

  IF NEW.status = 'approved' THEN
    SELECT COUNT(*) FROM public.trolls_night_guest_agreements
    WHERE broadcaster_id = NEW.broadcaster_id
      AND status = 'approved'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    INTO active_count;

    IF active_count >= 3 THEN
      RAISE EXCEPTION 'Maximum of 3 verified guests per broadcaster';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trolls_night_guest_limits ON public.trolls_night_guest_agreements;
CREATE TRIGGER trg_trolls_night_guest_limits
BEFORE INSERT OR UPDATE ON public.trolls_night_guest_agreements
FOR EACH ROW
EXECUTE FUNCTION public.trolls_night_guest_limit_guard();

CREATE POLICY "Broadcasters can manage their guest agreements"
  ON public.trolls_night_guest_agreements FOR SELECT, INSERT, UPDATE, DELETE
  USING (auth.uid() = broadcaster_id)
  WITH CHECK (auth.uid() = broadcaster_id);

CREATE POLICY "Staff can manage guest agreements"
  ON public.trolls_night_guest_agreements FOR SELECT, INSERT, UPDATE, DELETE
  USING (public.is_trolls_night_staff(auth.uid()))
  WITH CHECK (public.is_trolls_night_staff(auth.uid()));

CREATE POLICY "Guests can view their guest agreements"
  ON public.trolls_night_guest_agreements FOR SELECT
  USING (auth.uid() = guest_id);

COMMIT;
