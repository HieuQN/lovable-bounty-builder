import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, CheckCircle, Users, MessageCircle } from 'lucide-react';
import { ShowingChatModal } from './ShowingChatModal';

interface ShowingStatusButtonProps {
  propertyId: string;
  onRequestShowing: () => void;
}

interface ShowingRequest {
  id: string;
  status: string;
  winning_agent_id: string | null;
  created_at: string;
  refund_deadline: string;
  agent_profiles?: {
    user_id: string;
    profile_bio: string;
  };
}

export const ShowingStatusButton = ({ propertyId, onRequestShowing }: ShowingStatusButtonProps) => {
  const { user } = useAuth();
  const [showingRequest, setShowingRequest] = useState<ShowingRequest | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    fetchShowingRequest();
    const unsubscribe = subscribeToUpdates();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, propertyId]);

  const fetchShowingRequest = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('showing_requests')
        .select(`
          *,
          agent_profiles!showing_requests_winning_agent_id_fkey (
            user_id,
            profile_bio
          )
        `)
        .eq('property_id', propertyId)
        .eq('requested_by_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setShowingRequest(data);
    } catch (error) {
      console.error('Error fetching showing request:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    if (!user) return;

    const channel = supabase
      .channel('showing-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'showing_requests',
          filter: `requested_by_user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Showing request update:', payload);
          fetchShowingRequest();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getButtonContent = () => {
    if (loading) {
      return {
        text: "Loading...",
        icon: <Clock className="w-4 h-4" />,
        variant: "outline" as const,
        disabled: true
      };
    }

    if (!showingRequest) {
      return {
        text: "Request Showing",
        icon: <Calendar className="w-4 h-4" />,
        variant: "outline" as const,
        disabled: false,
        onClick: onRequestShowing
      };
    }

    switch (showingRequest.status) {
      case 'bidding':
        const timeRemaining = new Date(showingRequest.refund_deadline).getTime() - new Date().getTime();
        const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));
        
        return {
          text: `Bidding (${hoursRemaining}h left)`,
          icon: <Clock className="w-4 h-4" />,
          variant: "secondary" as const,
          disabled: true
        };

      case 'awarded':
        return {
          text: "Agent Matched",
          icon: <Users className="w-4 h-4" />,
          variant: "default" as const,
          disabled: false,
          onClick: () => setIsChatOpen(true),
          showChat: true
        };

      case 'confirmed':
        return {
          text: "Showing Confirmed",
          icon: <CheckCircle className="w-4 h-4" />,
          variant: "default" as const,
          disabled: false,
          onClick: () => setIsChatOpen(true),
          showChat: true
        };

      default:
        return {
          text: "Request Showing",
          icon: <Calendar className="w-4 h-4" />,
          variant: "outline" as const,
          disabled: false,
          onClick: onRequestShowing
        };
    }
  };

  const buttonContent = getButtonContent();

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={buttonContent.variant}
          disabled={buttonContent.disabled}
          onClick={buttonContent.onClick}
          className="flex items-center gap-2"
        >
          {buttonContent.icon}
          {buttonContent.text}
        </Button>
        
        {buttonContent.showChat && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsChatOpen(true)}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        )}
      </div>

      {showingRequest && showingRequest.status === 'bidding' && (
        <div className="mt-2">
          <Badge variant="secondary" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Agents bidding until {new Date(showingRequest.refund_deadline).toLocaleTimeString()}
          </Badge>
        </div>
      )}

      {showingRequest && isChatOpen && (
        <ShowingChatModal
          showingRequest={showingRequest}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </>
  );
};