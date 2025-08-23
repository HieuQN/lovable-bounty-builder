-- Add UPDATE policies for showing_requests to allow confirmations
CREATE POLICY "Agents can update their own showing confirmations" 
ON public.showing_requests 
FOR UPDATE 
USING (auth.uid() = (
  SELECT user_id FROM agent_profiles WHERE id = showing_requests.winning_agent_id
))
WITH CHECK (auth.uid() = (
  SELECT user_id FROM agent_profiles WHERE id = showing_requests.winning_agent_id
));

CREATE POLICY "Users can update their own showing confirmations" 
ON public.showing_requests 
FOR UPDATE 
USING (auth.uid() = showing_requests.requested_by_user_id)
WITH CHECK (auth.uid() = showing_requests.requested_by_user_id);