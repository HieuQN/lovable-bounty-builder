-- Ensure completed reports are publicly viewable (no login required)
DROP POLICY IF EXISTS "Users can view completed reports" ON public.disclosure_reports;

CREATE POLICY "Users can view completed reports"
ON public.disclosure_reports
FOR SELECT
TO public
USING (
  status = 'complete'::report_status OR
  uploaded_by_agent_id IN (
    SELECT ap.id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
  )
);