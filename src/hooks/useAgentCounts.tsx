import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useAgentCounts = () => {
  const [availableBountiesCount, setAvailableBountiesCount] = useState(0);
  const [showingRequestsCount, setShowingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCounts = async () => {
    if (!user) return;

    try {
      // Get available bounties count (status = 'open')
      const { count: bountiesCount, error: bountiesError } = await supabase
        .from('disclosure_bounties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      if (bountiesError) {
        console.error('Error fetching bounties count:', bountiesError);
      } else {
        setAvailableBountiesCount(bountiesCount || 0);
      }

      // Get showing requests available for bidding
      const { count: requestsCount, error: requestsError } = await supabase
        .from('showing_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'bidding')
        .gt('refund_deadline', new Date().toISOString());

      if (requestsError) {
        console.error('Error fetching showing requests count:', requestsError);
      } else {
        setShowingRequestsCount(requestsCount || 0);
      }
    } catch (error) {
      console.error('Error fetching agent counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCounts();

      // Set up real-time subscriptions for live updates
      const bountiesChannel = supabase
        .channel('bounties-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'disclosure_bounties',
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      const showingsChannel = supabase
        .channel('showings-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'showing_requests',
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(bountiesChannel);
        supabase.removeChannel(showingsChannel);
      };
    }
  }, [user]);

  return {
    availableBountiesCount,
    showingRequestsCount,
    loading,
    refetch: fetchCounts,
  };
};