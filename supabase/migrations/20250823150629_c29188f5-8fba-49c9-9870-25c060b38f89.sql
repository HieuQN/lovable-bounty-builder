-- Create storage bucket for disclosure documents
INSERT INTO storage.buckets (id, name, public) VALUES ('disclosures', 'disclosures', false);

-- Create RLS policies for disclosure uploads
CREATE POLICY "Agents can upload disclosure documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'disclosures' 
  AND auth.uid() IN (
    SELECT user_id FROM agent_profiles
  )
);

CREATE POLICY "Agents can view their own uploaded documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'disclosures' 
  AND auth.uid() IN (
    SELECT user_id FROM agent_profiles
  )
);

CREATE POLICY "Agents can update their own documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'disclosures' 
  AND auth.uid() IN (
    SELECT user_id FROM agent_profiles
  )
);

-- Update agent_profiles credit_balance when disclosures are completed
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_disclosure()
RETURNS TRIGGER AS $$
BEGIN
  -- If disclosure status changed to complete, add credits to agent
  IF OLD.status != 'complete' AND NEW.status = 'complete' AND NEW.uploaded_by_agent_id IS NOT NULL THEN
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + 10
    WHERE user_id = (
      SELECT user_id FROM agent_profiles WHERE id = NEW.uploaded_by_agent_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for credit updates
CREATE TRIGGER update_agent_credits_disclosure
  AFTER UPDATE ON disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_disclosure();

-- Function to deduct credits when winning showing bids
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_showing_win()
RETURNS TRIGGER AS $$
BEGIN
  -- If showing status changed to awarded, deduct bid amount from agent credits
  IF OLD.status != 'awarded' AND NEW.status = 'awarded' AND NEW.winning_agent_id IS NOT NULL THEN
    UPDATE agent_profiles 
    SET credit_balance = credit_balance - NEW.winning_bid_amount
    WHERE user_id = (
      SELECT user_id FROM agent_profiles WHERE id = NEW.winning_agent_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for showing credit deduction
CREATE TRIGGER update_agent_credits_showing
  AFTER UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_credits_on_showing_win();