-- Update RLS policy to allow viewing completed reports more broadly
DROP POLICY IF EXISTS "Users can view completed reports" ON disclosure_reports;

CREATE POLICY "Users can view completed reports" 
ON disclosure_reports 
FOR SELECT 
USING (
  status = 'complete' OR 
  (uploaded_by_agent_id IN (
    SELECT agent_profiles.id
    FROM agent_profiles
    WHERE agent_profiles.user_id = auth.uid()
  ))
);