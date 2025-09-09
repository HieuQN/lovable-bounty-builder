import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { AlertTriangle, FileText, DollarSign, ArrowLeft } from 'lucide-react';
import PaymentModal from '@/components/PaymentModal';

interface Property {
  id: string;
  full_address: string;
  city: string;
  state: string;
}

interface DisclosureReport {
  id: string;
  risk_score: number;
  report_summary_basic: string;
  report_summary_full: any;
  status: string;
  dummy_analysis_complete: boolean;
  created_at: string;
}

const Analyze = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [report, setReport] = useState<DisclosureReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [addressFromQuery, setAddressFromQuery] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get('address');
    if (address && !propertyId) {
      setAddressFromQuery(address);
      setLoading(false);
    } else if (propertyId) {
      fetchPropertyAndReport();
    }
  }, [propertyId]);

  const fetchPropertyAndReport = async () => {
    if (!propertyId) return;

    try {
      // Fetch property
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData);

      // Check for existing report
      const { data: reportData, error: reportError } = await supabase
        .from('disclosure_reports')
        .select('*')
        .eq('property_id', propertyId)
        .eq('status', 'complete')
        .maybeSingle();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        throw reportError;
      }

      if (reportData) {
        setReport(reportData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load property information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestAnalysis = async () => {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const targetAddress = property?.full_address || addressFromQuery;
    if (!targetAddress) return;

    setRequesting(true);
    try {
      // Create or find property
      let propertyId;
      const { data: existingProperty, error: searchError } = await supabase
        .from('properties')
        .select('*')
        .ilike('full_address', `%${targetAddress.trim()}%`)
        .single();

      if (existingProperty) {
        propertyId = existingProperty.id;
      } else {
        const { data: newProperty, error: insertError } = await supabase
          .from('properties')
          .insert({
            full_address: targetAddress.trim(),
            street_address: targetAddress.trim(),
            city: '',
            state: '',
            zip_code: ''
          })
          .select()
          .single();

        if (insertError) throw insertError;
        propertyId = newProperty.id;
      }

      // Check if bounty already exists
      const { data: existingBounty, error: bountyError } = await supabase
        .from('disclosure_bounties')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existingBounty) {
        toast({
          title: "Request Already Submitted",
          description: "An analysis request for this property is already in our system.",
        });
        return;
      }

      // Create new bounty
      const { data: newBounty, error: createError } = await supabase
        .from('disclosure_bounties')
        .insert({
          property_id: propertyId,
          requested_by_user_id: user.id,
          status: 'open'
        })
        .select()
        .single();

      if (createError) throw createError;

      // Notify agents about the new request
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-agents-new-request', {
          body: {
            propertyAddress: targetAddress.trim(),
            bountyId: newBounty.id
          }
        });

        if (notifyError) {
          console.error('Error notifying agents:', notifyError);
        }
      } catch (notifyError) {
        console.error('Failed to notify agents:', notifyError);
      }

      toast({
        title: "Request Submitted!",
        description: "Your analysis request has been submitted to our agent network. You'll be notified when it's ready.",
      });
    } catch (error) {
      console.error('Error requesting analysis:', error);
      toast({
        title: "Error",
        description: "Failed to submit analysis request",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const parseReportSummary = (summaryData: any) => {
    if (typeof summaryData === 'string') {
      try {
        return JSON.parse(summaryData);
      } catch {
        return null;
      }
    }
    return summaryData;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show request form for new analysis
  if (!property && addressFromQuery) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Search
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Request Property Analysis</h1>
              <p className="text-xl text-muted-foreground">{addressFromQuery}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  No Analysis Available
                </CardTitle>
                <CardDescription>
                  No disclosure analysis found for {addressFromQuery}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Request a free analysis from our network of licensed real estate agents. 
                  Once an agent uploads the disclosure documents, our AI will analyze them 
                  and provide you with a detailed risk assessment.
                </p>
                <Button 
                  onClick={requestAnalysis}
                  disabled={requesting}
                  size="lg"
                  className="w-full"
                >
                  {requesting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Request...
                    </>
                  ) : (
                    'Request Free Analysis'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Property not found</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullReport = report ? parseReportSummary(report.report_summary_full) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Property Analysis</h1>
            <p className="text-xl text-muted-foreground">{property.full_address}</p>
          </div>

          {report ? (
            <div className="space-y-6">
              {/* Risk Score Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Risk Assessment
                    </CardTitle>
                    <Badge variant={report.risk_score > 7 ? "destructive" : report.risk_score > 5 ? "secondary" : "default"}>
                      Risk Score: {report.risk_score}/10
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{report.report_summary_basic}</p>
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => {
                      if (!user) {
                        navigate('/auth');
                      } else {
                        setShowPaymentModal(true);
                      }
                    }}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Unlock Full Report ($39)
                  </Button>
                </CardContent>
              </Card>

              {/* Preview of findings if full report available */}
              {fullReport && fullReport.findings && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Findings Preview</CardTitle>
                    <CardDescription>
                      Sample findings from the full analysis report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fullReport.findings.slice(0, 2).map((finding: any, index: number) => (
                        <div key={index} className="border-l-4 border-primary pl-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{finding.category}</h4>
                            <Badge variant={finding.risk_level === 'High' ? 'destructive' : finding.risk_level === 'Medium' ? 'secondary' : 'default'}>
                              {finding.risk_level}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{finding.issue}</p>
                          <p className="text-sm font-medium">Estimated Cost: {finding.estimated_cost}</p>
                        </div>
                      ))}
                      <Separator />
                      <p className="text-sm text-muted-foreground italic">
                        Unlock the full report to see all findings, detailed negotiation strategies, and cost breakdowns.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  No Analysis Available
                </CardTitle>
                <CardDescription>
                  No disclosure analysis found for {property.full_address}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Request a free analysis from our network of licensed real estate agents. 
                  Once an agent uploads the disclosure documents, our AI will analyze them 
                  and provide you with a detailed risk assessment.
                </p>
                <Button 
                  onClick={requestAnalysis}
                  disabled={requesting}
                  size="lg"
                  className="w-full"
                >
                  {requesting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Request...
                    </>
                  ) : (
                    'Request Free Analysis'
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          
          <PaymentModal
            open={showPaymentModal}
            onOpenChange={setShowPaymentModal}
            onPaymentSuccess={() => {
              toast({
                title: "Payment Successful!",
                description: "Report unlocked! Redirecting to your dashboard...",
              });
              setTimeout(() => navigate('/dashboard'), 1500);
            }}
            propertyAddress={property?.full_address || ''}
            amount={39}
          />
        </div>
      </div>
    </div>
  );
};

export default Analyze;