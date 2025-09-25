import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Upload, Coins, FileText, Star, Building, Clock } from 'lucide-react';
import { UploadDisclosureModal } from './UploadDisclosureModal';

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

interface MyDisclosure {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  report_summary_basic: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

interface AgentProfile {
  id: string;
  credit_balance: number;
  brokerage_name: string;
  license_number: string;
}

interface AgentDashboardProps {
  activeTab?: string;
}

const AgentDashboard = ({ activeTab = 'bounties' }: AgentDashboardProps) => {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [myDisclosures, setMyDisclosures] = useState<MyDisclosure[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBounty, setSelectedBounty] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch agent profile
      const { data: profile, error: profileError } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

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

      const bountiesData = bountiesWithProperties;

      // Fetch agent's disclosure reports
      let disclosuresData = [];
      if (profile) {
        const { data: disclosures, error: disclosuresError } = await supabase
          .from('disclosure_reports')
          .select(`
            *,
            properties (
              full_address,
              city,
              state
            )
          `)
          .eq('uploaded_by_agent_id', profile.id)
          .order('created_at', { ascending: false });

        if (disclosuresError) throw disclosuresError;
        disclosuresData = disclosures || [];
      }

      setAgentProfile(profile);
      setBounties(bountiesData || []);
      setMyDisclosures(disclosuresData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimBounty = async (bountyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !agentProfile) return;

      const { error } = await supabase
        .from('disclosure_bounties')
        .update({ 
          status: 'claimed',
          claimed_by_agent_id: agentProfile.id,
          claim_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })
        .eq('id', bountyId);

      if (error) throw error;

      toast({
        title: "Bounty Claimed",
        description: "You have 24 hours to upload the disclosure",
      });

      fetchData();
    } catch (error) {
      console.error('Error claiming bounty:', error);
      toast({
        title: "Error",
        description: "Failed to claim bounty",
        variant: "destructive",
      });
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    setSelectedBounty(null);
    fetchData();
    toast({
      title: "Success",
      description: "Disclosure uploaded successfully! Credits have been added to your account.",
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Agent Dashboard</h1>
            <p className="text-muted-foreground">
              Manage bounties and track your disclosure uploads
            </p>
          </div>
          
          {agentProfile && (
            <Card className="w-full sm:w-auto">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/30 rounded-lg flex items-center justify-center">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Balance</p>
                    <p className="text-xl font-bold">{agentProfile.credit_balance}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {agentProfile && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Brokerage</p>
                    <p className="font-semibold">{agentProfile.brokerage_name || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">License #</p>
                    <p className="font-semibold">{agentProfile.license_number || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {activeTab === 'bounties' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Available Bounties</h2>
            <Badge variant="secondary">{bounties.length} Bounties</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bounties.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No bounties available</h3>
                    <p className="text-muted-foreground">Check back later for new opportunities</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              bounties.map((bounty) => (
                <Card key={bounty.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">
                          {bounty.properties?.full_address || 'Property Address'}
                        </CardTitle>
                        <CardDescription>
                          {bounty.properties?.city}, {bounty.properties?.state}
                        </CardDescription>
                      </div>
                      <Badge variant={bounty.status === 'open' ? 'default' : 'secondary'}>
                        {bounty.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Posted: {new Date(bounty.created_at).toLocaleDateString()}
                      </div>
                      {bounty.claim_expiration && (
                        <div className="text-sm text-orange-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires: {new Date(bounty.claim_expiration).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {bounty.status === 'open' ? (
                          <Button 
                            onClick={() => claimBounty(bounty.id)}
                            className="flex-1"
                            size="sm"
                          >
                            Claim Bounty
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => {
                              setSelectedBounty(bounty.id);
                              setShowUploadModal(true);
                            }}
                            className="flex-1"
                            size="sm"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'disclosures' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Disclosures</h2>
            <Badge variant="secondary">{myDisclosures.length} Disclosures</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myDisclosures.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No disclosures uploaded</h3>
                    <p className="text-muted-foreground">Start by claiming and fulfilling bounties</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              myDisclosures.map((disclosure) => (
                <Card key={disclosure.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">
                          {disclosure.properties?.full_address || 'Property Address'}
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
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {disclosure.report_summary_basic || 'Disclosure analysis in progress'}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        Uploaded: {new Date(disclosure.created_at).toLocaleDateString()}
                      </div>
                      {disclosure.status === 'complete' && (
                        <Button 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => window.open(`/report/${disclosure.id}`, '_blank')}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Report
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {showUploadModal && selectedBounty && (
        <UploadDisclosureModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedBounty(null);
          }}
          bountyId={selectedBounty}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};

export default AgentDashboard;