import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface Bounty {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBounties();
  }, []);

  const fetchBounties = async () => {
    try {
      const { data, error } = await supabase
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

      if (error) throw error;
      setBounties(data || []);
    } catch (error) {
      console.error('Error fetching bounties:', error);
      toast({
        title: "Error",
        description: "Failed to load bounties",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimBounty = async (bountyId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('disclosure_bounties')
        .update({
          status: 'claimed',
          claimed_by_agent_id: user.id,
          claim_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        })
        .eq('id', bountyId);

      if (error) throw error;

      toast({
        title: "Bounty claimed!",
        description: "You have 24 hours to upload the disclosure report.",
      });

      fetchBounties(); // Refresh the list
    } catch (error) {
      console.error('Error claiming bounty:', error);
      toast({
        title: "Error",
        description: "Failed to claim bounty",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Available Bounties</h2>
          <p className="text-muted-foreground">
            Claim bounties to earn credits by uploading disclosure reports
          </p>
        </div>
      </div>

      {bounties.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No bounties available</h3>
              <p className="text-muted-foreground">Check back later for new opportunities</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bounties.map((bounty) => (
            <Card key={bounty.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {bounty.properties?.full_address || 'Property Address'}
                    </CardTitle>
                    <CardDescription>
                      {bounty.properties?.city}, {bounty.properties?.state}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{bounty.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Posted: {new Date(bounty.created_at).toLocaleDateString()}
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
    </div>
  );
};

export default Dashboard;