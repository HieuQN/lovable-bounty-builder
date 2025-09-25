-- Fix expired showing requests and improve system
-- Reset expired showing requests back to bidding status
UPDATE showing_requests 
SET status = 'bidding',
    refund_deadline = now() + interval '2 hours'
WHERE status = 'bidding' 
  AND refund_deadline < now();

-- Create function to automatically clean up expired requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_showing_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update expired showing requests
  UPDATE showing_requests 
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'bidding' 
    AND refund_deadline < now();
    
  -- Mark related bids as expired
  UPDATE showing_bids 
  SET status = 'expired',
      updated_at = now()
  WHERE showing_request_id IN (
    SELECT id FROM showing_requests 
    WHERE status = 'expired'
  ) AND status = 'active';
  
  -- Log cleanup
  RAISE NOTICE 'Cleaned up expired showing requests at %', now();
END;
$$;