import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ShowingChat } from '@/components/ShowingChat';

interface LocalShowingRequest {
  id: string;
  property_id: string;
  status: string;
  winning_agent_id?: string;
  created_at: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
  agent_profiles?: {
    id: string;
    user_id: string;
    profiles?: {
      first_name?: string;
      email?: string;
    };
  } | null;
  lastMessage?: {
    message_text: string;
    created_at: string;
    sender_type: 'buyer' | 'agent';
  };
}

interface ChatListProps {
  userType: 'buyer' | 'agent';
  onChatSelect?: (showing: LocalShowingRequest) => void;
  onShowingRequestsUpdate?: (requests: LocalShowingRequest[]) => void;
}

const ChatList = ({ userType, onChatSelect, onShowingRequestsUpdate }: ChatListProps) => {
  const { user } = useAuth();
  const [showingRequests, setShowingRequests] = useState<LocalShowingRequest[]>([]);
  const [selectedShowing, setSelectedShowing] = useState<LocalShowingRequest | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchShowingRequests();
    }
  }, [user, userType]);

  const fetchShowingRequests = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('showing_requests')
        .select(`
          *,
          properties (
            full_address,
            city,
            state
          )
        `);

      if (userType === 'buyer') {
        query = query.eq('requested_by_user_id', user?.id);
      } else {
        // For agents, get their agent profile first
        const { data: agentProfile } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (agentProfile) {
          query = query.eq('winning_agent_id', agentProfile.id);
        }
      }

      const { data, error } = await query
        .not('winning_agent_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch last message for each showing and agent info if needed
      const showingsWithMessages = await Promise.all(
        (data || []).map(async (showing) => {
          const { data: lastMessage } = await supabase
            .from('showing_messages')
            .select('message_text, created_at, sender_type')
            .eq('showing_request_id', showing.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Fetch agent profile if this is for a buyer
          let agentProfile = null;
          if (userType === 'buyer' && showing.winning_agent_id) {
            const { data: agent } = await supabase
              .from('agent_profiles')
              .select(`
                id,
                user_id
              `)
              .eq('id', showing.winning_agent_id)
              .maybeSingle();
            
            // Fetch the actual profile
            if (agent) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, email')
                .eq('user_id', agent.user_id)
                .maybeSingle();
              
              agentProfile = {
                ...agent,
                profiles: profile
              };
            }
          }

          return {
            ...showing,
            lastMessage,
            agent_profiles: agentProfile
          };
        })
      );

      setShowingRequests(showingsWithMessages as LocalShowingRequest[]);
      // Notify parent component about updated showing requests
      if (onShowingRequestsUpdate) {
        onShowingRequestsUpdate(showingsWithMessages as LocalShowingRequest[]);
      }
    } catch (error) {
      console.error('Error fetching showing requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (showing: LocalShowingRequest) => {
    if (onChatSelect) {
      onChatSelect(showing);
    } else {
      setSelectedShowing(showing);
      setIsChatOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (showingRequests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Conversations</h3>
          <p className="text-muted-foreground">
            {userType === 'buyer' 
              ? 'Start a conversation by requesting a property showing.' 
              : 'Conversations will appear here when you win showing bids.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Messages</h2>
        <Badge variant="secondary">{showingRequests.length} Conversations</Badge>
      </div>

      <div className="space-y-3">
        {showingRequests.map((showing) => (
          <Card key={showing.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader 
              className="pb-3"
              onClick={() => openChat(showing)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-base mb-1">
                    {showing.properties?.full_address}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mb-2">
                    {userType === 'buyer' 
                      ? `Agent: ${showing.agent_profiles?.profiles?.first_name || 'Unknown'}`
                      : `Showing for: ${showing.properties?.city}, ${showing.properties?.state}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={showing.status === 'awarded' ? 'default' : 'secondary'}>
                    {showing.status}
                  </Badge>
                </div>
              </div>
              
              {showing.lastMessage && (
                <div className="text-sm">
                  <p className="text-muted-foreground line-clamp-2 mb-1">
                    <strong>
                      {showing.lastMessage.sender_type === userType ? 'You' : 
                       userType === 'buyer' ? 'Agent' : 'Buyer'}:
                    </strong>{' '}
                    {showing.lastMessage.message_text}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(showing.lastMessage.created_at), { addSuffix: true })}
                  </div>
                </div>
              )}
              
              {!showing.lastMessage && (
                <p className="text-sm text-muted-foreground">No messages yet</p>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {selectedShowing && isChatOpen && !onChatSelect && (
        <ShowingChat
          showingRequest={selectedShowing as any}
          onClose={() => {
            setIsChatOpen(false);
            setSelectedShowing(null);
            fetchShowingRequests(); // Refresh to show new messages
          }}
        />
      )}
    </div>
  );
};

export default ChatList;