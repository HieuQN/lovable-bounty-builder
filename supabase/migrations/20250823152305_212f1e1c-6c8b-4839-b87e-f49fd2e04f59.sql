-- Update confirmation function to handle both confirmations
CREATE OR REPLACE FUNCTION public.update_confirmation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if both agent and buyer have confirmed
  IF NEW.agent_confirmed_at IS NOT NULL AND NEW.buyer_confirmed_at IS NOT NULL THEN
    NEW.confirmation_status = 'both_confirmed';
  ELSIF NEW.agent_confirmed_at IS NOT NULL THEN
    NEW.confirmation_status = 'agent_confirmed';
  ELSIF NEW.buyer_confirmed_at IS NOT NULL THEN
    NEW.confirmation_status = 'buyer_confirmed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update confirmation status
CREATE TRIGGER update_confirmation_status_trigger
  BEFORE UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_confirmation_status();