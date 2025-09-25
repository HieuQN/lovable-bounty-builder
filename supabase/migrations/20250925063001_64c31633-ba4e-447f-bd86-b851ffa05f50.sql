-- Add remaining tables to supabase_realtime publication one by one
-- Skip showing_requests, showing_messages, notifications as they're already added

-- Add disclosure_reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.disclosure_reports;
-- Add analysis_logs  
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_logs;
-- Add disclosure_upload_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.disclosure_upload_jobs;
-- Add agent_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_profiles;
-- Add bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
-- Add disclosure_bounties
ALTER PUBLICATION supabase_realtime ADD TABLE public.disclosure_bounties;
-- Add showing_bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.showing_bids;
-- Add properties
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
-- Add credit_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;
-- Add purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
-- Add profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;