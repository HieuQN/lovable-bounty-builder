-- Update the disclosure upload trigger to handle immediate 'complete' status
CREATE OR REPLACE FUNCTION public.update_agent_credits_on_disclosure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_user_id UUID;
BEGIN
  -- If disclosure status is complete and has an uploading agent (for both INSERT and UPDATE)
  IF (TG_OP = 'INSERT' AND NEW.status = 'complete' AND NEW.uploaded_by_agent_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.status != 'complete' AND NEW.status = 'complete' AND NEW.uploaded_by_agent_id IS NOT NULL) THEN
    
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

-- Drop existing trigger and create new ones for both INSERT and UPDATE
DROP TRIGGER IF EXISTS update_agent_credits_on_disclosure_trigger ON disclosure_reports;

CREATE TRIGGER update_agent_credits_on_disclosure_insert_trigger
  AFTER INSERT ON disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_credits_on_disclosure();

CREATE TRIGGER update_agent_credits_on_disclosure_update_trigger
  AFTER UPDATE ON disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_credits_on_disclosure();

-- Add policy to allow agents to view their own transactions
CREATE POLICY "Agents can view their own credit transactions" 
ON public.credit_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Test the trigger by manually triggering it for recent uploads
DO $$
DECLARE
  disclosure_record RECORD;
  agent_user_id UUID;
BEGIN
  -- Get recent disclosures that should have earned credits but didn't
  FOR disclosure_record IN 
    SELECT dr.id, dr.uploaded_by_agent_id, ap.user_id as agent_user_id
    FROM disclosure_reports dr
    JOIN agent_profiles ap ON dr.uploaded_by_agent_id = ap.id
    WHERE dr.status = 'complete' 
    AND dr.uploaded_by_agent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM credit_transactions ct 
      WHERE ct.related_disclosure_id = dr.id 
      AND ct.transaction_type = 'disclosure_upload'
    )
  LOOP
    -- Update agent credit balance
    UPDATE agent_profiles 
    SET credit_balance = credit_balance + 10
    WHERE id = disclosure_record.uploaded_by_agent_id;
    
    -- Log the transaction
    PERFORM log_credit_transaction(
      disclosure_record.agent_user_id,
      disclosure_record.uploaded_by_agent_id,
      'disclosure_upload',
      10,
      'Earned credits for uploading disclosure (retroactive)',
      NULL,
      disclosure_record.id
    );
  END LOOP;
END $$;