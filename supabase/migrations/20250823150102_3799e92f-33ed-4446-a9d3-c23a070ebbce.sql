-- Fix the trigger function to use the correct enum value 'awarded'
CREATE OR REPLACE FUNCTION public.handle_showing_bid_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If bid is 50 or more, automatically accept it
  IF NEW.bid_amount >= 50 THEN
    -- Update the showing request with winning bid (use 'awarded' which is a valid enum value)
    UPDATE public.showing_requests 
    SET 
      status = 'awarded',
      winning_agent_id = NEW.bidding_agent_id,
      winning_bid_amount = NEW.bid_amount,
      selected_time_slot = NEW.selected_time_slot
    WHERE id = NEW.showing_request_id;
    
    -- Mark this bid as accepted
    NEW.status = 'accepted';
    
    -- Mark other bids as expired
    UPDATE public.showing_bids 
    SET status = 'expired' 
    WHERE showing_request_id = NEW.showing_request_id 
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';