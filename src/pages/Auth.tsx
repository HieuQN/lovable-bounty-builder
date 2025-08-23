import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreateDemoUser } from '@/components/CreateDemoUser';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, UserIcon, Briefcase, Mail, ArrowLeft } from 'lucide-react';
import ProfessionalNavigation from '@/components/ProfessionalNavigation';

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'Buyer' | 'Agent'>('Buyer');
  const [showResendModal, setShowResendModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    if (user && !loading) {
      // Fetch user profile to determine correct dashboard
      const redirectUser = async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('user_id', user.id)
            .single();
          
          if (profile?.user_type === 'Agent') {
            navigate('/agent-dashboard');
          } else {
            navigate('/dashboard');
          }
        } catch (error) {
          // Fallback to email-based redirect if profile lookup fails
          if (user.email?.includes('agent')) {
            navigate('/agent-dashboard');
          } else {
            navigate('/dashboard');
          }
        }
      };
      
      redirectUser();
    }
  }, [user, loading, navigate]);

  const handleDemoLogin = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(email, 'demo123');
      if (error) throw error;
      
      // Navigate based on user type
      if (email.includes('agent')) {
        navigate('/agent-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: "Demo Login Failed",
        description: error.message || "Please create demo accounts first",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { error } = await signIn(email, password);
      if (error) {
        // Handle specific signin errors
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setPendingEmail(email);
          setShowResendModal(true);
          return;
        } else {
          setError(error.message);
        }
        throw error;
      }
      
      // Success - redirection will happen automatically via useEffect
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
      
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;

    // Add password validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const { error, message } = await signUp(email, password, firstName, userType);
      if (error) {
        // Handle specific error cases
        if (error.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (error.message.includes('weak_password')) {
          setError('Password is too weak. Please choose a stronger password.');
        } else if (error.message.includes('invalid_email')) {
          setError('Please enter a valid email address.');
        } else {
          setError(error.message);
        }
        throw error;
      }
      
      // Success message
      const successMessage = message || "Account created successfully! Please check your email for a confirmation link.";
      toast({
        title: "Account Created!",
        description: successMessage,
      });
      
      // Clear form
      (e.target as HTMLFormElement).reset();
      setUserType('Buyer');
      
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`
        }
      });

      if (error) throw error;

      toast({
        title: "Verification email sent!",
        description: "Please check your email for the verification link.",
      });
      
      setShowResendModal(false);
      setPendingEmail('');
    } catch (error: any) {
      toast({
        title: "Failed to send verification email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-section">
      <ProfessionalNavigation />
      
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Marketing Content */}
          <div className="text-center lg:text-left space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                Join the Future of{" "}
                <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
                  Real Estate
                </span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Access AI-powered property insights, connect with verified agents, and make smarter real estate decisions.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Instant property analysis</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Professional agent network</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Cost estimation tools</span>
              </div>
            </div>
          </div>
        
        {/* Right Side - Auth Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <Card className="card-gradient border-0 shadow-lg">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold">Welcome to IntelleHouse</CardTitle>
              <CardDescription className="text-base">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {/* Demo Account Buttons */}
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <Button 
                  onClick={() => handleDemoLogin('demo@intellehouse.com')}
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading}
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  Try Demo Buyer Account
                </Button>
                <Button 
                  onClick={() => handleDemoLogin('agent@intellehouse.com')}
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading}
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Try Demo Agent Account
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Password: demo123
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstName">First Name</Label>
                    <Input
                      id="signup-firstName"
                      name="firstName"
                      type="text"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password (min. 6 characters)</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <RadioGroup 
                      value={userType} 
                      onValueChange={(value: 'Buyer' | 'Agent') => setUserType(value)}
                      className="flex flex-row space-x-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Buyer" id="buyer" />
                        <Label htmlFor="buyer" className="flex items-center gap-2 cursor-pointer">
                          <UserIcon className="w-4 h-4" />
                          Buyer
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Agent" id="agent" />
                        <Label htmlFor="agent" className="flex items-center gap-2 cursor-pointer">
                          <Briefcase className="w-4 h-4" />
                          Agent
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      {userType === 'Buyer' 
                        ? "Access property disclosures and request showings" 
                        : "Upload disclosures and bid on showing requests"}
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : `Sign Up as ${userType}`}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Demo Account Creation */}
        <div className="mt-8">
          <CreateDemoUser />
        </div>
      </div>
    </div>
  </div>
      
      {/* Resend Verification Modal */}
      <AlertDialog open={showResendModal} onOpenChange={setShowResendModal}>
        <AlertDialogContent className="dropdown-content">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Verification Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your account exists but hasn't been verified yet. We can send you a new verification email to <strong>{pendingEmail}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowResendModal(false)}
            >
              Cancel
            </Button>
            <AlertDialogAction onClick={handleResendVerification} className="btn-primary">
              Resend Verification Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auth;