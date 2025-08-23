-- Create proper user signup flow with profile creation
-- This will handle both regular users and agents

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_type_val user_type;
BEGIN
  -- Determine user type based on email domain or metadata
  IF NEW.email LIKE '%agent%' OR (NEW.raw_user_meta_data->>'user_type') = 'Agent' THEN
    user_type_val := 'Agent';
  ELSE
    user_type_val := 'Buyer';
  END IF;

  -- Insert into profiles table
  INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    user_type,
    credits
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    user_type_val,
    CASE 
      WHEN user_type_val = 'Buyer' THEN 100  -- Give buyers 100 credits to start
      ELSE 0 
    END
  );

  -- If it's an agent, also create agent profile
  IF user_type_val = 'Agent' THEN
    INSERT INTO public.agent_profiles (
      user_id,
      credit_balance
    ) VALUES (
      NEW.id,
      50  -- Give agents 50 credits to start
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update existing function to ensure it can handle profile insertions
CREATE OR REPLACE FUNCTION public.create_profile_if_not_exists(user_id UUID, email TEXT, user_type_val user_type DEFAULT 'Buyer')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert profile if it doesn't exist
  INSERT INTO public.profiles (user_id, email, user_type, credits)
  VALUES (user_id, email, user_type_val, CASE WHEN user_type_val = 'Buyer' THEN 100 ELSE 0 END)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- If agent, create agent profile too
  IF user_type_val = 'Agent' THEN
    INSERT INTO public.agent_profiles (user_id, credit_balance)
    VALUES (user_id, 50)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;