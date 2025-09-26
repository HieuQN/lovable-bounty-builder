import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useAgentCounts } from '@/hooks/useAgentCounts';
import NotificationDropdown from './NotificationDropdown';
import { 
  Home, 
  FileText, 
  MessageCircle, 
  ShoppingCart, 
  Calendar, 
  CheckCircle,
  Upload,
  Coins,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  Clock
} from 'lucide-react';

interface DashboardSidebarProps {
  userType: 'buyer' | 'agent';
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardSidebar = ({ userType, activeTab, onTabChange }: DashboardSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { availableBountiesCount, showingRequestsCount } = useAgentCounts();

  const buyerTabs = [
    { id: 'purchased', label: 'My Reports', icon: FileText },
    { id: 'available', label: 'Available Reports', icon: ShoppingCart },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'compare', label: 'Compare Properties', icon: FileText },
    { id: 'upcoming', label: 'Upcoming Showings', icon: Calendar },
    { id: 'completed', label: 'Completed Showings', icon: CheckCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const agentTabs = [
    { id: 'activities', label: 'Available Activities', icon: Coins },
    { id: 'past-activities', label: 'Past Activities', icon: Clock },
    { id: 'disclosures', label: 'My Disclosures', icon: Upload },
    { id: 'showing-requests', label: 'Showing Requests', icon: Calendar },
    { id: 'upcoming-showings', label: 'Upcoming Showings', icon: Calendar },
    { id: 'completed-showings', label: 'Completed Showings', icon: CheckCircle },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const tabs = userType === 'buyer' ? buyerTabs : agentTabs;

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-background border-r border-border flex flex-col h-screen`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <NavLink to="/" className="font-bold text-xl text-primary hover:text-primary/80 transition-colors">
              InsightHome
            </NavLink>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        
        {!isCollapsed && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {userType === 'buyer' ? 'Buyer Dashboard' : 'Agent Dashboard'}
              </span>
              <NotificationDropdown />
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          // Get count for each tab
          const getTabCount = () => {
            if (userType === 'agent') {
              if (tab.id === 'activities') return availableBountiesCount;
              if (tab.id === 'showing-requests') return showingRequestsCount;
            }
            if (tab.id === 'messages') return unreadCount;
            return 0;
          };

          const tabCount = getTabCount();
          const shouldShowBadge = tabCount > 0;
          
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start gap-3 ${isCollapsed ? 'px-3' : 'px-4'} relative`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className={`h-4 w-4 ${isCollapsed ? 'mx-auto' : ''}`} />
              {!isCollapsed && (
                <>
                  <span>{tab.label}</span>
                  {shouldShowBadge && (
                    <Badge 
                      variant={tab.id === 'messages' ? "destructive" : "secondary"} 
                      className="ml-auto h-5 min-w-[20px] text-xs"
                    >
                      {tabCount > 99 ? '99+' : tabCount}
                    </Badge>
                  )}
                </>
              )}
              {isCollapsed && shouldShowBadge && (
                <Badge 
                  variant={tab.id === 'messages' ? "destructive" : "secondary"} 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {tabCount > 99 ? '99+' : tabCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {!isCollapsed && user && (
          <div className="text-sm text-muted-foreground">
            <p className="truncate">{user.email}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSidebar;