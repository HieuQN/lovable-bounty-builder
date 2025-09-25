-- Fix RLS policies for disclosure_upload_jobs to use agent_profiles.id instead of auth.uid()
-- Drop incorrect policies if they exist
DROP POLICY IF EXISTS "Agents can view their own upload jobs" ON public.disclosure_upload_jobs;
DROP POLICY IF EXISTS "Agents can create upload jobs" ON public.disclosure_upload_jobs;

-- Recreate with correct logic: map auth.uid() -> agent_profiles.id
CREATE POLICY "Agents can view their own upload jobs"
ON public.disclosure_upload_jobs
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT ap.id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
  )
);

CREATE POLICY "Agents can create upload jobs"
ON public.disclosure_upload_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  agent_id IN (
    SELECT ap.id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
  )
);
