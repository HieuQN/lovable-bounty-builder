-- Create function to reset expired bounty claims
CREATE OR REPLACE FUNCTION public.reset_expired_bounty_claims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Reset bounties where claim_expiration has passed
  UPDATE disclosure_bounties 
  SET 
    status = 'open',
    claimed_by_agent_id = NULL,
    claim_expiration = NULL,
    updated_at = now()
  WHERE 
    status = 'claimed' 
    AND claim_expiration IS NOT NULL 
    AND claim_expiration < now();
END;
$function$