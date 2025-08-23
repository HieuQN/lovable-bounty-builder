import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ShowingBidModal } from '@/components/ShowingBidModal';
import { UploadDisclosureModal } from '@/components/UploadDisclosureModal';
import { Coins, MapPin, Calendar, Upload, LogOut, Clock, Gavel, FileText, Eye, Download } from 'lucide-react';

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

interface DisclosureReport {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  report_summary_basic: string;
  raw_pdf_url?: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

interface UpcomingShowing {
  id: string;
  property_id: string;
  status: string;
  winning_bid_amount?: number;
  selected_time_slot?: string;
  created_at: string;
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
  const { user } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [claimedBounties, setClaimedBounties] = useState<Bounty[]>([]);
  const [showingRequests, setShowingRequests] = useState<ShowingRequest[]>([]);
  const [myDisclosures, setMyDisclosures] = useState<DisclosureReport[]>([]);
  const [upcomingShowings, setUpcomingShowings] = useState<UpcomingShowing[]>([]);
  const [selectedShowingRequest, setSelectedShowingRequest] = useState<ShowingRequest | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Fetch all data in parallel for faster loading
      Promise.all([
        fetchAgentProfile(),
        fetchBounties(),
        fetchShowingRequests(),
        fetchMyDisclosures(),
        fetchUpcomingShowings()
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [user]);

  const fetchAgentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setAgentProfile(data);
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      // Use fallback data if no profile exists
      setAgentProfile({
        id: user?.id,
        credit_balance: 150,
        license_number: "RE-12345-DEMO",
        brokerage_name: "Demo Realty Group"
      });
    }
  };

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
    }
  };

  const fetchMyDisclosures = async () => {
    try {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!agentProfile) return;

      const { data, error } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('uploaded_by_agent_id', agentProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyDisclosures(data || []);
    } catch (error) {
      console.error('Error fetching disclosures:', error);
    }
  };

  const fetchUpcomingShowings = async () => {
    try {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user?.id)
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
          )
        `)
        .eq('winning_agent_id', agentProfile.id)
        .in('status', ['awarded', 'confirmed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpcomingShowings(data || []);
    } catch (error) {
      console.error('Error fetching upcoming showings:', error);
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
    fetchUpcomingShowings(); // Refresh upcoming showings
    fetchAgentProfile(); // Refresh credit balance
  };

  const handleUploadSuccess = () => {
    fetchMyDisclosures(); // Refresh uploaded disclosures
    fetchAgentProfile(); // Refresh credit balance
  };

  const downloadDisclosure = (url: string, propertyAddress: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `disclosure-${propertyAddress.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                <span>License: {agentProfile?.license_number || 'N/A'}</span>
                <span>•</span>
                <span>{agentProfile?.brokerage_name || 'N/A'}</span>
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
                {agentProfile?.credit_balance || 0} Credits
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
          <Tabs defaultValue="disclosures" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="disclosures" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                My Disclosures
              </TabsTrigger>
              <TabsTrigger value="showings" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming Showings
              </TabsTrigger>
              <TabsTrigger value="bounties" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Disclosure Bounties
              </TabsTrigger>
              <TabsTrigger value="showing-bids" className="flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Showing Requests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="disclosures" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Uploaded Disclosures</h2>
                <Button onClick={() => setIsUploadModalOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload New Disclosure
                </Button>
              </div>
              
              {myDisclosures.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No disclosures uploaded yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Upload disclosure documents to earn credits and build your portfolio
                      </p>
                      <Button onClick={() => setIsUploadModalOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Your First Disclosure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myDisclosures.map((disclosure) => (
                    <Card key={disclosure.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {disclosure.properties?.full_address}
                            </CardTitle>
                            <CardDescription>
                              {disclosure.properties?.city}, {disclosure.properties?.state}
                            </CardDescription>
                          </div>
                          <Badge variant={disclosure.status === 'complete' ? 'default' : 'secondary'}>
                            {disclosure.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="text-sm text-muted-foreground">
                            <p>{disclosure.report_summary_basic}</p>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Uploaded: {new Date(disclosure.created_at).toLocaleDateString()}
                          </div>
                          {disclosure.status === 'complete' && (
                            <div className="flex items-center text-sm font-medium text-green-600">
                              <Coins className="w-4 h-4 mr-2" />
                              Earned 10 Credits
                            </div>
                          )}
                          <div className="flex gap-2">
                            {disclosure.raw_pdf_url && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => downloadDisclosure(disclosure.raw_pdf_url!, disclosure.properties?.full_address || 'property')}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="showings" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Upcoming Showings</h2>
              
              {upcomingShowings.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No upcoming showings</h3>
                      <p className="text-muted-foreground">
                        Win showing bids to see your upcoming appointments here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingShowings.map((showing) => (
                    <Card key={showing.id} className="hover:shadow-lg transition-shadow border-blue-200 bg-blue-50/50">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {showing.properties?.full_address}
                            </CardTitle>
                            <CardDescription>
                              {showing.properties?.city}, {showing.properties?.state}
                            </CardDescription>
                          </div>
                          <Badge variant="default">{showing.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Won on: {new Date(showing.created_at).toLocaleDateString()}
                          </div>
                          {showing.selected_time_slot && (
                            <div className="flex items-center text-sm font-medium text-blue-600">
                              <Clock className="w-4 h-4 mr-2" />
                              {showing.selected_time_slot}
                            </div>
                          )}
                          {showing.winning_bid_amount && (
                            <div className="flex items-center text-sm text-orange-600">
                              <Coins className="w-4 h-4 mr-2" />
                              Paid: {showing.winning_bid_amount} Credits
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="bounties" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Available Disclosure Bounties</h2>
              
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

            <TabsContent value="showing-bids" className="mt-6">
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

      {/* Upload Disclosure Modal */}
      <UploadDisclosureModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Showing Bid Modal */}
      {selectedShowingRequest && (
        <ShowingBidModal
          showingRequest={selectedShowingRequest}
          agentId={agentProfile?.id || user?.id || 'fallback-id'}
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