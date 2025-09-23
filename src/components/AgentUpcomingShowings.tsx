import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Calendar, MapPin, Clock, MessageCircle, CheckCircle } from 'lucide-react';
import { ShowingChatModal } from './ShowingChatModal';

interface UpcomingShowing {
  id: string;
  property_id: string;
  status: string;
  confirmation_status: string;
  agent_confirmed_at: string | null;
  buyer_confirmed_at: string | null;
  selected_time_slot: string;
  created_at: string;
  winning_agent_id: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
  profiles?: {
    first_name: string;
    email: string;
  };
}

const AgentUpcomingShowings = () => {
  const [upcomingShowings, setUpcomingShowings] = useState<UpcomingShowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShowing, setSelectedShowing] = useState<UpcomingShowing | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetchUpcomingShowings();
  }, []);

  const fetchUpcomingShowings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agentProfile) return;

      const { data, error } = await supabase
        .from('showing_requests')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          ),
          profiles!showing_requests_requested_by_user_id_fkey (
            first_name,
            email
          )
        `)
        .eq('winning_agent_id', agentProfile.id)
        .eq('status', 'awarded')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpcomingShowings((data as any) || []);
    } catch (error) {
      console.error('Error fetching upcoming showings:', error);
      toast({
        title: "Error",
        description: "Failed to load upcoming showings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmShowing = async (showingId: string) => {
    try {
      const { error } = await supabase
        .from('showing_requests')
        .update({ 
          agent_confirmed_at: new Date().toISOString()
        })
        .eq('id', showingId);

      if (error) throw error;

      toast({
        title: "Showing Confirmed",
        description: "You have confirmed the showing",
      });

      fetchUpcomingShowings();
    } catch (error) {
      console.error('Error confirming showing:', error);
      toast({
        title: "Error",
        description: "Failed to confirm showing",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upcoming Showings</h1>
        <p className="text-muted-foreground">
          Manage your scheduled property showings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcomingShowings.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No upcoming showings</h3>
                <p className="text-muted-foreground">Your confirmed showings will appear here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          upcomingShowings.map((showing) => (
            <Card key={showing.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg mb-1">
                      {showing.properties?.full_address || 'Property Address'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {showing.properties?.city}, {showing.properties?.state}
                    </CardDescription>
                  </div>
                  <Badge variant={showing.confirmation_status === 'both_confirmed' ? 'default' : 'secondary'}>
                    {showing.confirmation_status === 'both_confirmed' ? 'Confirmed' : 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm">
                    <strong>Client:</strong> {showing.profiles?.first_name || showing.profiles?.email}
                  </div>
                  {showing.selected_time_slot && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{showing.selected_time_slot}</span>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Requested: {new Date(showing.created_at).toLocaleDateString()}
                  </div>
                  
                  <div className="flex gap-2">
                    {!showing.agent_confirmed_at && (
                      <Button 
                        onClick={() => confirmShowing(showing.id)}
                        size="sm"
                        variant="default"
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm
                      </Button>
                    )}
                    <Button 
                      onClick={() => {
                        setSelectedShowing(showing);
                        setShowChatModal(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showChatModal && selectedShowing && (
        <ShowingChatModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          showingRequest={selectedShowing}
        />
      )}
    </div>
  );
};

export default AgentUpcomingShowings;