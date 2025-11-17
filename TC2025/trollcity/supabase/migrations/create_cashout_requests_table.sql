-- Create cashout_requests table
CREATE TABLE IF NOT EXISTS public.cashout_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    payment_method TEXT NOT NULL,
    payment_details JSONB,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_cashout_requests_user_id ON public.cashout_requests(user_id);
CREATE INDEX idx_cashout_requests_status ON public.cashout_requests(status);
CREATE INDEX idx_cashout_requests_requested_at ON public.cashout_requests(requested_at);

-- Enable RLS
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own cashout requests" ON public.cashout_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cashout requests" ON public.cashout_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cashout requests" ON public.cashout_requests
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    ));

CREATE POLICY "Admins can update cashout requests" ON public.cashout_requests
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    ));