-- Let's completely disable RLS for disclosure_reports table for demo purposes
-- This will allow all operations without any policy restrictions

ALTER TABLE public.disclosure_reports DISABLE ROW LEVEL SECURITY;