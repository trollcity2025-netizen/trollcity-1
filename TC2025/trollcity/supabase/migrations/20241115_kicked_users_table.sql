-- Create kicked_users table for admin kick functionality
CREATE TABLE IF NOT EXISTS public.kicked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    kicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT DEFAULT 'Admin kick - payment required',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kicked_users_user_id ON public.kicked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_kicked_users_created_at ON public.kicked_users(created_at);

-- Enable RLS
ALTER TABLE public.kicked_users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own kick status" ON public.kicked_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage kicked users" ON public.kicked_users
    FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR role = 'admin')
    )
);

-- Grant permissions
GRANT SELECT ON public.kicked_users TO anon;
GRANT SELECT ON public.kicked_users TO authenticated;
GRANT ALL ON public.kicked_users TO service_role;