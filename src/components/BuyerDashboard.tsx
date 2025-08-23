import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { FileText, Clock, CheckCircle, Download } from 'lucide-react';

interface PropertyRequest {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
  disclosure_reports?: Array<{
    id: string;
    status: string;
    report_summary_basic: string;
    raw_pdf_url: string;
    uploaded_by_agent_id: string;
  }>;
}

interface AvailableReport {
  id: string;
  property_id: string;
  status: string;
  report_summary_basic: string;
  raw_pdf_url: string;
  created_at: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

const BuyerDashboard = () => {
  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [availableReports, setAvailableReports] = useState<AvailableReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's disclosure requests
      const { data: bounties, error: bountiesError } = await supabase
        .from('disclosure_bounties')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('requested_by_user_id', user.id)
        .order('created_at', { ascending: false });

      if (bountiesError) throw bountiesError;

      // Fetch disclosure reports for user's properties
      const propertyIds = bounties?.map(b => b.property_id) || [];
      const { data: reports, error: reportsError } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .in('property_id', propertyIds)
        .eq('status', 'complete');

      if (reportsError) throw reportsError;

      // Fetch all available completed reports
      const { data: allReports, error: allReportsError } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `)
        .eq('status', 'complete')
        .order('created_at', { ascending: false });

      if (allReportsError) throw allReportsError;

      setRequests(bounties || []);
      setAvailableReports(allReports || []);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'claimed':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'claimed':
        return 'secondary';
      case 'completed':
        return 'default';
      default:
        return 'default';
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
        <h1 className="text-3xl font-bold mb-2">Buyer Dashboard</h1>
        <p className="text-muted-foreground">
          Track your disclosure requests and browse available reports
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="available">Available Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No requests yet</h3>
                    <p className="text-muted-foreground">Start by requesting analysis for a property</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">
                          {request.properties?.full_address || 'Property Address'}
                        </CardTitle>
                        <CardDescription>
                          {request.properties?.city}, {request.properties?.state}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <Badge variant={getStatusColor(request.status) as any}>
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Requested: {new Date(request.created_at).toLocaleDateString()}
                      </div>
                      {request.status === 'completed' && (
                        <Button size="sm" className="w-full">
                          <Download className="w-4 h-4 mr-2" />
                          View Report
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableReports.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No reports available</h3>
                    <p className="text-muted-foreground">Check back later for new disclosure reports</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              availableReports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">
                          {report.properties?.full_address || 'Property Address'}
                        </CardTitle>
                        <CardDescription>
                          {report.properties?.city}, {report.properties?.state}
                        </CardDescription>
                      </div>
                      <Badge variant="default">Complete</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {report.report_summary_basic || 'Detailed property disclosure analysis available'}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        Completed: {new Date(report.created_at).toLocaleDateString()}
                      </div>
                      <Button size="sm" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        View Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BuyerDashboard;