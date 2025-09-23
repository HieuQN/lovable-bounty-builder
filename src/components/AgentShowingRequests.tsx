import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Calendar, MapPin, DollarSign, Clock } from 'lucide-react';
import { ShowingBidModal } from './ShowingBidModal';

interface ShowingRequest {
  id: string;
  property_id: string;
  status: string;
  current_high_bid: number;
  created_at: string;
  preferred_dates: any;
  preferred_times: string;
  refund_deadline: string;
  credits_spent: number;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

const AgentShowingRequests = () => {
  const [showingRequests, setShowingRequests] = useState<ShowingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ShowingRequest | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);

  useEffect(() => {
    fetchShowingRequests();
  }, []);

  const [agentId, setAgentId] = useState<string>('');

  const fetchShowingRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agent profile
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (agentProfile) {
        setAgentId(agentProfile.id);
      }

      const { data, error } = await supabase
        .from('showing_requests')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('status', 'bidding')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShowingRequests(data || []);
    } catch (error) {
      console.error('Error fetching showing requests:', error);
      toast({
        title: "Error",
        description: "Failed to load showing requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBidSuccess = () => {
    setShowBidModal(false);
    setSelectedRequest(null);
    fetchShowingRequests();
    toast({
      title: "Bid Placed",
      description: "Your bid has been submitted successfully",
    });
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
        <h1 className="text-3xl font-bold mb-2">Showing Requests</h1>
        <p className="text-muted-foreground">
          Browse and bid on available showing requests
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showingRequests.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No showing requests available</h3>
                <p className="text-muted-foreground">Check back later for new opportunities</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          showingRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg mb-1">
                      {request.properties?.full_address || 'Property Address'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {request.properties?.city}, {request.properties?.state}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Open</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span>Current High Bid: ${request.current_high_bid}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Posted: {new Date(request.created_at).toLocaleDateString()}</span>
                  </div>
                  {request.preferred_times && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Preferred Times:</strong> {request.preferred_times}
                    </div>
                  )}
                  <Button 
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowBidModal(true);
                    }}
                    className="w-full"
                    size="sm"
                  >
                    Place Bid
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showBidModal && selectedRequest && (
        <ShowingBidModal
          isOpen={showBidModal}
          onClose={() => setShowBidModal(false)}
          showingRequest={selectedRequest}
          agentId={agentId}
          onBidSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
};

export default AgentShowingRequests;