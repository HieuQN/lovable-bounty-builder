import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Upload, Clock, FileText, ArrowLeft } from 'lucide-react';

interface Bounty {
  id: string;
  property_id: string;
  status: string;
  claim_expiration?: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

const UploadDisclosure = () => {
  const { bountyId } = useParams();
  const navigate = useNavigate();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    fetchBounty();
  }, [bountyId]);

  useEffect(() => {
    if (bounty?.claim_expiration) {
      const timer = setInterval(() => {
        setTimeRemaining(formatTimeRemaining(bounty.claim_expiration!));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [bounty]);

  const fetchBounty = async () => {
    if (!bountyId) return;

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
        .eq('id', bountyId)
        .single();

      if (error) throw error;
      setBounty(data);
    } catch (error) {
      console.error('Error fetching bounty:', error);
      toast({
        title: "Error",
        description: "Failed to load bounty information",
        variant: "destructive",
      });
      navigate('/agent-dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (claimExpiration: string) => {
    const now = new Date();
    const expiry = new Date(claimExpiration);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF file only",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const submitDisclosure = async () => {
    if (!file || !bounty) return;

    setUploading(true);
    
    try {
      // In a real app, you would upload the file to storage first
      // For now, we'll just create the disclosure report with a placeholder

      const { data: report, error: reportError } = await supabase
        .from('disclosure_reports')
        .insert({
          property_id: bounty.property_id,
          // uploaded_by_agent_id: currentAgent.id, // Would be real agent ID
          status: 'processing',
          raw_pdf_url: 'placeholder-file-url' // Would be real file URL
        })
        .select('id')
        .single();

      if (reportError) throw reportError;

      // Update bounty status
      const { error: bountyError } = await supabase
        .from('disclosure_bounties')
        .update({ status: 'completed' })
        .eq('id', bounty.id);

      if (bountyError) throw bountyError;

      // Trigger dummy analysis (simulating the backend workflow)
      setTimeout(async () => {
        await triggerDummyAnalysis(report.id);
      }, 1000);

      toast({
        title: "Upload Successful!",
        description: "Your disclosure has been submitted for analysis. You'll earn credits once processing is complete.",
      });

      navigate('/agent-dashboard');
    } catch (error) {
      console.error('Error submitting disclosure:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to submit disclosure. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const triggerDummyAnalysis = async (reportId: string) => {
    // Simulate the processing workflow
    try {
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay

      const dummyAnalysis = {
        risk_score: Math.round((Math.random() * 7 + 2) * 10) / 10, // 2.0 to 9.0
        summary_teaser: `This report for ${bounty?.properties?.full_address} has been processed. Our initial scan highlights potential items of interest in the foundation and roofing sections. Unlock the full report for a detailed breakdown.`,
        findings: [
          {
            category: "Foundation",
            issue: "Seller noted 'minor seasonal dampness' in the southwest corner of the basement. A hairline crack was previously sealed in 2019.",
            risk_level: "Medium",
            estimated_cost: "$500 - $3,500",
            negotiation_point: "Recommend a foundation inspection contingency. Could be a minor issue or a sign of hydrostatic pressure. A potential point for a seller credit towards waterproofing."
          },
          {
            category: "Roof",
            issue: "Roof is 18 years old (Asphalt Shingle). Seller is not aware of any current leaks.",
            risk_level: "Medium",
            estimated_cost: "$8,000 - $15,000",
            negotiation_point: "An 18-year-old roof is near the end of its typical lifespan. This is a major upcoming expense. Use this to negotiate on price or request a credit, as replacement will likely be needed within 5 years."
          },
          {
            category: "Electrical",
            issue: "Home contains some ungrounded two-prong outlets. Electrical panel is Federal Pacific.",
            risk_level: "High",
            estimated_cost: "$2,500 - $6,000",
            negotiation_point: "Federal Pacific panels are widely considered a fire hazard and may not be insurable. This is a significant safety and financial issue. Strongly recommend requesting the seller replace the panel as a condition of the sale."
          }
        ]
      };

      await supabase
        .from('disclosure_reports')
        .update({
          status: 'complete',
          dummy_analysis_complete: true,
          risk_score: dummyAnalysis.risk_score,
          report_summary_basic: dummyAnalysis.summary_teaser,
          report_summary_full: JSON.stringify(dummyAnalysis)
        })
        .eq('id', reportId);

    } catch (error) {
      console.error('Error in dummy analysis:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bounty || bounty.status !== 'claimed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Bounty not found or not available for upload</p>
            <Button onClick={() => navigate('/agent-dashboard')} className="mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = bounty.claim_expiration && new Date(bounty.claim_expiration) <= new Date();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/agent-dashboard')}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Upload Disclosure</h1>
            <p className="text-xl text-muted-foreground">{bounty.properties?.full_address}</p>
          </div>

          {/* Timer Card */}
          <Card className={`mb-6 ${isExpired ? 'border-red-200 bg-red-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${isExpired ? 'text-red-500' : 'text-orange-500'}`} />
                {isExpired ? 'Claim Expired' : 'Time Remaining'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isExpired ? (
                <div className="text-red-600 font-semibold">
                  Your claim has expired. The bounty is now available to other agents.
                </div>
              ) : (
                <div className="text-2xl font-bold text-orange-600">
                  {timeRemaining}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Disclosure Document Upload
              </CardTitle>
              <CardDescription>
                Upload the property disclosure PDF document for AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={isExpired || uploading}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Only PDF files are accepted. Max file size: 10MB
                </p>
              </div>

              {file && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                  </div>
                </div>
              )}

              <Button
                onClick={submitDisclosure}
                disabled={!file || isExpired || uploading}
                size="lg"
                className="w-full"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing Upload...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Disclosure
                  </>
                )}
              </Button>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>• You will earn 10 credits once the document is processed</p>
                <p>• Analysis typically completes within 2-3 minutes</p>
                <p>• Ensure the PDF is readable and contains complete disclosure information</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UploadDisclosure;