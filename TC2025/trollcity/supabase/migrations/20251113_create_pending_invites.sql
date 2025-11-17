-- Migration: create pending_invites table
-- Run this in Supabase SQL editor or via supabase migrations

CREATE TABLE IF NOT EXISTS public.pending_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  assigned_role TEXT DEFAULT 'user',
  invited_by UUID NULL,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used BOOLEAN DEFAULT false,
  used_date TIMESTAMP WITH TIME ZONE NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_invites_email ON public.pending_invites (lower(email));
