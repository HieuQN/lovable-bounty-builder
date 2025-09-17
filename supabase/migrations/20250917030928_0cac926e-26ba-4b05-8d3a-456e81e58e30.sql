-- Add chat functionality for showing communications
CREATE TABLE public.showing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showing_request_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('buyer', 'agent')),
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.showing_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for showing messages
CREATE POLICY "Users can view messages for their showings"
ON public.showing_messages
FOR SELECT
USING (
  -- Buyers can see messages for their showing requests
  (sender_type = 'buyer' AND sender_id = auth.uid()) OR
  (showing_request_id IN (
    SELECT id FROM public.showing_requests 
    WHERE requested_by_user_id = auth.uid()
  )) OR
  -- Agents can see messages for showings they won
  (sender_type = 'agent' AND sender_id = auth.uid()) OR
  (showing_request_id IN (
    SELECT sr.id FROM public.showing_requests sr
    JOIN public.agent_profiles ap ON ap.id = sr.winning_agent_id
    WHERE ap.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can send messages for their showings"
ON public.showing_messages
FOR INSERT
WITH CHECK (
  -- Buyers can send messages for their own showing requests
  (sender_type = 'buyer' AND sender_id = auth.uid() AND
   showing_request_id IN (
     SELECT id FROM public.showing_requests 
     WHERE requested_by_user_id = auth.uid()
   )) OR
  -- Agents can send messages for showings they won
  (sender_type = 'agent' AND sender_id = auth.uid() AND
   showing_request_id IN (
     SELECT sr.id FROM public.showing_requests sr
     JOIN public.agent_profiles ap ON ap.id = sr.winning_agent_id
     WHERE ap.user_id = auth.uid()
   ))
);

-- Create trigger for updated_at
CREATE TRIGGER update_showing_messages_updated_at
BEFORE UPDATE ON public.showing_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime support
ALTER TABLE public.showing_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.showing_messages;

-- Add realtime support for showing_requests if not already added
ALTER TABLE public.showing_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
  -- Only add to publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'showing_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.showing_requests;
  END IF;
END $$;