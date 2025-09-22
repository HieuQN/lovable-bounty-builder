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
import { ShowingChatModal } from '@/components/ShowingChatModal';
import { Coins, MapPin, Calendar, Upload, LogOut, Clock, Gavel, FileText, Eye, Download, CheckCircle, AlertCircle, MessageCircle, Bell } from 'lucide-react';
import NotificationDropdown from '@/components/NotificationDropdown';

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
  confirmation_status?: string;
  agent_confirmed_at?: string;
  buyer_confirmed_at?: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

interface CreditTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
  related_showing_id?: string;
  related_disclosure_id?: string;
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
  const [completedShowings, setCompletedShowings] = useState<UpcomingShowing[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [selectedShowingRequest, setSelectedShowingRequest] = useState<ShowingRequest | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedShowingForChat, setSelectedShowingForChat] = useState<UpcomingShowing | null>(null);
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
        fetchUpcomingShowings(),
        fetchCompletedShowings(),
        fetchCreditTransactions()
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
      // Use the new function that automatically resets expired claims
      const { data: allBounties, error: bountiesError } = await supabase
        .rpc('get_available_bounties_with_reset');

      if (bountiesError) throw bountiesError;

      // Fetch property details for each bounty
      const bountiesWithProperties = await Promise.all(
        (allBounties || []).map(async (bounty) => {
          const { data: property, error: propertyError } = await supabase
            .from('properties')
            .select('full_address, city, state')
            .eq('id', bounty.property_id)
            .single();

          if (propertyError) {
            console.error('Error fetching property:', propertyError);
            return { ...bounty, properties: null };
          }

          return { ...bounty, properties: property };
        })
      );

      // Separate open and claimed bounties
      const openBounties = bountiesWithProperties.filter(bounty => bounty.status === 'open');
      const claimedBounties = bountiesWithProperties.filter(bounty => bounty.status === 'claimed');

      setBounties(openBounties);
      setClaimedBounties(claimedBounties);
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
        .neq('confirmation_status', 'both_confirmed')
        .in('status', ['awarded', 'confirmed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpcomingShowings(data || []);
    } catch (error) {
      console.error('Error fetching upcoming showings:', error);
    }
  };

  const fetchCompletedShowings = async () => {
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
        .eq('confirmation_status', 'both_confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompletedShowings(data || []);
    } catch (error) {
      console.error('Error fetching completed showings:', error);
    }
  };

  const fetchCreditTransactions = async () => {
    try {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!agentProfile) return;

      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('agent_profile_id', agentProfile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCreditTransactions(data || []);
    } catch (error) {
      console.error('Error fetching credit transactions:', error);
    }
  };

  const confirmShowing = async (showingId: string) => {
    try {
      // Get current showing data first
      const { data: currentShowing, error: fetchError } = await supabase
        .from('showing_requests')
        .select('confirmation_status, buyer_confirmed_at')
        .eq('id', showingId)
        .single();

      if (fetchError) throw fetchError;

      // Determine new confirmation status
      let newStatus: 'agent_confirmed' | 'both_confirmed' = 'agent_confirmed';
      if (currentShowing.buyer_confirmed_at) {
        newStatus = 'both_confirmed';
      }

      const { error } = await supabase
        .from('showing_requests')
        .update({
          confirmation_status: newStatus,
          agent_confirmed_at: new Date().toISOString()
        })
        .eq('id', showingId);

      if (error) throw error;

      toast({
        title: "Showing Confirmed",
        description: newStatus === 'both_confirmed' 
          ? "Both parties confirmed! You've earned your credits back."
          : "You've confirmed this showing. Waiting for buyer confirmation to earn credits.",
      });

      // Refresh data
      fetchUpcomingShowings();
      fetchCreditTransactions();
      fetchAgentProfile(); // Refresh credit balance
    } catch (error) {
      console.error('Error confirming showing:', error);
      toast({
        title: "Error",
        description: "Failed to confirm showing. Please try again.",
        variant: "destructive",
      });
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
            <div className="flex items-center gap-4">
              <NotificationDropdown />
              {onLogout && (
                <Button variant="outline" onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              )}
            </div>
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="disclosures" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                My Disclosures
                {myDisclosures.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    {myDisclosures.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="showings" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming Showings
                {upcomingShowings.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    {upcomingShowings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Completed Showings
                {completedShowings.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 text-xs bg-green-600 hover:bg-green-700">
                    {completedShowings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Credit History
                {creditTransactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    {creditTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bounties" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Disclosure Bounties
                {bounties.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 text-xs bg-green-600 hover:bg-green-700">
                    {bounties.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="showing-bids" className="flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Showing Requests
                {showingRequests.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 text-xs bg-blue-600 hover:bg-blue-700">
                    {showingRequests.length}
                  </Badge>
                )}
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
                    <Card 
                      key={disclosure.id} 
                      className={`hover:shadow-lg transition-shadow ${disclosure.status === 'complete' ? 'cursor-pointer' : ''}`}
                      onClick={() => disclosure.status === 'complete' && navigate(`/report/${disclosure.id}`)}
                    >
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
                            {disclosure.status === 'complete' && (
                              <Button 
                                size="sm" 
                                onClick={() => navigate(`/report/${disclosure.id}`)}
                                className="flex-1"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Analysis
                              </Button>
                            )}
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
                           <div className="space-y-2">
                             <div className="flex items-center text-sm">
                               {showing.confirmation_status === 'both_confirmed' ? (
                                 <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                               ) : showing.confirmation_status === 'agent_confirmed' ? (
                                 <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                               ) : (
                                 <Clock className="w-4 h-4 mr-2 text-gray-500" />
                               )}
                               {showing.confirmation_status === 'both_confirmed' 
                                 ? 'Both parties confirmed - Credits earned!' 
                                 : showing.confirmation_status === 'agent_confirmed'
                                 ? 'You confirmed - Waiting for buyer'
                                 : 'Pending confirmation'}
                             </div>
                               <div className="space-y-2">
                                 {showing.confirmation_status === 'pending' ? (
                                   <Button 
                                     size="sm" 
                                     onClick={() => confirmShowing(showing.id)}
                                     className="w-full"
                                   >
                                     <CheckCircle className="w-4 h-4 mr-2" />
                                     Confirm Showing Completed
                                   </Button>
                                 ) : showing.confirmation_status === 'agent_confirmed' ? (
                                   <Button 
                                     size="sm" 
                                     variant="outline"
                                     className="w-full bg-yellow-50 text-yellow-700 border-yellow-200"
                                     disabled
                                   >
                                     <Clock className="w-4 h-4 mr-2 text-yellow-600" />
                                     Waiting for Buyer
                                   </Button>
                                 ) : showing.confirmation_status === 'buyer_confirmed' ? (
                                   <Button 
                                     size="sm" 
                                     onClick={() => confirmShowing(showing.id)}
                                     className="w-full bg-blue-600 hover:bg-blue-700"
                                   >
                                     <CheckCircle className="w-4 h-4 mr-2" />
                                     Confirm (Buyer Ready!)
                                   </Button>
                                 ) : (
                                   <Button 
                                     size="sm" 
                                     variant="outline"
                                     className="w-full bg-green-50 text-green-700 border-green-200"
                                     disabled
                                   >
                                     <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                     Completed & Credits Earned
                                   </Button>
                                 )}
                                 
                                 <Button 
                                   size="sm" 
                                   variant="outline"
                                   onClick={() => {
                                     setSelectedShowingForChat(showing);
                                     setIsChatModalOpen(true);
                                   }}
                                   className="w-full"
                                 >
                                   <MessageCircle className="w-4 h-4 mr-2" />
                                   Message Buyer
                                 </Button>
                               </div>
                           </div>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Completed Showings</h2>
              
              {completedShowings.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No completed showings</h3>
                      <p className="text-muted-foreground">
                        Your completed showings will appear here once both parties confirm completion
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedShowings.map((showing) => (
                    <Card key={showing.id} className="hover:shadow-lg transition-shadow border-green-200 bg-green-50/50">
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
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                         <div className="space-y-4">
                           <div className="flex items-center text-sm text-muted-foreground">
                             <Calendar className="w-4 h-4 mr-2" />
                             Completed: {showing.agent_confirmed_at ? new Date(showing.agent_confirmed_at).toLocaleDateString() : 'Recently'}
                           </div>
                           {showing.selected_time_slot && (
                             <div className="flex items-center text-sm font-medium text-green-600">
                               <Clock className="w-4 h-4 mr-2" />
                               {showing.selected_time_slot}
                             </div>
                           )}
                           {showing.winning_bid_amount && (
                             <div className="flex items-center text-sm text-green-600">
                               <Coins className="w-4 h-4 mr-2" />
                               Earned: {showing.winning_bid_amount} Credits
                             </div>
                           )}
                           
                           <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                             <div className="flex items-center text-sm text-green-800">
                               <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                               Both parties confirmed completion - Credits earned!
                             </div>
                             {showing.agent_confirmed_at && showing.buyer_confirmed_at && (
                               <div className="text-xs text-green-600 mt-1">
                                 Confirmed: {new Date(Math.max(
                                   new Date(showing.agent_confirmed_at).getTime(),
                                   new Date(showing.buyer_confirmed_at).getTime()
                                 )).toLocaleDateString()}
                               </div>
                             )}
                           </div>
                           
                           <div className="flex gap-2">
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={() => navigate('/')}
                             >
                               <Eye className="w-4 h-4 mr-2" />
                               View Similar Properties
                             </Button>
                           </div>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Credit Transaction History</h2>
              
              {creditTransactions.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Coins className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
                      <p className="text-muted-foreground">
                        Your credit earning history will appear here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="space-y-0">
                      {creditTransactions.map((transaction, index) => (
                        <div 
                          key={transaction.id} 
                          className={`p-4 ${index !== creditTransactions.length - 1 ? 'border-b' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {transaction.transaction_type === 'disclosure_upload' ? (
                                  <FileText className="w-4 h-4 text-green-500" />
                                ) : transaction.transaction_type === 'showing_win' ? (
                                  <CheckCircle className="w-4 h-4 text-blue-500" />
                                ) : transaction.transaction_type === 'showing_deduction' ? (
                                  <AlertCircle className="w-4 h-4 text-orange-500" />
                                ) : (
                                  <Coins className="w-4 h-4 text-gray-500" />
                                )}
                                <span className="font-medium text-sm">
                                  {transaction.transaction_type.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {transaction.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(transaction.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span 
                                className={`font-semibold ${
                                  transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount} credits
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
        onSuccess={handleUploadSuccess}
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

      {/* Chat Modal */}
      {selectedShowingForChat && (
        <ShowingChatModal
          showingRequest={{
            id: selectedShowingForChat.id,
            status: selectedShowingForChat.status,
            winning_agent_id: agentProfile?.id || null,
            properties: selectedShowingForChat.properties,
            agent_profiles: {
              user_id: user?.id || '',
              profile_bio: agentProfile?.profile_bio || ''
            }
          }}
          isOpen={isChatModalOpen}
          onClose={() => {
            setIsChatModalOpen(false);
            setSelectedShowingForChat(null);
          }}
        />
      )}
    </div>
  );
};

export default AgentDashboard;