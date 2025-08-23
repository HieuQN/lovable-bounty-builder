import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ShowingRequestModal } from '@/components/ShowingRequestModal';
import { LogOut, FileText, Search, Download, Eye, Calendar, Coins, Clock, CheckCircle, AlertCircle } from 'lucide-react';

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

interface ShowingRequest {
  id: string;
  property_id: string;
  status: string;
  credits_spent: number;
  refund_deadline: string;
  created_at: string;
  winning_bid_amount?: number;
  selected_time_slot?: string;
  confirmation_status?: string;
  agent_confirmed_at?: string;
  buyer_confirmed_at?: string;
  properties?: Property;
}

const BuyerDashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DisclosureReport[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showingRequests, setShowingRequests] = useState<ShowingRequest[]>([]);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isShowingModalOpen, setIsShowingModalOpen] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [isComparisonMode, setIsComparisonMode] = useState(false);

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
      // Fetch user profile and credits
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setUserCredits(profileData?.credits || 0);

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

      // Fetch user's showing requests
      const { data: showingData, error: showingError } = await supabase
        .from('showing_requests')
        .select(`
          *,
          properties (*)
        `)
        .eq('requested_by_user_id', user?.id)
        .order('created_at', { ascending: false });

      if (showingError) throw showingError;
      setShowingRequests(showingData || []);

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

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    setIsShowingModalOpen(true);
  };

  const handleRequestSuccess = () => {
    fetchUserData(); // Refresh data after successful request
  };

  const confirmShowing = async (showingId: string) => {
    try {
      // Get current showing data first
      const { data: currentShowing, error: fetchError } = await supabase
        .from('showing_requests')
        .select('confirmation_status, agent_confirmed_at')
        .eq('id', showingId)
        .single();

      if (fetchError) throw fetchError;

      // Determine new confirmation status
      let newStatus: 'buyer_confirmed' | 'both_confirmed' = 'buyer_confirmed';
      if (currentShowing.agent_confirmed_at) {
        newStatus = 'both_confirmed';
      }

      const { error } = await supabase
        .from('showing_requests')
        .update({
          confirmation_status: newStatus,
          buyer_confirmed_at: new Date().toISOString()
        })
        .eq('id', showingId);

      if (error) throw error;

      toast({
        title: "Showing Confirmed",
        description: newStatus === 'both_confirmed' 
          ? "Both parties confirmed! Agent will receive their credits."
          : "You've confirmed this showing. Waiting for agent confirmation.",
      });

      fetchUserData();
    } catch (error) {
      console.error('Error confirming showing:', error);
      toast({
        title: "Error",
        description: "Failed to confirm showing. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'bidding':
        return <Badge variant="secondary">Open for Bids</Badge>;
      case 'awarded':
        return <Badge variant="default">Awarded</Badge>;
      case 'confirmed':
        return <Badge variant="default">Confirmed</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTimeRemaining = (deadline: string) => {
    const now = new Date();
    const expiry = new Date(deadline);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const toggleComparisonSelection = (reportId: string) => {
    const newSelection = new Set(selectedForComparison);
    if (newSelection.has(reportId)) {
      newSelection.delete(reportId);
    } else if (newSelection.size < 4) {
      newSelection.add(reportId);
    }
    setSelectedForComparison(newSelection);
  };

  const getSelectedReports = () => {
    return reports.filter(report => selectedForComparison.has(report.id));
  };

  const clearComparison = () => {
    setSelectedForComparison(new Set());
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">{userCredits} Credits</span>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              My Reports
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Compare Properties
            </TabsTrigger>
            <TabsTrigger value="showings" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Showing Requests
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
                    <div className="space-y-4">
                      <Button onClick={() => navigate('/')}>
                        Search Properties
                      </Button>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Want to schedule a showing? Try with a demo property:
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePropertySelect({
                            id: '123',
                            full_address: '123 Demo Street',
                            city: 'San Francisco',
                            state: 'CA'
                          })}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Request Demo Showing
                        </Button>
                      </div>
                    </div>
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
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePropertySelect(report.properties)}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            Request Showing
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="compare" className="mt-6">
            <div className="grid gap-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Compare Properties</h2>
                  <p className="text-muted-foreground">Select up to 4 properties to compare their disclosure reports</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedForComparison.size}/4 Selected</Badge>
                  {selectedForComparison.size > 0 && (
                    <Button variant="outline" size="sm" onClick={clearComparison}>
                      Clear Selection
                    </Button>
                  )}
                </div>
              </div>

              {reports.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
                    <p className="text-muted-foreground mb-4">
                      You need at least 2 property reports to use the comparison feature.
                    </p>
                    <Button onClick={() => navigate('/')}>
                      Search Properties
                    </Button>
                  </CardContent>
                </Card>
              ) : selectedForComparison.size === 0 ? (
                <div>
                  <p className="text-muted-foreground mb-4">Select properties to compare:</p>
                  <div className="grid gap-4">
                    {reports.map((report) => (
                      <Card key={report.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <input
                                type="checkbox"
                                checked={selectedForComparison.has(report.id)}
                                onChange={() => toggleComparisonSelection(report.id)}
                                className="w-4 h-4"
                                disabled={!selectedForComparison.has(report.id) && selectedForComparison.size >= 4}
                              />
                              <div>
                                <h3 className="font-medium">{report.properties.full_address}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Risk Score: {report.risk_score}/10
                                </p>
                              </div>
                            </div>
                            <Badge variant={report.risk_score > 7 ? "destructive" : report.risk_score > 5 ? "secondary" : "default"}>
                              Risk: {report.risk_score}/10
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2">Selected Properties for Comparison</h3>
                    <div className="grid gap-4">
                      {reports.map((report) => (
                        <Card key={report.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <input
                                  type="checkbox"
                                  checked={selectedForComparison.has(report.id)}
                                  onChange={() => toggleComparisonSelection(report.id)}
                                  className="w-4 h-4"
                                  disabled={!selectedForComparison.has(report.id) && selectedForComparison.size >= 4}
                                />
                                <div>
                                  <h3 className="font-medium">{report.properties.full_address}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Risk Score: {report.risk_score}/10
                                  </p>
                                </div>
                              </div>
                              <Badge variant={report.risk_score > 7 ? "destructive" : report.risk_score > 5 ? "secondary" : "default"}>
                                Risk: {report.risk_score}/10
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {selectedForComparison.size >= 2 && (
                    <div>
                      <h3 className="text-lg font-medium mb-4">Property Comparison</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-4 font-medium">Property</th>
                              {getSelectedReports().map((report) => (
                                <th key={report.id} className="text-left p-4 font-medium min-w-[200px]">
                                  <div>
                                    <div className="font-medium">{report.properties.full_address}</div>
                                    <div className="text-sm text-muted-foreground">{report.properties.city}, {report.properties.state}</div>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-4 font-medium">Risk Score</td>
                              {getSelectedReports().map((report) => (
                                <td key={report.id} className="p-4">
                                  <Badge variant={report.risk_score > 7 ? "destructive" : report.risk_score > 5 ? "secondary" : "default"}>
                                    {report.risk_score}/10
                                  </Badge>
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b">
                              <td className="p-4 font-medium">Report Summary</td>
                              {getSelectedReports().map((report) => (
                                <td key={report.id} className="p-4">
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {report.report_summary_basic}
                                  </p>
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b">
                              <td className="p-4 font-medium">Purchase Date</td>
                              {getSelectedReports().map((report) => (
                                <td key={report.id} className="p-4">
                                  <p className="text-sm">
                                    {new Date(report.created_at).toLocaleDateString()}
                                  </p>
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="p-4 font-medium">Actions</td>
                              {getSelectedReports().map((report) => (
                                <td key={report.id} className="p-4">
                                  <div className="flex flex-col gap-2">
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
                                      onClick={() => handlePropertySelect(report.properties)}
                                    >
                                      <Calendar className="w-4 h-4 mr-2" />
                                      Request Showing
                                    </Button>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="showings" className="mt-6">
            <div className="grid gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">My Showing Requests</h2>
                <Badge variant="secondary">{showingRequests.length} Requests</Badge>
              </div>

              {showingRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Showing Requests</h3>
                    <p className="text-muted-foreground mb-4">
                      Request property showings to connect with agents in your area.
                    </p>
                    <Button onClick={() => navigate('/')}>
                      Search Properties
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {showingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{request.properties?.full_address}</CardTitle>
                            <CardDescription>
                              Requested on {new Date(request.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(request.status)}
                            {request.status === 'bidding' && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatTimeRemaining(request.refund_deadline)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                       <CardContent>
                         <div className="space-y-4">
                           <div className="flex justify-between items-center">
                             <div className="flex items-center gap-4 text-sm text-muted-foreground">
                               <div className="flex items-center gap-1">
                                 <Coins className="w-4 h-4" />
                                 <span>{request.credits_spent} Credits</span>
                               </div>
                               {request.winning_bid_amount && (
                                 <div>
                                   Winning Bid: {request.winning_bid_amount} Credits
                                 </div>
                               )}
                             </div>
                             {request.selected_time_slot && (
                               <Badge variant="outline">
                                 {request.selected_time_slot}
                               </Badge>
                             )}
                           </div>
                           
                           {(request.status === 'awarded' || request.status === 'confirmed') && (
                             <div className="space-y-2">
                               <div className="flex items-center text-sm">
                                 {request.confirmation_status === 'both_confirmed' ? (
                                   <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                 ) : request.confirmation_status === 'buyer_confirmed' ? (
                                   <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                                 ) : (
                                   <Clock className="w-4 h-4 mr-2 text-gray-500" />
                                 )}
                                 {request.confirmation_status === 'both_confirmed' 
                                   ? 'Both parties confirmed - Complete!' 
                                   : request.confirmation_status === 'buyer_confirmed'
                                   ? 'You confirmed - Waiting for agent'
                                   : 'Pending confirmation'}
                               </div>
                                {request.confirmation_status === 'pending' ? (
                                  <Button 
                                    size="sm" 
                                    onClick={() => confirmShowing(request.id)}
                                    className="w-full"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Confirm Showing Completed
                                  </Button>
                                ) : request.confirmation_status === 'buyer_confirmed' ? (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="w-full bg-yellow-50 text-yellow-700 border-yellow-200"
                                    disabled
                                  >
                                    <Clock className="w-4 h-4 mr-2 text-yellow-600" />
                                    Waiting for Agent
                                  </Button>
                                ) : request.confirmation_status === 'agent_confirmed' ? (
                                  <Button 
                                    size="sm" 
                                    onClick={() => confirmShowing(request.id)}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Confirm (Agent Ready!)
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="w-full bg-green-50 text-green-700 border-green-200"
                                    disabled
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                    Completed & Credits Awarded
                                  </Button>
                                )}
                             </div>
                           )}
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

      {/* Showing Request Modal */}
      {selectedProperty && (
        <ShowingRequestModal
          property={selectedProperty}
          isOpen={isShowingModalOpen}
          onClose={() => {
            setIsShowingModalOpen(false);
            setSelectedProperty(null);
          }}
          userCredits={userCredits}
          onRequestSuccess={handleRequestSuccess}
        />
      )}
    </div>
  );
};

export default BuyerDashboard;