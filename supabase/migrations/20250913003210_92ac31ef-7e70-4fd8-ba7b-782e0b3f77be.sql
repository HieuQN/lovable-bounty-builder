-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow disclosure report creation for demo" ON disclosure_reports;
DROP POLICY IF EXISTS "Anyone can update reports for demo" ON disclosure_reports;
DROP POLICY IF EXISTS "Anyone can view complete reports" ON disclosure_reports;

-- Create proper RLS policies for disclosure reports
CREATE POLICY "Authenticated users can create disclosure reports" 
ON disclosure_reports 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Agents can update their own reports" 
ON disclosure_reports 
FOR UPDATE 
TO authenticated
USING (
  uploaded_by_agent_id IN (
    SELECT id FROM agent_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can view completed reports" 
ON disclosure_reports 
FOR SELECT 
TO authenticated
USING (status = 'complete' OR uploaded_by_agent_id IN (
  SELECT id FROM agent_profiles WHERE user_id = auth.uid()
));

CREATE POLICY "System can update any report for processing" 
ON disclosure_reports 
FOR UPDATE 
TO authenticated
WITH CHECK (true);