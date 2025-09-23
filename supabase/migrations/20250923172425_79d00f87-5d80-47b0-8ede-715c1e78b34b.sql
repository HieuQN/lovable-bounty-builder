-- Create trigger for bounty creation notifications
CREATE OR REPLACE FUNCTION public.notify_bounty_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
BEGIN
  -- Get property address
  SELECT p.street_address INTO property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Notify all agents about the new bounty
  INSERT INTO public.notifications (user_id, message, type, url)
  SELECT ap.user_id,
         'New disclosure bounty available for ' || COALESCE(property_address, 'a property'),
         'bounty_available',
         '/agent-dashboard?tab=bounties'
  FROM agent_profiles ap;

  RETURN NEW;
END;
$function$;

-- Create trigger for disclosure analysis completion
CREATE OR REPLACE FUNCTION public.notify_disclosure_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
  buyer_user_id UUID;
BEGIN
  -- Only notify when status changes to complete
  IF OLD.status != 'complete' AND NEW.status = 'complete' THEN
    -- Get property address and buyer
    SELECT p.street_address, db.requested_by_user_id 
    INTO property_address, buyer_user_id
    FROM properties p
    JOIN disclosure_bounties db ON db.property_id = p.id
    WHERE p.id = NEW.property_id;

    -- Notify the buyer who requested the disclosure
    IF buyer_user_id IS NOT NULL THEN
      PERFORM create_notification(
        buyer_user_id,
        'Disclosure analysis complete for ' || COALESCE(property_address, 'your property') || '. View your report now!',
        'disclosure_complete',
        '/buyer-dashboard?tab=purchased'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for showing bid notifications
CREATE OR REPLACE FUNCTION public.notify_showing_bid_placed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
  buyer_user_id UUID;
BEGIN
  -- Get property address and buyer
  SELECT p.street_address, sr.requested_by_user_id
  INTO property_address, buyer_user_id
  FROM properties p
  JOIN showing_requests sr ON sr.property_id = p.id
  WHERE sr.id = NEW.showing_request_id;

  -- Notify buyer about new bid
  PERFORM create_notification(
    buyer_user_id,
    'New bid placed for your showing request at ' || COALESCE(property_address, 'the property'),
    'bid_placed',
    '/buyer-dashboard?tab=upcoming'
  );

  RETURN NEW;
END;
$function$;

-- Create trigger for bounty claimed notifications
CREATE OR REPLACE FUNCTION public.notify_bounty_claimed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
BEGIN
  -- Only notify when bounty status changes to claimed
  IF OLD.status != 'claimed' AND NEW.status = 'claimed' THEN
    -- Get property address
    SELECT p.street_address INTO property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notify the requesting buyer if there is one
    IF NEW.requested_by_user_id IS NOT NULL THEN
      PERFORM create_notification(
        NEW.requested_by_user_id,
        'An agent has claimed the disclosure bounty for ' || COALESCE(property_address, 'your property') || '. Disclosure analysis in progress.',
        'bounty_claimed',
        '/buyer-dashboard?tab=available'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create enhanced showing confirmation notifications
CREATE OR REPLACE FUNCTION public.notify_showing_confirmation_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
  agent_user_id UUID;
BEGIN
  -- Get property address and agent user ID
  SELECT p.street_address, ap.user_id
  INTO property_address, agent_user_id
  FROM properties p
  JOIN agent_profiles ap ON ap.id = NEW.winning_agent_id
  WHERE p.id = NEW.property_id;

  -- Notify when buyer confirms
  IF OLD.buyer_confirmed_at IS NULL AND NEW.buyer_confirmed_at IS NOT NULL THEN
    IF agent_user_id IS NOT NULL THEN
      PERFORM create_notification(
        agent_user_id,
        'Buyer confirmed showing for ' || COALESCE(property_address, 'the property') || '. You can now message them.',
        'showing_confirmed',
        '/agent-dashboard?tab=messages&showing=' || NEW.id
      );
    END IF;
  END IF;

  -- Notify when agent confirms
  IF OLD.agent_confirmed_at IS NULL AND NEW.agent_confirmed_at IS NOT NULL THEN
    PERFORM create_notification(
      NEW.requested_by_user_id,
      'Agent confirmed showing for ' || COALESCE(property_address, 'the property') || '. You can now message them.',
      'showing_confirmed',
      '/buyer-dashboard?showing=' || NEW.id
    );
  END IF;

  -- Notify when both confirm (showing is fully confirmed)
  IF NEW.confirmation_status = 'both_confirmed' AND 
     (OLD.confirmation_status IS NULL OR OLD.confirmation_status != 'both_confirmed') THEN
    
    -- Notify buyer
    PERFORM create_notification(
      NEW.requested_by_user_id,
      'Showing confirmed! You and your agent are connected for ' || COALESCE(property_address, 'the property'),
      'showing_ready',
      '/buyer-dashboard?showing=' || NEW.id
    );
    
    -- Notify agent
    IF agent_user_id IS NOT NULL THEN
      PERFORM create_notification(
        agent_user_id,
        'Showing confirmed! You and the buyer are connected for ' || COALESCE(property_address, 'the property'),
        'showing_ready',
        '/agent-dashboard?tab=messages&showing=' || NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the existing showing status change trigger to be more comprehensive
DROP TRIGGER IF EXISTS showing_status_change_trigger ON showing_requests;
CREATE OR REPLACE FUNCTION public.notify_showing_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
  agent_user_id UUID;
BEGIN
  -- Get property address
  SELECT p.street_address INTO property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Notify on status changes to awarded
  IF OLD.status != 'awarded' AND NEW.status = 'awarded' THEN
    -- Notify the buyer
    PERFORM create_notification(
      NEW.requested_by_user_id,
      'Your showing request for ' || COALESCE(property_address, 'the property') || ' has been accepted! Please confirm to connect with your agent.',
      'status_update',
      '/buyer-dashboard?tab=upcoming'
    );

    -- Notify the winning agent
    SELECT ap.user_id INTO agent_user_id
    FROM agent_profiles ap
    WHERE ap.id = NEW.winning_agent_id;
    
    IF agent_user_id IS NOT NULL THEN
      PERFORM create_notification(
        agent_user_id,
        'Congratulations! You won the showing bid for ' || COALESCE(property_address, 'the property') || '. Please confirm to connect with the buyer.',
        'bid_won',
        '/agent-dashboard?tab=upcoming-showings'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create all the triggers
CREATE TRIGGER bounty_created_trigger
  AFTER INSERT ON disclosure_bounties
  FOR EACH ROW
  EXECUTE FUNCTION notify_bounty_created();

CREATE TRIGGER bounty_claimed_trigger
  AFTER UPDATE ON disclosure_bounties
  FOR EACH ROW
  EXECUTE FUNCTION notify_bounty_claimed();

CREATE TRIGGER disclosure_complete_trigger
  AFTER UPDATE ON disclosure_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_disclosure_complete();

CREATE TRIGGER showing_bid_placed_trigger
  AFTER INSERT ON showing_bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_showing_bid_placed();

CREATE TRIGGER showing_confirmation_trigger
  AFTER UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_showing_confirmation_updates();

CREATE TRIGGER showing_status_change_trigger
  AFTER UPDATE ON showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_showing_status_change();