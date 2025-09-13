import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Clock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PDFAnalyzer } from '@/components/PDFAnalyzer';

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
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [reportId, setReportId] = useState<string>('');
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

  const handleAnalysisStart = async () => {
    if (!bounty) return;

    try {
      setAnalysisStarted(true);
      setUploading(true);

      // Get current user's agent profile
      const { data: userResponse, error: userError } = await supabase.auth.getUser();
      if (userError || !userResponse.user) {
        console.error('Auth error:', userError);
        throw new Error('User not authenticated');
      }

      console.log('Current user ID:', userResponse.user.id);

      const { data: agentProfile, error: agentError } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', userResponse.user.id)
        .single();

      if (agentError || !agentProfile) {
        console.error('Agent profile error:', agentError);
        throw new Error('Agent profile not found. Please ensure you have an agent profile.');
      }

      console.log('Agent profile ID:', agentProfile.id);

      // Create disclosure report
      const { data: report, error: reportError } = await supabase
        .from('disclosure_reports')
        .insert({
          property_id: bounty.property_id,
          uploaded_by_agent_id: agentProfile.id,
          status: 'pending'
        })
        .select('id')
        .single();

      if (reportError) {
        console.error('Error creating report:', reportError);
        throw reportError;
      }

      setReportId(report.id);
      return report.id;

    } catch (error) {
      console.error('Error creating disclosure report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create disclosure report. Please try again.",
        variant: "destructive",
      });
      setAnalysisStarted(false);
      setUploading(false);
      throw error;
    }
  };

  const handleAnalysisComplete = async (result: any) => {
    if (!bounty) return;

    try {
      // Update bounty status to completed
      const { error: bountyError } = await supabase
        .from('disclosure_bounties')
        .update({ status: 'completed' })
        .eq('id', bounty.id);

      if (bountyError) throw bountyError;

      setAnalysisComplete(true);
      setUploading(false);

      toast({
        title: "Success!",
        description: "Disclosure analysis completed successfully!",
      });

      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        navigate('/agent-dashboard-new');
      }, 2000);

    } catch (error) {
      console.error('Error updating bounty:', error);
      toast({
        title: "Error",
        description: "Analysis completed but failed to update bounty status.",
        variant: "destructive",
      });
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

          {/* PDF Analysis Section */}
          {!isExpired && (
            <>
              {!analysisStarted ? (
                <PDFAnalyzer
                  reportId={reportId}
                  onAnalysisStart={handleAnalysisStart}
                  onAnalysisComplete={handleAnalysisComplete}
                />
              ) : analysisComplete ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-green-600 text-xl font-semibold mb-2">
                      ✅ Analysis Complete!
                    </div>
                    <p className="text-muted-foreground">
                      Redirecting to dashboard...
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <div className="text-lg font-semibold mb-2">
                      Analyzing PDF...
                    </div>
                    <p className="text-muted-foreground">
                      This may take up to 30 seconds. Please don't close this page.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              <div className="text-sm text-muted-foreground space-y-2 mt-4">
                <p>• You will earn 10 credits once the document is processed</p>
                <p>• Analysis uses advanced AI to identify property risks and issues</p>
                <p>• Ensure the PDF is readable and contains complete disclosure information</p>
              </div>
            </>
          )}
          
          {isExpired && (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-red-600 text-xl font-semibold mb-2">
                  Claim Expired
                </div>
                <p className="text-muted-foreground">
                  Your claim has expired. The bounty is now available to other agents.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadDisclosureWrapper;