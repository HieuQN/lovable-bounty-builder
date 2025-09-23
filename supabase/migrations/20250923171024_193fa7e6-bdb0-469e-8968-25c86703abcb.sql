-- Update notification URLs to route agents to the correct dashboard with tab parameter
CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  showing_address TEXT;
  notification_url TEXT;
BEGIN
  -- Determine recipient based on sender type
  IF NEW.sender_type = 'buyer' THEN
    -- Message from buyer to agent
    SELECT ap.user_id INTO recipient_id
    FROM showing_requests sr
    JOIN agent_profiles ap ON ap.id = sr.winning_agent_id
    WHERE sr.id = NEW.showing_request_id;
    notification_url := '/agent-dashboard-new?tab=messages&showing=' || NEW.showing_request_id;
  ELSE
    -- Message from agent to buyer  
    SELECT sr.requested_by_user_id INTO recipient_id
    FROM showing_requests sr
    WHERE sr.id = NEW.showing_request_id;
    notification_url := '/buyer-dashboard?showing=' || NEW.showing_request_id;
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

  -- Create notification with showing-specific URL
  IF recipient_id IS NOT NULL THEN
    PERFORM create_notification(
      recipient_id,
      sender_name || ' sent you a message about ' || COALESCE(showing_address, 'the property'),
      'message',
      notification_url
    );
  END IF;

  RETURN NEW;
END;
$function$;