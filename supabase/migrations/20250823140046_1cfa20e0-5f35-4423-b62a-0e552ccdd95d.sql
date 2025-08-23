-- Update RLS policy to allow anonymous bounty creation for demo
DROP POLICY IF EXISTS "Users can create bounties" ON public.disclosure_bounties;

CREATE POLICY "Anyone can create bounties for demo" 
ON public.disclosure_bounties 
FOR INSERT 
WITH CHECK (true);

-- Also update the view policy to allow anyone to see open bounties
DROP POLICY IF EXISTS "Anyone can view open bounties" ON public.disclosure_bounties;

CREATE POLICY "Anyone can view bounties" 
ON public.disclosure_bounties 
FOR SELECT 
USING (true);