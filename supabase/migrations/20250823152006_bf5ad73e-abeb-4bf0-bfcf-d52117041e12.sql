-- Enable RLS on tables that have policies but RLS disabled
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showing_bids ENABLE ROW LEVEL SECURITY;