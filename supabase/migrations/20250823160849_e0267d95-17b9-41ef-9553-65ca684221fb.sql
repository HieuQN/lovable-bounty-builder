-- Create the missing disclosure credits trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_agent_credits_on_disclosure_trigger'
  ) THEN
    CREATE TRIGGER update_agent_credits_on_disclosure_trigger
      AFTER INSERT OR UPDATE ON public.disclosure_reports
      FOR EACH ROW
      EXECUTE FUNCTION public.update_agent_credits_on_disclosure();
  END IF;
END $$;