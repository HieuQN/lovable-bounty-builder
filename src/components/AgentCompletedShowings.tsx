import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Calendar, MapPin, Clock, MessageCircle, Star } from 'lucide-react';
import { ShowingChatModal } from './ShowingChatModal';

interface CompletedShowing {
  id: string;
  property_id: string;
  status: string;
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

const AgentCompletedShowings = () => {
  const [completedShowings, setCompletedShowings] = useState<CompletedShowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShowing, setSelectedShowing] = useState<CompletedShowing | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetchCompletedShowings();
  }, []);

  const fetchCompletedShowings = async () => {
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
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompletedShowings((data as any) || []);
    } catch (error) {
      console.error('Error fetching completed showings:', error);
      toast({
        title: "Error",
        description: "Failed to load completed showings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold mb-2">Completed Showings</h1>
        <p className="text-muted-foreground">
          View your completed property showings history
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {completedShowings.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed showings</h3>
                <p className="text-muted-foreground">Your completed showings will appear here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          completedShowings.map((showing) => (
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
                  <Badge variant="default">Completed</Badge>
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
                    Completed: {new Date(showing.created_at).toLocaleDateString()}
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setSelectedShowing(showing);
                      setShowChatModal(true);
                    }}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    View Chat History
                  </Button>
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

export default AgentCompletedShowings;