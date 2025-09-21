import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationDropdown from './NotificationDropdown';

const Navigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl text-primary hover:text-primary/80 transition-colors">
          InsightHome
        </Link>
        <div className="flex items-center space-x-4">
          {user && <NotificationDropdown />}
          <Button 
            variant={location.pathname === '/' ? 'default' : 'ghost'} 
            asChild
          >
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Link>
          </Button>
          <Button 
            variant={location.pathname === '/agent-dashboard' ? 'default' : 'ghost'} 
            asChild
          >
            <Link to="/agent-dashboard">
              <Users className="w-4 h-4 mr-2" />
              Agent Login
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;