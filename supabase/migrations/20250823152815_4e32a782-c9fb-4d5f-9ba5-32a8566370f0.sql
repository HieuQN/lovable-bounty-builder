-- Add RLS policy for agents to view their own showing requests
CREATE POLICY "Agents can view their own showing requests" 
ON public.showing_requests 
FOR SELECT 
USING (auth.uid() = (
  SELECT user_id FROM agent_profiles WHERE id = showing_requests.winning_agent_id
));