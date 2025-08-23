-- Create missing triggers for database functions
-- Add trigger for disclosure_reports to update credits on disclosure completion
CREATE TRIGGER update_agent_credits_on_disclosure_trigger
  AFTER INSERT OR UPDATE ON public.disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_disclosure();

-- Add trigger for showing_requests to update credits on showing confirmation
CREATE TRIGGER update_agent_credits_on_showing_confirmation_trigger
  AFTER UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_showing_confirmation();

-- Add trigger for showing_requests to update credits when winning a bid
CREATE TRIGGER update_agent_credits_on_showing_win_trigger
  AFTER UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_showing_win();

-- Add trigger for showing_bids to auto-accept bids >= 50
CREATE TRIGGER handle_showing_bid_insert_trigger
  BEFORE INSERT ON public.showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_showing_bid_insert();

-- Add trigger for showing_requests to update confirmation status
CREATE TRIGGER update_confirmation_status_trigger
  BEFORE INSERT OR UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_confirmation_status();

-- Add trigger for agent_profiles to update timestamps
CREATE TRIGGER update_agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for disclosure_bounties to update timestamps
CREATE TRIGGER update_disclosure_bounties_updated_at
  BEFORE UPDATE ON public.disclosure_bounties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for disclosure_reports to update timestamps
CREATE TRIGGER update_disclosure_reports_updated_at
  BEFORE UPDATE ON public.disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for showing_requests to update timestamps
CREATE TRIGGER update_showing_requests_updated_at
  BEFORE UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();