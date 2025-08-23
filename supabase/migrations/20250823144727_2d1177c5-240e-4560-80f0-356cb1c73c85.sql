-- Add credits to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Update demo user with 1000 credits
UPDATE public.profiles 
SET credits = 1000 
WHERE email = 'demo@intellehouse.com';

-- Create showing_requests table modifications (add columns for time preferences)
ALTER TABLE public.showing_requests 
ADD COLUMN IF NOT EXISTS credits_spent INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS refund_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferred_dates JSONB,
ADD COLUMN IF NOT EXISTS selected_time_slot TEXT;

-- Create showing_bids table for agents to bid on showings
CREATE TABLE IF NOT EXISTS public.showing_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showing_request_id UUID REFERENCES public.showing_requests(id) ON DELETE CASCADE,
  bidding_agent_id UUID NOT NULL,
  bid_amount INTEGER NOT NULL CHECK (bid_amount >= 20),
  selected_time_slot TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'expired'))
);

-- Enable RLS on showing_bids
ALTER TABLE public.showing_bids ENABLE ROW LEVEL SECURITY;

-- RLS policies for showing_bids
CREATE POLICY "Users can view bids for their showing requests" 
ON public.showing_bids 
FOR SELECT 
USING (
  auth.uid() = (
    SELECT requested_by_user_id 
    FROM public.showing_requests 
    WHERE id = showing_request_id
  )
  OR 
  auth.uid() = (
    SELECT user_id 
    FROM public.agent_profiles 
    WHERE id = bidding_agent_id
  )
);

CREATE POLICY "Agents can create bids" 
ON public.showing_bids 
FOR INSERT 
WITH CHECK (
  auth.uid() = (
    SELECT user_id 
    FROM public.agent_profiles 
    WHERE id = bidding_agent_id
  )
);

CREATE POLICY "Agents can update their own bids" 
ON public.showing_bids 
FOR UPDATE 
USING (
  auth.uid() = (
    SELECT user_id 
    FROM public.agent_profiles 
    WHERE id = bidding_agent_id
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_showing_bids_updated_at
  BEFORE UPDATE ON public.showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update showing_requests RLS to allow agents to view showing requests for bidding
CREATE POLICY "Agents can view showing requests for bidding" 
ON public.showing_requests 
FOR SELECT 
USING (
  status = 'bidding' 
  AND refund_deadline > now()
);

-- Function to automatically accept bids at 50 credits
CREATE OR REPLACE FUNCTION public.handle_showing_bid_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If bid is 50 or more, automatically accept it
  IF NEW.bid_amount >= 50 THEN
    -- Update the showing request with winning bid
    UPDATE public.showing_requests 
    SET 
      status = 'matched',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-accepting bids
CREATE TRIGGER showing_bid_auto_accept
  BEFORE INSERT ON public.showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_showing_bid_insert();