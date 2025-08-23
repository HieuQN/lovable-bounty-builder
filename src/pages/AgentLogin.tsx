import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AgentDashboard from './AgentDashboard';
import { toast } from '@/components/ui/use-toast';
import { UserCheck } from 'lucide-react';

const AgentLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // Check if already logged in from sessionStorage
    return sessionStorage.getItem('agentLoggedIn') === 'true';
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simple hardcoded auth for demo
    if (username === 'admin' && password === 'test123') {
      setIsLoggedIn(true);
      sessionStorage.setItem('agentLoggedIn', 'true');
      toast({
        title: "Login Successful",
        description: "Welcome to the agent dashboard!",
      });
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Use admin/test123",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  if (isLoggedIn) {
    return <AgentDashboard onLogout={() => {
      setIsLoggedIn(false);
      sessionStorage.removeItem('agentLoggedIn');
    }} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle>Agent Login</CardTitle>
            <CardDescription>
              Access the agent dashboard to manage bounties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                <p>Demo credentials:</p>
                <p>Username: <code>admin</code></p>
                <p>Password: <code>test123</code></p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentLogin;