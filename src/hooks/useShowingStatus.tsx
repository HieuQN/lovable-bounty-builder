import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShowingStatus {
  id: string;
  status: string;
  winning_agent_id?: string;
  winning_bid_amount?: number;
  confirmation_status?: string;
  agent_confirmed_at?: string;
  buyer_confirmed_at?: string;
}

export const useShowingStatus = (propertyId: string) => {
  const { user } = useAuth();
  const [showingStatus, setShowingStatus] = useState<ShowingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && propertyId) {
      fetchShowingStatus();
      setupRealtimeSubscription();
    }
  }, [user, propertyId]);

  const fetchShowingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('showing_requests')
        .select(`
          id,
          status,
          winning_agent_id,
          winning_bid_amount,
          confirmation_status,
          agent_confirmed_at,
          buyer_confirmed_at
        `)
        .eq('property_id', propertyId)
        .eq('requested_by_user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setShowingStatus(data);
    } catch (error) {
      console.error('Error fetching showing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('showing-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'showing_requests',
          filter: `property_id=eq.${propertyId}`
        },
        (payload) => {
          if (payload.new && (payload.new as any).requested_by_user_id === user?.id) {
            setShowingStatus(payload.new as ShowingStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getButtonState = () => {
    if (!showingStatus) {
      return {
        text: 'Request Showing',
        variant: 'outline' as const,
        disabled: false,
        canChat: false
      };
    }

    switch (showingStatus.status) {
      case 'bidding':
        return {
          text: 'Showing Requested - Waiting for Agents',
          variant: 'secondary' as const,
          disabled: true,
          canChat: false
        };
      case 'awarded':
        if (showingStatus.confirmation_status === 'both_confirmed') {
          return {
            text: 'Showing Confirmed',
            variant: 'default' as const,
            disabled: true,
            canChat: true
          };
        } else {
          return {
            text: 'Agent Matched - Awaiting Confirmation',
            variant: 'secondary' as const,
            disabled: true,
            canChat: true
          };
        }
      case 'completed':
        return {
          text: 'Showing Completed',
          variant: 'secondary' as const,
          disabled: true,
          canChat: true
        };
      case 'cancelled':
        return {
          text: 'Showing Cancelled',
          variant: 'destructive' as const,
          disabled: true,
          canChat: false
        };
      default:
        return {
          text: 'Request Showing',
          variant: 'outline' as const,
          disabled: false,
          canChat: false
        };
    }
  };

  return {
    showingStatus,
    loading,
    getButtonState,
    refresh: fetchShowingStatus
  };
};