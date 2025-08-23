-- Fix the credit system for agents
-- Agents should EARN credits for completing showings, not pay to win bids

-- First, let's remove the credit deduction trigger when winning bids
DROP TRIGGER IF EXISTS update_agent_credits_on_showing_win_trigger ON public.showing_requests;

-- Update the function to only award credits (no deductions)
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_win()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If showing status changed to awarded, DO NOT deduct credits
  -- Agents should be rewarded for winning bids, not charged
  -- Credits will be awarded when the showing is confirmed as complete
  
  RETURN NEW;
END;
$function$;

-- Update the confirmation function to award the full bid amount
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If confirmation status changed to both_confirmed, award credits
  IF OLD.confirmation_status != 'both_confirmed' AND NEW.confirmation_status = 'both_confirmed' AND NEW.winning_agent_id IS NOT NULL THEN
    -- Get the agent's user_id
    SELECT user_id INTO agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.winning_agent_id;
    
    -- Award credits for completing the showing (the full bid amount)
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + NEW.winning_bid_amount
    WHERE id = NEW.winning_agent_id;
    
    -- Log the transaction
    PERFORM log_credit_transaction(
      agent_user_id,
      NEW.winning_agent_id,
      'showing_win',
      NEW.winning_bid_amount::INTEGER,
      'Earned credits for completed showing',
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;