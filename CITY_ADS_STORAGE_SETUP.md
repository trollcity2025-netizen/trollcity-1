# City Ads Storage Bucket Setup

## Overview
This document provides guidance for setting up the Supabase Storage bucket for city ads images.

## Required Bucket

Create a new storage bucket named `city-ads` in Supabase:

### Via SQL (run in Supabase SQL Editor)
```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'city-ads',
  'city-ads',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);
```

### Via Supabase Dashboard
1. Go to Storage in the Supabase dashboard
2. Click "New bucket"
3. Set name to `city-ads`
4. Enable "Public" toggle
5. Set file size limit to 5MB
6. Add allowed MIME types: image/jpeg, image/png, image/webp, image/gif

## Storage Policies

### Public Read Access
All users can view ad images:
```sql
CREATE POLICY "Public read access for city-ads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'city-ads');
```

### Admin Write Access
Only admins and secretaries can upload:
```sql
CREATE POLICY "Admins can upload to city-ads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'city-ads' 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can update city-ads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can delete city-ads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);
```

## Recommended Image Guidelines

### Dimensions
- **Left sidebar slot**: 300x400px (recommended)
- **Right panel featured**: 600x400px (recommended)

### Format
- Use JPG for photographs
- Use PNG for graphics with transparency
- WebP is supported for modern browsers

### File Size
- Keep under 500KB for optimal loading
- Maximum 5MB per file

### Naming Convention
Use timestamp-based naming: `{timestamp}-{random}.{ext}`
Example: `1700000000000-a1b2c3.jpg`

## Frontend Upload Path
When uploading from the Secretary Console, use the path format:
```
city-ads/{userId}/{timestamp}.jpg
```

This is similar to the existing cover photo upload pattern in `src/lib/uploadCover.ts`.