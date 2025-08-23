-- Revise transaction logic for showing system
-- Buyer pays 50 credits to request showing
-- Agent bids and gets charged only when winning, refunded when losing
-- Agents only earn credits through disclosure uploads

-- Update function to charge agents when they WIN bids (not when completing showings)
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_win()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If showing status changed to awarded, deduct the bid amount from winning agent
  IF OLD.status != 'awarded' AND NEW.status = 'awarded' AND NEW.winning_agent_id IS NOT NULL THEN
    -- Get the agent's user_id
    SELECT user_id INTO agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.winning_agent_id;
    
    -- Deduct the bid amount from the winning agent
    UPDATE agent_profiles 
    SET credit_balance = credit_balance - NEW.winning_bid_amount
    WHERE id = NEW.winning_agent_id;
    
    -- Log the transaction
    PERFORM log_credit_transaction(
      agent_user_id,
      NEW.winning_agent_id,
      'showing_bid_win',
      -NEW.winning_bid_amount::INTEGER,
      'Credits deducted for winning showing bid',
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Remove credit earning for completing showings (agents only earn through disclosures)
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- No credit changes when showing is confirmed
  -- Agents only earn credits through disclosure uploads
  RETURN NEW;
END;
$function$;

-- Add function to handle bid refunds when agents lose
CREATE OR REPLACE FUNCTION public.handle_showing_bid_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  losing_agent_user_id UUID;
BEGIN
  -- When a bid status changes to 'expired', refund the agent
  IF OLD.status != 'expired' AND NEW.status = 'expired' THEN
    -- Get the agent's user_id
    SELECT user_id INTO losing_agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.bidding_agent_id;
    
    -- Refund the bid amount to the losing agent
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + NEW.bid_amount
    WHERE id = NEW.bidding_agent_id;
    
    -- Log the refund transaction
    PERFORM log_credit_transaction(
      losing_agent_user_id,
      NEW.bidding_agent_id,
      'showing_bid_refund',
      NEW.bid_amount::INTEGER,
      'Credits refunded for losing showing bid',
      NEW.showing_request_id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create triggers for the new logic
DROP TRIGGER IF EXISTS update_agent_credits_on_showing_win_trigger ON public.showing_requests;
CREATE TRIGGER update_agent_credits_on_showing_win_trigger
  BEFORE UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_showing_win();

DROP TRIGGER IF EXISTS update_agent_credits_on_showing_confirmation_trigger ON public.showing_requests;
CREATE TRIGGER update_agent_credits_on_showing_confirmation_trigger
  BEFORE UPDATE ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_showing_confirmation();

DROP TRIGGER IF EXISTS handle_showing_bid_loss_trigger ON public.showing_bids;
CREATE TRIGGER handle_showing_bid_loss_trigger
  BEFORE UPDATE ON public.showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_showing_bid_loss();

-- Update the bid insertion function to charge agents when they place bids
CREATE OR REPLACE FUNCTION public.handle_showing_bid_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  agent_user_id UUID;
BEGIN
  -- Get the agent's user_id
  SELECT user_id INTO agent_user_id
  FROM agent_profiles 
  WHERE id = NEW.bidding_agent_id;
  
  -- Deduct the bid amount when placing a bid
  UPDATE agent_profiles 
  SET credit_balance = credit_balance - NEW.bid_amount
  WHERE id = NEW.bidding_agent_id;
  
  -- Log the bid transaction
  PERFORM log_credit_transaction(
    agent_user_id,
    NEW.bidding_agent_id,
    'showing_bid_placed',
    -NEW.bid_amount::INTEGER,
    'Credits deducted for placing showing bid',
    NEW.showing_request_id,
    NULL
  );

  -- If bid is 50 or more, automatically accept it
  IF NEW.bid_amount >= 50 THEN
    -- Update the showing request with winning bid
    UPDATE public.showing_requests 
    SET 
      status = 'awarded',
      winning_agent_id = NEW.bidding_agent_id,
      winning_bid_amount = NEW.bid_amount,
      selected_time_slot = NEW.selected_time_slot
    WHERE id = NEW.showing_request_id;
    
    -- Mark this bid as accepted
    NEW.status = 'accepted';
    
    -- Mark other bids as expired (this will trigger refunds)
    UPDATE public.showing_bids 
    SET status = 'expired' 
    WHERE showing_request_id = NEW.showing_request_id 
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for bid insertion
DROP TRIGGER IF EXISTS handle_showing_bid_insert_trigger ON public.showing_bids;
CREATE TRIGGER handle_showing_bid_insert_trigger
  BEFORE INSERT ON public.showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_showing_bid_insert();

-- Add new transaction types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('purchase', 'showing_request', 'showing_bid_placed', 'showing_bid_win', 'showing_bid_refund', 'showing_win', 'disclosure_upload');
  ELSE
    -- Add new enum values if they don't exist
    BEGIN
      ALTER TYPE transaction_type ADD VALUE 'showing_bid_placed';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE transaction_type ADD VALUE 'showing_bid_win';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE transaction_type ADD VALUE 'showing_bid_refund';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;