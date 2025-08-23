import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const Navigation = () => {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold">IntelleHouse</h1>
          {user && (
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm">Dashboard</Button>
              <Button variant="ghost" size="sm">Bounties</Button>
              <Button variant="ghost" size="sm">Reports</Button>
            </div>
          )}
        </div>
        
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;