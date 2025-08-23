import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ShowingBidModal } from '@/components/ShowingBidModal';
import { Coins, MapPin, Calendar, Upload, LogOut, Clock, Gavel } from 'lucide-react';

interface AgentDashboardProps {
  onLogout?: () => void;
}

interface Bounty {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  claim_expiration?: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

interface ShowingRequest {
  id: string;
  property_id: string;
  status: string;
  credits_spent: number;
  refund_deadline: string;
  created_at: string;
  preferred_dates: any;
  preferred_times: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

const AgentDashboard = ({ onLogout }: AgentDashboardProps) => {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [claimedBounties, setClaimedBounties] = useState<Bounty[]>([]);
  const [showingRequests, setShowingRequests] = useState<ShowingRequest[]>([]);
  const [selectedShowingRequest, setSelectedShowingRequest] = useState<ShowingRequest | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Mock agent profile data (since we removed auth)
  const agentProfile = {
    id: "agent-123",
    creditBalance: 150,
    licenseNumber: "RE-12345-CT",
    brokerageName: "Premier Realty Group"
  };

  useEffect(() => {
    fetchBounties();
    fetchShowingRequests();
  }, []);

  const fetchBounties = async () => {
    try {
      // Fetch open bounties
      const { data: openBounties, error: openError } = await supabase
        .from('disclosure_bounties')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (openError) throw openError;

      // Fetch claimed bounties (mock data since we don't have agent auth)
      const { data: claimedData, error: claimedError } = await supabase
        .from('disclosure_bounties')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('status', 'claimed')
        .order('created_at', { ascending: false });

      if (claimedError) throw claimedError;

      setBounties(openBounties || []);
      setClaimedBounties(claimedData || []);
    } catch (error) {
      console.error('Error fetching bounties:', error);
      toast({
        title: "Error",
        description: "Failed to load bounties",
        variant: "destructive",
      });
    }
  };

  const fetchShowingRequests = async () => {
    try {
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
        .gt('refund_deadline', new Date().toISOString())
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

  const claimBounty = async (bountyId: string) => {
    try {
      console.log('Claiming bounty:', bountyId);
      
      const claimExpiration = new Date();
      claimExpiration.setHours(claimExpiration.getHours() + 2);

      const { data, error } = await supabase
        .from('disclosure_bounties')
        .update({
          status: 'claimed',
          claim_expiration: claimExpiration.toISOString(),
          // In real app, would set claimed_by_agent_id to current agent
        })
        .eq('id', bountyId)
        .eq('status', 'open') // Ensure it's still open
        .select(); // Return the updated data to verify

      if (error) {
        console.error('Error claiming bounty:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Bounty may have already been claimed by another agent');
      }

      console.log('Bounty claimed successfully:', data[0]);

      toast({
        title: "Bounty Claimed!",
        description: "You have 2 hours to upload the disclosure documents.",
      });

      // Navigate to upload page while maintaining login state
      window.location.href = `/upload/${bountyId}`;
    } catch (error: any) {
      console.error('Error claiming bounty:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to claim bounty. It may have been claimed by another agent.",
        variant: "destructive",
      });
      // Refresh the bounties list
      fetchBounties();
    }
  };

  const formatTimeRemaining = (claimExpiration: string) => {
    const now = new Date();
    const expiry = new Date(claimExpiration);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const handleBidOnShowing = (showingRequest: ShowingRequest) => {
    setSelectedShowingRequest(showingRequest);
    setIsBidModalOpen(true);
  };

  const handleBidSuccess = () => {
    fetchShowingRequests(); // Refresh showing requests
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Agent Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Agent Dashboard</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>License: {agentProfile.licenseNumber}</span>
                <span>•</span>
                <span>{agentProfile.brokerageName}</span>
              </div>
            </div>
            {onLogout && (
              <Button variant="outline" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>

          {/* Credit Balance Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                Credit Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {agentProfile.creditBalance} Credits
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Earn 10 credits for each completed disclosure upload
              </p>
            </CardContent>
          </Card>

          {/* Claimed Bounties */}
          {claimedBounties.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">My Active Claims</h2>
              <div className="grid gap-4">
                {claimedBounties.map((bounty) => (
                  <Card key={bounty.id} className="border-orange-200 bg-orange-50/50">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {bounty.properties?.full_address}
                          </CardTitle>
                          <CardDescription>
                            {bounty.properties?.city}, {bounty.properties?.state}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">Claimed</Badge>
                          {bounty.claim_expiration && (
                            <p className="text-sm text-orange-600 mt-1">
                              {formatTimeRemaining(bounty.claim_expiration)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => navigate(`/upload/${bounty.id}`)}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Disclosure
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator className="my-8" />
            </div>
          )}

          {/* Available Work Tabs */}
          <Tabs defaultValue="bounties" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bounties" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Disclosure Bounties
              </TabsTrigger>
              <TabsTrigger value="showings" className="flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Showing Requests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bounties" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Available Bounties</h2>
              
              {bounties.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No bounties available</h3>
                      <p className="text-muted-foreground">
                        Check back later for new disclosure requests in your area
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bounties.map((bounty) => (
                    <Card key={bounty.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {bounty.properties?.full_address}
                            </CardTitle>
                            <CardDescription>
                              {bounty.properties?.city}, {bounty.properties?.state}
                            </CardDescription>
                          </div>
                          <Badge variant="default">{bounty.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Posted: {new Date(bounty.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-sm font-medium text-green-600">
                            <Coins className="w-4 h-4 mr-2" />
                            Earn 10 Credits
                          </div>
                          <Button 
                            onClick={() => claimBounty(bounty.id)}
                            className="w-full"
                          >
                            Claim Bounty
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="showings" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Showing Requests</h2>
              
              {showingRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No showing requests</h3>
                      <p className="text-muted-foreground">
                        Check back later for new showing requests in your area
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {showingRequests.map((request) => (
                    <Card key={request.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {request.properties?.full_address}
                            </CardTitle>
                            <CardDescription>
                              {request.properties?.city}, {request.properties?.state}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">Open for Bids</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Posted: {new Date(request.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-sm text-orange-600">
                            <Clock className="w-4 h-4 mr-2" />
                            {formatTimeRemaining(request.refund_deadline)}
                          </div>
                          <div className="flex items-center text-sm font-medium text-green-600">
                            <Coins className="w-4 h-4 mr-2" />
                            Earn {request.credits_spent} Credits
                          </div>
                          <Button 
                            onClick={() => handleBidOnShowing(request)}
                            className="w-full"
                          >
                            <Gavel className="w-4 h-4 mr-2" />
                            Bid on Showing
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Showing Bid Modal */}
      {selectedShowingRequest && (
        <ShowingBidModal
          showingRequest={selectedShowingRequest}
          agentId={agentProfile.id}
          isOpen={isBidModalOpen}
          onClose={() => {
            setIsBidModalOpen(false);
            setSelectedShowingRequest(null);
          }}
          onBidSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
};

export default AgentDashboard;