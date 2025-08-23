import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const EmailConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      if (!token || type !== 'signup') {
        setStatus('error');
        setMessage('Invalid confirmation link. Please check your email and try again.');
        return;
      }

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (error) throw error;

        if (data.user) {
          setStatus('success');
          setMessage('Email confirmed successfully! You can now sign in to your account.');
          
          toast({
            title: "Email Confirmed!",
            description: "Your account has been activated. Redirecting to dashboard...",
          });

          // Redirect after 3 seconds
          setTimeout(() => {
            // Check user type and redirect appropriately
            const userType = data.user.user_metadata?.user_type;
            if (userType === 'Agent' || data.user.email?.includes('agent')) {
              navigate('/agent-dashboard');
            } else {
              navigate('/dashboard');
            }
          }, 3000);
        }
      } catch (error: any) {
        setStatus('error');
        if (error.message.includes('expired')) {
          setMessage('This confirmation link has expired. Please request a new confirmation email.');
        } else if (error.message.includes('invalid')) {
          setMessage('This confirmation link is invalid. Please check your email and try again.');
        } else {
          setMessage(error.message || 'Failed to confirm email. Please try again.');
        }
      }
    };

    handleEmailConfirmation();
  }, [searchParams, navigate]);

  const handleResendConfirmation = async () => {
    const email = prompt('Please enter your email address to resend confirmation:');
    if (!email) return;

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`
        }
      });

      if (error) throw error;

      toast({
        title: "Confirmation email sent!",
        description: "Please check your email for a new confirmation link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Confirmation</CardTitle>
          <CardDescription>Verifying your email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Confirming your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <Alert>
                <AlertDescription className="text-center">
                  {message}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Redirecting you to your dashboard...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              </div>
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleResendConfirmation}
                  variant="outline" 
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Confirmation Email
                </Button>
                
                <Button 
                  onClick={() => navigate('/auth')}
                  className="w-full"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmation;