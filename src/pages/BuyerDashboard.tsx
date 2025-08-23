import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { LogOut, FileText, Search, Download, Eye } from 'lucide-react';

interface Property {
  id: string;
  full_address: string;
  city: string;
  state: string;
}

interface DisclosureReport {
  id: string;
  property_id: string;
  risk_score: number;
  report_summary_basic: string;
  report_summary_full: any;
  created_at: string;
  properties: Property;
}

interface SavedSearch {
  id: string;
  search_term: string;
  city: string;
  state: string;
  created_at: string;
}

const BuyerDashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DisclosureReport[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch purchased reports - for demo, we'll show all complete reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (*)
        `)
        .eq('status', 'complete')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      // Mock saved searches for demo
      setSavedSearches([
        {
          id: '1',
          search_term: 'Single family home',
          city: 'San Francisco',
          state: 'CA',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          search_term: 'Condo',
          city: 'Los Angeles',
          state: 'CA',
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const viewReport = (reportId: string, propertyId: string) => {
    navigate(`/report/${reportId}`, { state: { propertyId } });
  };

  const downloadReport = (report: DisclosureReport) => {
    // Mock download functionality
    const reportData = {
      property: report.properties.full_address,
      riskScore: report.risk_score,
      summary: report.report_summary_basic,
      fullReport: report.report_summary_full
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-report-${report.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: "Your report is being downloaded",
    });
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Buyer Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user?.user_metadata?.first_name || user?.email}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              My Reports
            </TabsTrigger>
            <TabsTrigger value="searches" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Saved Searches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-6">
            <div className="grid gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Purchased Reports</h2>
                <Badge variant="secondary">{reports.length} Reports</Badge>
              </div>

              {reports.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Purchase property reports to view detailed analysis and risk assessments.
                    </p>
                    <Button onClick={() => navigate('/')}>
                      Search Properties
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {reports.map((report) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{report.properties.full_address}</CardTitle>
                            <CardDescription>
                              Purchased on {new Date(report.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <Badge variant={report.risk_score > 7 ? "destructive" : report.risk_score > 5 ? "secondary" : "default"}>
                            Risk: {report.risk_score}/10
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4 line-clamp-2">
                          {report.report_summary_basic}
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => viewReport(report.id, report.property_id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Report
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadReport(report)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="searches" className="mt-6">
            <div className="grid gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Saved Searches</h2>
                <Badge variant="secondary">{savedSearches.length} Searches</Badge>
              </div>

              <div className="grid gap-4">
                {savedSearches.map((search) => (
                  <Card key={search.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{search.search_term}</CardTitle>
                      <CardDescription>
                        {search.city}, {search.state} • Saved {new Date(search.created_at).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button size="sm" onClick={() => navigate('/')}>
                        Run Search Again
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BuyerDashboard;