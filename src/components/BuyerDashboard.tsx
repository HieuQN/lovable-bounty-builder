import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { FileText, Clock, CheckCircle, Download, Search, ShoppingCart, Calendar } from 'lucide-react';
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
  const [purchasedReports, setPurchasedReports] = useState<PurchasedReport[]>([]);
  const [availableReports, setAvailableReports] = useState<AvailableReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<AvailableReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; report: AvailableReport | null }>({ open: false, report: null });
  const [showingModal, setShowingModal] = useState<{ open: boolean; report: AvailableReport | PurchasedReport | null }>({ open: false, report: null });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's purchased reports by joining purchases with disclosure_reports
      const { data: purchased, error: purchasedError } = await supabase
        .from('purchases')
        .select(`
          id,
          amount,
          created_at,
          disclosure_report_id
        `)
        .eq('user_id', user.id)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false });

      if (purchasedError) throw purchasedError;

      // Get the report IDs from purchases
      const purchasedReportIds = purchased?.map(p => p.disclosure_report_id) || [];
      
      // Fetch the actual report data for purchased reports
      let purchasedReportsData: PurchasedReport[] = [];
      if (purchasedReportIds.length > 0) {
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
          .in('id', purchasedReportIds)
          .eq('status', 'complete');

        if (reportsError) throw reportsError;

        // Merge purchase data with report data
        purchasedReportsData = reports?.map(report => {
          const purchase = purchased.find(p => p.disclosure_report_id === report.id);
          return {
            ...report,
            purchases: purchase ? {
              id: purchase.id,
              created_at: purchase.created_at,
              amount: purchase.amount
            } : undefined
          };
        }) || [];
      }

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

      // Get user's purchased report IDs
      const purchasedReportIdsSet = new Set(purchasedReportIds);
      
      // Mark reports as purchased or not
      const availableReportsData = allReports?.map(report => ({
        ...report,
        is_purchased: purchasedReportIdsSet.has(report.id)
      })) || [];

      setPurchasedReports(purchasedReportsData);
      setAvailableReports(availableReportsData);
      setFilteredReports(availableReportsData);
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

  // Filter reports based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredReports(availableReports);
    } else {
      const filtered = availableReports.filter(report => 
        report.properties?.full_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.properties?.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.report_summary_basic?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredReports(filtered);
    }
  }, [searchQuery, availableReports]);

  const handlePurchase = (report: AvailableReport) => {
    setPaymentModal({ open: true, report });
  };

  const handleShowingRequest = (report: AvailableReport | PurchasedReport) => {
    setShowingModal({ open: true, report });
  };

  const handlePaymentSuccess = async () => {
    if (!paymentModal.report) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Record the purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          disclosure_report_id: paymentModal.report.id,
          amount: 49.99,
          payment_status: 'completed'
        });

      if (purchaseError) throw purchaseError;

      // Refresh data
      await fetchData();
      
      toast({
        title: "Purchase Successful!",
        description: "The report is now available in your purchased reports.",
      });
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast({
        title: "Error",
        description: "Failed to record purchase. Please contact support.",
        variant: "destructive",
      });
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

      <Tabs defaultValue="purchased" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="purchased">My Reports</TabsTrigger>
          <TabsTrigger value="available">Available Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="purchased" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchasedReports.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No purchased reports yet</h3>
                    <p className="text-muted-foreground">Browse available reports to purchase full access</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              purchasedReports.map((report) => (
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
                      <Badge variant="default">Purchased</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {report.report_summary_basic || 'Detailed property disclosure analysis'}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        Purchased: {new Date(report.purchases?.created_at || report.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => window.open(report.raw_pdf_url, '_blank')}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleShowingRequest(report)}>
                          <Calendar className="w-4 h-4 mr-2" />
                          Request Showing
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="space-y-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by address, city, or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery ? 'No reports found' : 'No reports available'}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery ? 'Try adjusting your search terms' : 'Check back later for new disclosure reports'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredReports.map((report) => (
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
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={report.is_purchased ? "secondary" : "default"}>
                          {report.is_purchased ? "Owned" : "Available"}
                        </Badge>
                      </div>
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
                      {report.is_purchased ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => window.open(report.raw_pdf_url, '_blank')}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleShowingRequest(report)}>
                            <Calendar className="w-4 h-4 mr-2" />
                            Request Showing
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePurchase(report)}>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Buy $49.99
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleShowingRequest(report)}>
                            <Calendar className="w-4 h-4 mr-2" />
                            Request Showing
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <PaymentModal
        open={paymentModal.open}
        onOpenChange={(open) => setPaymentModal({ open, report: paymentModal.report })}
        onPaymentSuccess={handlePaymentSuccess}
        propertyAddress={paymentModal.report?.properties?.full_address || ''}
        amount={49.99}
      />

      {showingModal.report && (
        <ShowingRequestModal
          property={{
            id: showingModal.report.property_id,
            full_address: showingModal.report.properties?.full_address || '',
            city: showingModal.report.properties?.city || '',
            state: showingModal.report.properties?.state || ''
          }}
          isOpen={showingModal.open}
          onClose={() => setShowingModal({ open: false, report: null })}
          userCredits={100}
          onRequestSuccess={() => {
            setShowingModal({ open: false, report: null });
            toast({
              title: "Showing Requested",
              description: "Your showing request has been submitted successfully.",
            });
          }}
        />
      )}
    </div>
  );
};

export default BuyerDashboard;