-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'request', 'status_update', 'match')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_notifications_user_id_created_at ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_id_unread ON public.notifications (user_id) WHERE is_read = false;

-- Add trigger for updated_at
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_message TEXT,
  p_type TEXT,
  p_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, message, type, url)
  VALUES (p_user_id, p_message, p_type, p_url)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  showing_address TEXT;
BEGIN
  -- Determine recipient based on sender type
  IF NEW.sender_type = 'buyer' THEN
    -- Message from buyer to agent
    SELECT ap.user_id INTO recipient_id
    FROM showing_requests sr
    JOIN agent_profiles ap ON ap.id = sr.winning_agent_id
    WHERE sr.id = NEW.showing_request_id;
  ELSE
    -- Message from agent to buyer
    SELECT sr.requested_by_user_id INTO recipient_id
    FROM showing_requests sr
    WHERE sr.id = NEW.showing_request_id;
  END IF;

  -- Get property address for context
  SELECT p.street_address INTO showing_address
  FROM showing_requests sr
  JOIN properties p ON p.id = sr.property_id
  WHERE sr.id = NEW.showing_request_id;

  -- Get sender name
  SELECT COALESCE(p.first_name, 'User') INTO sender_name
  FROM profiles p
  WHERE p.user_id = NEW.sender_id;

  -- Create notification
  IF recipient_id IS NOT NULL THEN
    PERFORM create_notification(
      recipient_id,
      sender_name || ' sent you a message about ' || COALESCE(showing_address, 'the property'),
      'message',
      '/buyer-dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for new messages
CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON public.showing_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- Trigger function for showing status updates
CREATE OR REPLACE FUNCTION public.notify_showing_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_address TEXT;
BEGIN
  -- Only notify on status changes to awarded
  IF OLD.status != 'awarded' AND NEW.status = 'awarded' THEN
    -- Get property address
    SELECT p.street_address INTO property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notify the buyer
    PERFORM create_notification(
      NEW.requested_by_user_id,
      'Your showing request for ' || COALESCE(property_address, 'the property') || ' has been accepted!',
      'status_update',
      '/buyer-dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for showing status changes
CREATE TRIGGER trigger_notify_showing_status_change
AFTER UPDATE ON public.showing_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_showing_status_change();

-- Trigger function for new showing requests (notify agents)
CREATE OR REPLACE FUNCTION public.notify_new_showing_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_rec RECORD;
  property_address TEXT;
BEGIN
  -- Get property address
  SELECT p.street_address INTO property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Notify all agents about the new showing request
  FOR agent_rec IN
    SELECT ap.user_id
    FROM agent_profiles ap
  LOOP
    PERFORM create_notification(
      agent_rec.user_id,
      'New showing request available for ' || COALESCE(property_address, 'a property'),
      'match',
      '/agent-dashboard'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for new showing requests
CREATE TRIGGER trigger_notify_new_showing_request
AFTER INSERT ON public.showing_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_showing_request();