-- Create analysis_logs table for persistent function logging
CREATE TABLE IF NOT EXISTS public.analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id UUID,
  report_id UUID,
  function_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message TEXT NOT NULL,
  context JSONB
);

-- Enable RLS
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate SELECT policies (Postgres doesn't support IF NOT EXISTS for policies)
DROP POLICY IF EXISTS "Users can view logs for their reports" ON public.analysis_logs;
CREATE POLICY "Users can view logs for their reports"
ON public.analysis_logs
FOR SELECT
TO authenticated
USING (
  report_id IN (
    SELECT dr.id FROM public.disclosure_reports dr
    JOIN public.agent_profiles ap ON dr.uploaded_by_agent_id = ap.id
    WHERE ap.user_id = auth.uid()
  )
  OR report_id IN (
    SELECT dr2.id FROM public.disclosure_reports dr2
    WHERE dr2.requested_by_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Agents can view logs by job linkage" ON public.analysis_logs;
CREATE POLICY "Agents can view logs by job linkage"
ON public.analysis_logs
FOR SELECT
TO authenticated
USING (
  job_id IN (
    SELECT j.id FROM public.disclosure_upload_jobs j
    JOIN public.agent_profiles ap2 ON j.agent_id = ap2.id
    WHERE ap2.user_id = auth.uid()
  )
);
