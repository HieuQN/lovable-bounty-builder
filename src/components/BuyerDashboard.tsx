import { useEffect, useState } from 'react';
import { PropertyCard } from '@/components/PropertyCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { FileText, Clock, CheckCircle, Download, Search, ShoppingCart, Calendar, Eye, MessageCircle } from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';
import { ShowingRequestModal } from '@/components/ShowingRequestModal';
import { ShowingChat } from '@/components/ShowingChat';
import { useShowingStatus } from '@/hooks/useShowingStatus';
import ChatList from '@/components/ChatList';

interface PurchasedReport {
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
  purchases?: {
    id: string;
    created_at: string;
    amount: number;
  };
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
  is_purchased?: boolean;
}

const BuyerDashboard = () => {
  const { user } = useAuth();
  const [purchasedReports, setPurchasedReports] = useState<PurchasedReport[]>([]);
  const [availableReports, setAvailableReports] = useState<AvailableReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<AvailableReport[]>([]);
  const [filteredPurchased, setFilteredPurchased] = useState<PurchasedReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AvailableReport | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<AvailableReport | PurchasedReport | null>(null);
  const [isShowingModalOpen, setIsShowingModalOpen] = useState(false);
  const [chatShowingRequest, setChatShowingRequest] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      
      // Fetch purchased reports
      const { data: purchasedData, error: purchasedError } = await supabase
        .from('purchases')
        .select(`
          *,
          disclosure_reports!inner (
            id,
            property_id,
            status,
            report_summary_basic,
            raw_pdf_url,
            created_at,
            properties (*)
          )
        `)
        .eq('user_id', user?.id);

      if (purchasedError) throw purchasedError;

      const purchased = purchasedData?.map(purchase => ({
        ...purchase.disclosure_reports,
        purchases: purchase
      })) || [];

      setPurchasedReports(purchased);

      // Fetch all available reports
      const { data: availableData, error: availableError } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (*)
        `)
        .eq('status', 'complete')
        .order('created_at', { ascending: false });

      if (availableError) throw availableError;

      // Mark reports as purchased or not
      const available = availableData?.map(report => ({
        ...report,
        is_purchased: purchased.some(p => p.id === report.id)
      })) || [];

      setAvailableReports(available);
      setFilteredReports(available);
      setFilteredPurchased(purchased);

    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredReports(availableReports);
      setFilteredPurchased(purchasedReports);
    } else {
      const filteredAvailable = availableReports.filter(report => 
        report.properties?.full_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.report_summary_basic.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredReports(filteredAvailable);
      
      const filteredPurch = purchasedReports.filter(report => 
        report.properties?.full_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.report_summary_basic.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPurchased(filteredPurch);
    }
  }, [searchQuery, availableReports, purchasedReports]);

  const viewReport = (reportId: string, propertyId: string) => {
    window.open(`/report/${reportId}`, '_blank');
  };

  const handlePurchase = (report: AvailableReport) => {
    setSelectedReport(report);
    setIsPaymentModalOpen(true);
  };

  const handleShowingRequest = (report: AvailableReport | PurchasedReport) => {
    setSelectedProperty(report);
    setIsShowingModalOpen(true);
  };

  const handleOpenChat = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('showing_requests')
        .select(`
          *,
          properties (* )
        `)
        .eq('property_id', propertyId)
        .eq('requested_by_user_id', user?.id)
        .not('winning_agent_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setChatShowingRequest(data);
        setIsChatOpen(true);
      } else {
        toast({
          title: 'No chat available yet',
          description: 'Once an agent is matched, you can chat here.',
        });
      }
    } catch (error) {
      console.error('Error fetching showing request:', error);
      toast({
        title: 'Error',
        description: 'Failed to open chat',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentSuccess = async () => {
    if (!selectedReport) return;

    try {
      const { error } = await supabase
        .from('purchases')
        .insert({
          user_id: user?.id,
          disclosure_report_id: selectedReport.id,
          amount: 49.99,
          payment_status: 'completed'
        });

      if (error) throw error;

      toast({
        title: "Purchase Successful",
        description: "You can now access the full disclosure report",
      });

      setIsPaymentModalOpen(false);
      setSelectedReport(null);
      fetchReports(); // Refresh the data
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast({
        title: "Error",
        description: "Failed to complete purchase",
        variant: "destructive",
      });
    }
  };

  const parseRiskCounts = (summary: string) => {
    try {
      const parsed = JSON.parse(summary);
      if (parsed.findings) {
        const high = parsed.findings.filter((f: any) => f.risk_level === 'high').length;
        const medium = parsed.findings.filter((f: any) => f.risk_level === 'medium').length;
        const low = parsed.findings.filter((f: any) => f.risk_level === 'low').length;
        
        const examples = {
          high: parsed.findings.find((f: any) => f.risk_level === 'high')?.category || 'None',
          medium: parsed.findings.find((f: any) => f.risk_level === 'medium')?.category || 'None', 
          low: parsed.findings.find((f: any) => f.risk_level === 'low')?.category || 'None'
        };
        
        return { high, medium, low, examples };
      }
    } catch (e) {
      console.error('Error parsing risk summary:', e);
    }
    return { high: 0, medium: 0, low: 0, examples: { high: 'None', medium: 'None', low: 'None' } };
  };

  const formatPropertyTitle = (address: string, city: string, state: string) => {
    // Mock property details - in a real app, these would come from the database
    const bedrooms = Math.floor(Math.random() * 4) + 2;
    const bathrooms = Math.floor(Math.random() * 3) + 1;
    const sqft = (Math.floor(Math.random() * 2000) + 1000).toLocaleString();
    
    return {
      address,
      details: `${bedrooms} bed • ${bathrooms} bath • ${sqft} sq ft`,
      location: `${city}, ${state}`
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Prominent Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-xl mx-auto">
          <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search properties by address, city, state, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 text-lg bg-background border-2 shadow-sm"
          />
        </div>
        {searchQuery && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Found {filteredReports.length + filteredPurchased.length} properties matching "{searchQuery}"
          </p>
        )}
      </div>

      <Tabs defaultValue="purchased" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="purchased">My Reports</TabsTrigger>
          <TabsTrigger value="available">Available Reports</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="compare">Compare Properties</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Showings</TabsTrigger>
          <TabsTrigger value="completed">Completed Showings</TabsTrigger>
        </TabsList>

        <TabsContent value="purchased" className="mt-6">
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Purchased Reports</h2>
              <Badge variant="secondary">{filteredPurchased.length} Reports</Badge>
            </div>

            {filteredPurchased.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Purchased Reports</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't purchased any property disclosure reports yet.
                  </p>
                  <Button onClick={() => {
                    const availableTab = document.querySelector('[value="available"]') as HTMLElement;
                    availableTab?.click();
                  }}>
                    Browse Available Reports
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 max-h-96 overflow-y-auto">
                {filteredPurchased.map((report) => {
                  const propertyInfo = formatPropertyTitle(
                    report.properties?.full_address || '',
                    report.properties?.city || '',
                    report.properties?.state || ''
                  );
                  const riskCounts = parseRiskCounts(report.report_summary_basic);
                  
                  return (
                    <PropertyCard
                      key={report.id}
                      report={report}
                      propertyInfo={propertyInfo}
                      riskCounts={riskCounts}
                      onViewReport={() => viewReport(report.id, report.property_id)}
                      onDownload={() => window.open(report.raw_pdf_url, '_blank')}
                      onRequestShowing={() => handleShowingRequest(report)}
                      onOpenChat={() => handleOpenChat(report.property_id)}
                      isPurchased={true}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Available Property Reports</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by address, city, or state..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Badge variant="secondary">{filteredReports.length} Reports</Badge>
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No reports match your search criteria.' : 'No property reports are currently available.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 max-h-96 overflow-y-auto">
                {filteredReports.map((report) => {
                  const propertyInfo = formatPropertyTitle(
                    report.properties?.full_address || '',
                    report.properties?.city || '',
                    report.properties?.state || ''
                  );
                  const riskCounts = parseRiskCounts(report.report_summary_basic);
                  
                  return (
                    <PropertyCard
                      key={report.id}
                      report={report}
                      propertyInfo={propertyInfo}
                      riskCounts={riskCounts}
                      onViewReport={() => viewReport(report.id, report.property_id)}
                      onPurchase={() => handlePurchase(report)}
                      onRequestShowing={() => handleShowingRequest(report)}
                      onOpenChat={() => handleOpenChat(report.property_id)}
                      isPurchased={false}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <ChatList userType="buyer" />
        </TabsContent>

        <TabsContent value="compare" className="mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Property Comparison</h3>
              <p className="text-muted-foreground">
                Compare multiple properties side by side. This feature will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Upcoming Showings</h3>
              <p className="text-muted-foreground">
                View and manage your scheduled property showings.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Completed Showings</h3>
              <p className="text-muted-foreground">
                Review your past property showings and feedback.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedReport && (
        <PaymentModal
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
          onPaymentSuccess={handlePaymentSuccess}
          propertyAddress={selectedReport.properties?.full_address || ''}
          amount={49.99}
        />
      )}

      {selectedProperty && (
        <ShowingRequestModal
          isOpen={isShowingModalOpen}
          onClose={() => setIsShowingModalOpen(false)}
          property={{
            id: selectedProperty.property_id,
            full_address: selectedProperty.properties?.full_address || '',
            city: selectedProperty.properties?.city || '',
            state: selectedProperty.properties?.state || ''
          }}
          userCredits={100}
          onRequestSuccess={() => {
            setIsShowingModalOpen(false);
            setSelectedProperty(null);
          }}
        />
      )}

      {/* Chat Interface */}
      {isChatOpen && chatShowingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ShowingChat
            showingRequest={chatShowingRequest}
            onClose={() => {
              setIsChatOpen(false);
              setChatShowingRequest(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BuyerDashboard;