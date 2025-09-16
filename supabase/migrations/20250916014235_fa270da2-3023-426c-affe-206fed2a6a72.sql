-- Create storage bucket for disclosure uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('disclosure-uploads', 'disclosure-uploads', false);

-- Create storage policies for disclosure uploads
CREATE POLICY "Agents can upload disclosure files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'disclosure-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Agents can view their uploaded disclosure files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'disclosure-uploads' AND auth.uid() IS NOT NULL);

-- Create table for tracking disclosure upload jobs
CREATE TABLE public.disclosure_upload_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bounty_id UUID NOT NULL REFERENCES public.disclosure_bounties(id),
  agent_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.disclosure_upload_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for upload jobs
CREATE POLICY "Agents can view their own upload jobs" 
ON public.disclosure_upload_jobs 
FOR SELECT 
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create upload jobs" 
ON public.disclosure_upload_jobs 
FOR INSERT 
WITH CHECK (agent_id = auth.uid());

-- Create function to update upload job status
CREATE OR REPLACE FUNCTION public.update_upload_job_status(
  job_id UUID,
  new_status TEXT,
  error_msg TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.disclosure_upload_jobs 
  SET 
    status = new_status,
    completed_at = CASE WHEN new_status IN ('completed', 'failed') THEN now() ELSE completed_at END,
    error_message = error_msg
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;