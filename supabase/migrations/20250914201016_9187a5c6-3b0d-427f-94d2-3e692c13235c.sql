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

-- Create a function that can be called to check and reset expired claims
-- This will be called whenever bounties are fetched
CREATE OR REPLACE FUNCTION public.get_available_bounties_with_reset()
RETURNS TABLE (
  id uuid,
  property_id uuid,
  requested_by_user_id uuid,
  status bounty_status,
  claimed_by_agent_id uuid,
  claim_expiration timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- First reset any expired claims
  PERFORM reset_expired_bounty_claims();
  
  -- Then return all bounties
  RETURN QUERY
  SELECT 
    db.id,
    db.property_id,
    db.requested_by_user_id,
    db.status,
    db.claimed_by_agent_id,
    db.claim_expiration,
    db.created_at,
    db.updated_at
  FROM disclosure_bounties db
  ORDER BY db.created_at DESC;
END;
$function$