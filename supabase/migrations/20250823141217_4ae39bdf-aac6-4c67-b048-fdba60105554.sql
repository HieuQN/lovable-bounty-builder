-- Check and fix RLS policies for disclosure_bounties UPDATE operations
DROP POLICY IF EXISTS "Agents can update bounties they claimed" ON public.disclosure_bounties;

CREATE POLICY "Anyone can update bounties for demo" 
ON public.disclosure_bounties 
FOR UPDATE 
USING (true);