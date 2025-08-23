-- Create an agent profile for the current demo user if it doesn't exist
INSERT INTO public.agent_profiles (user_id, credit_balance, license_number, brokerage_name)
SELECT '90701ac5-6659-4275-ab98-5ec070750f42', 100, 'DEMO123456', 'Demo Real Estate Agency'
WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_profiles 
  WHERE user_id = '90701ac5-6659-4275-ab98-5ec070750f42'
);

-- Create missing triggers that don't exist yet
-- Handle showing bid insert trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'handle_showing_bid_insert_trigger'
  ) THEN
    CREATE TRIGGER handle_showing_bid_insert_trigger
      BEFORE INSERT ON public.showing_bids
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_showing_bid_insert();
  END IF;
END $$;

-- Update confirmation status trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_confirmation_status_trigger'
  ) THEN
    CREATE TRIGGER update_confirmation_status_trigger
      BEFORE INSERT OR UPDATE ON public.showing_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.update_confirmation_status();
  END IF;
END $$;