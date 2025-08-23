-- Make requested_by_user_id nullable for demo purposes since we don't have real users
ALTER TABLE public.disclosure_bounties 
ALTER COLUMN requested_by_user_id DROP NOT NULL;