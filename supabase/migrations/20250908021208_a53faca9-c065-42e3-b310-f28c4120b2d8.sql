-- Create purchases table to track user report purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disclosure_report_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 49.99,
  payment_status TEXT NOT NULL DEFAULT 'completed',
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own purchases" 
ON public.purchases 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own purchases
CREATE POLICY "Users can insert their own purchases" 
ON public.purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_report_id ON public.purchases(disclosure_report_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();