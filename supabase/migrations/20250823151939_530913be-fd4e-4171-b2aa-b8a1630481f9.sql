-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('disclosure_upload', 'showing_win', 'showing_deduction', 'manual_adjustment');

-- Create enum for showing confirmation status
CREATE TYPE public.confirmation_status AS ENUM ('pending', 'agent_confirmed', 'buyer_confirmed', 'both_confirmed', 'cancelled');

-- Create transactions table for credit history
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_profile_id UUID,
  transaction_type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  related_showing_id UUID,
  related_disclosure_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add confirmation status to showing_requests
ALTER TABLE public.showing_requests 
ADD COLUMN confirmation_status confirmation_status DEFAULT 'pending',
ADD COLUMN agent_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN buyer_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_transactions
CREATE POLICY "Users can view their own transactions" 
ON public.credit_transactions 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = (
  SELECT user_id FROM agent_profiles WHERE id = agent_profile_id
));

CREATE POLICY "System can insert transactions" 
ON public.credit_transactions 
FOR INSERT 
WITH CHECK (true);

-- Create function to log credit transactions
CREATE OR REPLACE FUNCTION public.log_credit_transaction(
  p_user_id UUID,
  p_agent_profile_id UUID,
  p_type transaction_type,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_showing_id UUID DEFAULT NULL,
  p_disclosure_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_id UUID;
BEGIN
  INSERT INTO credit_transactions (
    user_id, 
    agent_profile_id, 
    transaction_type, 
    amount, 
    description,
    related_showing_id,
    related_disclosure_id
  )
  VALUES (
    p_user_id, 
    p_agent_profile_id, 
    p_type, 
    p_amount, 
    p_description,
    p_showing_id,
    p_disclosure_id
  )
  RETURNING id INTO transaction_id;
  
  RETURN transaction_id;
END;
$$;

-- Update agent credits function for disclosure uploads
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_disclosure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If disclosure status changed to complete and has an uploading agent
  IF OLD.status != 'complete' AND NEW.status = 'complete' AND NEW.uploaded_by_agent_id IS NOT NULL THEN
    -- Get the agent's user_id
    SELECT user_id INTO agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.uploaded_by_agent_id;
    
    -- Update agent credit balance
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + 10
    WHERE id = NEW.uploaded_by_agent_id;
    
    -- Log the transaction
    PERFORM log_credit_transaction(
      agent_user_id,
      NEW.uploaded_by_agent_id,
      'disclosure_upload',
      10,
      'Earned credits for uploading disclosure',
      NULL,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update showing credits function to only award when both confirm
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If confirmation status changed to both_confirmed, award credits
  IF OLD.confirmation_status != 'both_confirmed' AND NEW.confirmation_status = 'both_confirmed' AND NEW.winning_agent_id IS NOT NULL THEN
    -- Get the agent's user_id
    SELECT user_id INTO agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.winning_agent_id;
    
    -- Award credits back (they were deducted when winning the bid)
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + NEW.winning_bid_amount
    WHERE id = NEW.winning_agent_id;
    
    -- Log the transaction
    PERFORM log_credit_transaction(
      agent_user_id,
      NEW.winning_agent_id,
      'showing_win',
      NEW.winning_bid_amount::INTEGER,
      'Earned credits for confirmed showing',
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the existing showing win function to deduct credits and log transaction
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_win()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If showing status changed to awarded, deduct bid amount from agent credits
  IF OLD.status != 'awarded' AND NEW.status = 'awarded' AND NEW.winning_agent_id IS NOT NULL THEN
    -- Get the agent's user_id
    SELECT user_id INTO agent_user_id
    FROM agent_profiles 
    WHERE id = NEW.winning_agent_id;
    
    -- Deduct credits
    UPDATE agent_profiles 
    SET credit_balance = credit_balance - NEW.winning_bid_amount
    WHERE id = NEW.winning_agent_id;
    
    -- Log the deduction transaction
    PERFORM log_credit_transaction(
      agent_user_id,
      NEW.winning_agent_id,
      'showing_deduction',
      -NEW.winning_bid_amount::INTEGER,
      'Credits deducted for winning showing bid',
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_agent_credits_on_disclosure_trigger ON disclosure_reports;
CREATE TRIGGER update_agent_credits_on_disclosure_trigger
  AFTER UPDATE ON disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_credits_on_disclosure();

DROP TRIGGER IF EXISTS update_agent_credits_on_showing_win_trigger ON showing_requests;
CREATE TRIGGER update_agent_credits_on_showing_win_trigger
  AFTER UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_credits_on_showing_win();

CREATE TRIGGER update_agent_credits_on_showing_confirmation_trigger
  AFTER UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_credits_on_showing_confirmation();