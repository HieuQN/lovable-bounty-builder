import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Dashboard from '@/components/Dashboard';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">IntelleHouse</h1>
          <p className="text-xl text-muted-foreground mb-8">
            The smart way to handle real estate disclosure reports
          </p>
          <Button asChild size="lg">
            <a href="/auth">Get Started</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Dashboard />
      </main>
    </div>
  );
};

export default Index;
