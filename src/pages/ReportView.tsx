import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, AlertTriangle, FileText, DollarSign, Download, Calendar } from 'lucide-react';
import { ShowingRequestModal } from '@/components/ShowingRequestModal';

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

const ReportView = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [report, setReport] = useState<DisclosureReport | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isShowingModalOpen, setIsShowingModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (reportId && user) {
      fetchReport();
    }
  }, [reportId, user]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from('disclosure_reports')
        .select(`
          *,
          properties (*)
        `)
        .eq('id', reportId)
        .eq('status', 'complete')
        .single();

      if (error) throw error;
      setReport(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast({
        title: "Error",
        description: "Failed to load report",
        variant: "destructive",
      });
      navigate('/dashboard');
    } finally {
      setLoadingData(false);
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

  const downloadReport = async () => {
    if (!report) return;
    
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your report...",
      });

      const { data, error } = await supabase.functions.invoke('generate-pdf-report', {
        body: { reportId: report.id }
      });

      if (error) throw error;

      // If the response is a blob, handle it directly
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `disclosure-report-${report.properties?.full_address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Complete",
          description: "Your PDF report has been downloaded",
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShowingRequest = () => {
    setIsShowingModalOpen(true);
  };

  const formatRiskAssessment = (summary: string) => {
    try {
      const parsed = JSON.parse(summary);
      if (parsed.findings) {
        return parsed.findings.map((finding: any, index: number) => (
          <li key={index} className="flex items-start gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
              finding.risk_level === 'high' ? 'bg-red-500' : 
              finding.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`}></span>
            <span className="text-sm">
              <strong>{finding.category}:</strong> {finding.finding || finding.issue}
            </span>
          </li>
        ));
      }
    } catch (e) {
      // Fallback to simple text
      return [<li key="basic" className="text-sm">{summary}</li>];
    }
    return [<li key="basic" className="text-sm">{summary}</li>];
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Report not found</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullReport = parseReportSummary(report.report_summary_full);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleShowingRequest} variant="default">
                <Calendar className="w-4 h-4 mr-2" />
                Book Showing
              </Button>
              <Button onClick={downloadReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Property Analysis Report</h1>
            <p className="text-xl text-muted-foreground">{report.properties.full_address}</p>
            <p className="text-sm text-muted-foreground">
              Purchased on {new Date(report.created_at).toLocaleDateString()}
            </p>
          </div>

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
                <ul className="space-y-2">
                  {formatRiskAssessment(report.report_summary_basic)}
                </ul>
              </CardContent>
            </Card>

            {/* Full Report Findings */}
            {fullReport && fullReport.findings && (
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Findings</CardTitle>
                  <CardDescription>
                    Complete analysis of potential issues and negotiation strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {fullReport.findings.map((finding: any, index: number) => (
                      <div key={index}>
                        <div className="border-l-4 border-primary pl-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-lg">{finding.category}</h4>
                            <div className="flex gap-2 items-center">
                              <Badge variant={finding.risk_level === 'high' ? 'destructive' : finding.risk_level === 'medium' ? 'secondary' : 'default'}>
                                {finding.risk_level.charAt(0).toUpperCase() + finding.risk_level.slice(1)} Risk
                              </Badge>
                              {finding.source_page && (
                                <Badge variant="outline">
                                  Page {finding.source_page}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-muted-foreground mb-3 leading-relaxed">
                            {finding.finding || finding.issue}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium mb-1 flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                Estimated Cost
                              </h5>
                              <p className="text-sm text-muted-foreground">{finding.estimated_cost}</p>
                            </div>
                            <div>
                              <h5 className="font-medium mb-1">Negotiation Strategy</h5>
                              <p className="text-sm text-muted-foreground">{finding.negotiation_point}</p>
                            </div>
                          </div>
                        </div>
                        {index < fullReport.findings.length - 1 && <Separator className="mt-6" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Report Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This comprehensive analysis provides you with the insights needed to make an informed 
                  decision about this property. Use the findings above to negotiate with the seller and 
                  plan for potential future expenses.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {report && (
        <ShowingRequestModal
          isOpen={isShowingModalOpen}
          onClose={() => setIsShowingModalOpen(false)}
          property={{
            id: report.property_id,
            full_address: report.properties.full_address,
            city: report.properties.city,
            state: report.properties.state
          }}
          userCredits={100}
          onRequestSuccess={() => {
            setIsShowingModalOpen(false);
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

export default ReportView;