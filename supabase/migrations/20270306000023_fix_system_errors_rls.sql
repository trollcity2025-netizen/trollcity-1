
-- Enable RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Grant permissions (Crucial for "permission denied" errors)
GRANT SELECT, INSERT ON public.system_errors TO authenticated;
GRANT SELECT, INSERT ON public.system_errors TO anon;
GRANT ALL ON public.system_errors TO service_role;

-- 1. INSERT Policy (Allow authenticated users to log errors)
DROP POLICY IF EXISTS "Authenticated users can insert errors" ON public.system_errors;
CREATE POLICY "Authenticated users can insert errors" 
ON public.system_errors 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. INSERT Policy (Allow anonymous users to log errors - optional but good for login issues)
DROP POLICY IF EXISTS "Anon users can insert errors" ON public.system_errors;
CREATE POLICY "Anon users can insert errors" 
ON public.system_errors 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- 3. SELECT Policy (Admins only)
DROP POLICY IF EXISTS "Admins can view errors" ON public.system_errors;
CREATE POLICY "Admins can view errors" 
ON public.system_errors 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 4. UPDATE Policy (Admins only - to resolve errors)
DROP POLICY IF EXISTS "Admins can update errors" ON public.system_errors;
CREATE POLICY "Admins can update errors" 
ON public.system_errors 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 5. DELETE Policy (Admins only)
DROP POLICY IF EXISTS "Admins can delete errors" ON public.system_errors;
CREATE POLICY "Admins can delete errors" 
ON public.system_errors 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = true)
  )
);
