-- Migration: add token and expiry to pending_invites for one-time invite links
ALTER TABLE IF EXISTS public.pending_invites
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_invites_token ON public.pending_invites (token);

-- Optional: set a default expiry for existing rows if desired (no-op here)
-- UPDATE public.pending_invites SET expires_at = now() + interval '7 days' WHERE expires_at IS NULL;
