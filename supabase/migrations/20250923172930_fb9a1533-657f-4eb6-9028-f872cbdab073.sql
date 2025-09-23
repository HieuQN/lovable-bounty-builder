-- Check current allowed notification types and add missing ones
-- First, let's see what constraint exists
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.notifications'::regclass 
AND contype = 'c';

-- Add the missing notification types to the constraint
-- We need to drop and recreate the constraint with all needed types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all notification types we need
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'message', 
  'status_update', 
  'match',
  'bounty_available',
  'bounty_claimed', 
  'disclosure_complete',
  'bid_placed',
  'bid_won',
  'showing_confirmed',
  'showing_ready'
));