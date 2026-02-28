-- Add stream_slug column to streams table
ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS stream_slug TEXT;

-- Create a unique index on stream_slug to ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS streams_stream_slug_key ON public.streams (stream_slug);

-- Update existing streams with a slug based on their title
UPDATE public.streams
SET stream_slug = slugify(title)
WHERE stream_slug IS NULL AND title IS NOT NULL;

-- Function to generate a slug from text (if not already exists)
CREATE OR REPLACE FUNCTION public.slugify(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN lower(regexp_replace(trim(value), '[^a-zA-Z0-9_]+', '-', 'g'));
END;
$$;
