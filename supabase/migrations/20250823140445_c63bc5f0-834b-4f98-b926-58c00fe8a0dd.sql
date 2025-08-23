-- Fix RLS policies for disclosure reports to allow public read access for demo
DROP POLICY IF EXISTS "Users can view reports they requested or uploaded" ON public.disclosure_reports;

CREATE POLICY "Anyone can view complete reports" 
ON public.disclosure_reports 
FOR SELECT 
USING (status = 'complete');

-- Also allow anyone to create reports for demo purposes  
DROP POLICY IF EXISTS "Agents can create disclosure reports" ON public.disclosure_reports;

CREATE POLICY "Anyone can create disclosure reports for demo" 
ON public.disclosure_reports 
FOR INSERT 
WITH CHECK (true);

-- Allow updates for processing
DROP POLICY IF EXISTS "Agents can update their own reports" ON public.disclosure_reports;

CREATE POLICY "Anyone can update reports for demo" 
ON public.disclosure_reports 
FOR UPDATE 
USING (true);