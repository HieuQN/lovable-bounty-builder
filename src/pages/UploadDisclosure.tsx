import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Upload, Clock, FileText, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

const UploadDisclosureWrapper = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Please log in to access the upload page</p>
            <Button onClick={() => window.location.href = '/agent-dashboard'}>
              Go to Agent Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <UploadDisclosure />;
};

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
      console.log('Creating disclosure report for bounty:', bounty.id);
      
      // Create disclosure report
      const { data: report, error: reportError } = await supabase
        .from('disclosure_reports')
        .insert({
          property_id: bounty.property_id,
          status: 'processing',
          raw_pdf_url: `uploaded-${file.name}-${Date.now()}` // Placeholder file URL
        })
        .select('id')
        .single();

      if (reportError) {
        console.error('Error creating report:', reportError);
        throw reportError;
      }

      console.log('Report created:', report.id);

      // Update bounty status
      const { error: bountyError } = await supabase
        .from('disclosure_bounties')
        .update({ status: 'completed' })
        .eq('id', bounty.id);

      if (bountyError) {
        console.error('Error updating bounty:', bountyError);
        throw bountyError;
      }

      console.log('Bounty updated to completed');

      // Call the edge function to process the analysis
      console.log('Calling process-analysis function...');
      const { error: functionError } = await supabase.functions.invoke('process-analysis', {
        body: { 
          reportId: report.id,
          propertyAddress: bounty.properties?.full_address 
        }
      });

      if (functionError) {
        console.error('Error calling process-analysis function:', functionError);
        // Don't throw here - the report is created, analysis will just be delayed
      } else {
        console.log('Process-analysis function called successfully');
      }

      toast({
        title: "Upload Successful!",
        description: "Your disclosure has been submitted for analysis. Processing will complete in about 15 seconds.",
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

export default UploadDisclosureWrapper;