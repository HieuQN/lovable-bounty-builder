-- Fix the INSERT policy for disclosure_reports - the current one may be too restrictive
DROP POLICY IF EXISTS "Anyone can create disclosure reports for demo" ON public.disclosure_reports;

CREATE POLICY "Allow disclosure report creation for demo" 
ON public.disclosure_reports 
FOR INSERT 
WITH CHECK (true);

-- Also ensure we can insert without authentication constraints
-- Make uploaded_by_agent_id nullable for demo
ALTER TABLE public.disclosure_reports 
ALTER COLUMN uploaded_by_agent_id DROP NOT NULL;

-- Make requested_by_user_id nullable for demo  
ALTER TABLE public.disclosure_reports 
ALTER COLUMN requested_by_user_id DROP NOT NULL;