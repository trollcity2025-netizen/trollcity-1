-- Loans table
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  principal numeric NOT NULL,
  balance numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  status text CHECK (status IN ('active','paid','late','defaulted')),
  created_at timestamptz DEFAULT now(),
  due_date timestamptz
);

-- Loan payments table
CREATE TABLE IF NOT EXISTS public.loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES public.loans(id),
  user_id uuid REFERENCES auth.users(id),
  amount numeric NOT NULL,
  paid_at timestamptz DEFAULT now(),
  payment_type text CHECK (payment_type IN ('partial','full')),
  on_time boolean
);

-- Credit scores table
CREATE TABLE IF NOT EXISTS public.credit_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  score integer DEFAULT 500,
  updated_at timestamptz DEFAULT now()
);

-- Credit reports table
CREATE TABLE IF NOT EXISTS public.credit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  event text,
  score_change integer,
  created_at timestamptz DEFAULT now()
);
