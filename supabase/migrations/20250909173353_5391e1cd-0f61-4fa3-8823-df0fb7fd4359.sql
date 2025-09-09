-- Create test agent profile with email hieurekai@gmail.com
-- First insert the user profile
INSERT INTO public.profiles (user_id, email, first_name, user_type, credits)
VALUES (
  gen_random_uuid(),
  'hieurekai@gmail.com',
  'Test Agent',
  'Agent',
  0
) ON CONFLICT (email) DO NOTHING;

-- Then create the agent profile using the user_id
INSERT INTO public.agent_profiles (user_id, credit_balance, license_number, brokerage_name)
SELECT 
  p.user_id,
  50,
  'TEST123456',
  'Test Brokerage'
FROM public.profiles p
WHERE p.email = 'hieurekai@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_profiles ap 
    WHERE ap.user_id = p.user_id
  );