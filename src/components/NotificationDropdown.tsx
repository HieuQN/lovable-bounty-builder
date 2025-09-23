import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const NotificationDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Parse the notification URL and extract showing request ID if it's a message notification
    if (notification.type === 'message' && notification.url) {
      try {
        // Extract showing request ID from notification message or fetch it
        const showingRequestId = await getShowingRequestFromNotification(notification);
        
        // Check if user is an agent
        const { data: agentProfile } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        const isAgent = !!agentProfile;
        
        if (isAgent) {
          // Navigate to agent dashboard with message tab and showing ID
          navigate('/agent-dashboard-new', { 
            state: { 
              activeTab: 'messages', 
              selectedShowingId: showingRequestId 
            } 
          });
        } else {
          // Navigate to buyer dashboard with message tab and showing ID
          navigate('/buyer-dashboard', { 
            state: { 
              activeTab: 'messages', 
              selectedShowingId: showingRequestId 
            } 
          });
        }
      } catch (error) {
        console.error('Error handling notification click:', error);
        // Fallback to simple URL navigation
        if (notification.url) {
          navigate(notification.url);
        }
      }
    } else {
      // For non-message notifications, use the simple URL
      if (notification.url) {
        navigate(notification.url);
      }
    }
  };

  const getShowingRequestFromNotification = async (notification: any) => {
    // Try to extract property address from notification message
    const addressMatch = notification.message.match(/about (.+?)$/);
    if (addressMatch) {
      const address = addressMatch[1];
      
      // Find the showing request by property address
      const { data: showingRequest } = await supabase
        .from('showing_requests')
        .select(`
          id,
          properties!inner(full_address, street_address)
        `)
        .or(`properties.full_address.ilike.%${address}%,properties.street_address.ilike.%${address}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return showingRequest?.id;
    }
    
    return null;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'status_update':
        return '✅';
      case 'match':
        return '🏠';
      default:
        return '📢';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs h-auto p-1"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No notifications yet
          </div>
        ) : (
          <>
            {notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`cursor-pointer p-3 ${
                  !notification.is_read ? 'bg-muted/30' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3 w-full">
                  <span className="text-lg flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      !notification.is_read ? 'font-medium' : 'text-muted-foreground'
                    }`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            
            {notifications.length > 10 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-center text-sm text-muted-foreground">
                  +{notifications.length - 10} more notifications
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;