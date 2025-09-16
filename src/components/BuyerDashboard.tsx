import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { FileText, Clock, CheckCircle, Download, Search, ShoppingCart, Calendar, Eye } from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';
import { ShowingRequestModal } from '@/components/ShowingRequestModal';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AvailableReport | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<AvailableReport | PurchasedReport | null>(null);
  const [isShowingModalOpen, setIsShowingModalOpen] = useState(false);

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
    } else {
      const filtered = availableReports.filter(report => 
        report.properties?.full_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.report_summary_basic.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredReports(filtered);
    }
  }, [searchQuery, availableReports]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue="purchased" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="purchased">My Reports</TabsTrigger>
          <TabsTrigger value="available">Available Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="purchased" className="mt-6">
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Purchased Reports</h2>
              <Badge variant="secondary">{purchasedReports.length} Reports</Badge>
            </div>

            {purchasedReports.length === 0 ? (
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
              <div className="grid gap-4">
                {purchasedReports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {report.properties?.full_address}
                          </CardTitle>
                          <CardDescription>
                            Purchased on {new Date(report.purchases?.created_at || '').toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge variant={report.status === 'complete' ? 'default' : 'secondary'}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {report.status}
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
                          onClick={() => window.open(report.raw_pdf_url, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleShowingRequest(report)}
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
              <div className="grid gap-4">
                {filteredReports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {report.properties?.full_address}
                          </CardTitle>
                          <CardDescription>
                            {report.properties?.city}, {report.properties?.state}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={report.is_purchased ? 'default' : 'secondary'}>
                            {report.is_purchased ? 'Purchased' : 'Available'}
                          </Badge>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(report.created_at).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {report.report_summary_basic}
                      </p>
                      <div className="flex gap-2">
                        {report.is_purchased ? (
                          <Button 
                            size="sm" 
                            onClick={() => viewReport(report.id, report.property_id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Report
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => handlePurchase(report)}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Purchase Report
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleShowingRequest(report)}
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
    </div>
  );
};

export default BuyerDashboard;