import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, Clock } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'buyer' | 'agent';
  message_text: string;
  created_at: string;
  is_read: boolean;
}

interface ShowingRequest {
  id: string;
  property_id: string;
  status: string;
  winning_agent_id?: string;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
  agent_profiles?: {
    user_id: string;
    profiles?: {
      first_name?: string;
      email: string;
    };
  };
}

interface ShowingChatProps {
  showingRequest: ShowingRequest;
  onClose: () => void;
}

export const ShowingChat = ({ showingRequest, onClose }: ShowingChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserType();
    fetchMessages();
    const unsubscribe = setupRealtimeSubscription();
    
    // Set up interval to refresh messages every 3 seconds for better real-time feel
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [showingRequest.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkUserType = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    setIsAgent(!!data);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('showing_messages')
        .select('*')
        .eq('showing_request_id', showingRequest.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('showing-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'showing_messages',
          filter: `showing_request_id=eq.${showingRequest.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('showing_messages')
        .insert({
          showing_request_id: showingRequest.id,
          sender_id: user.id,
          sender_type: isAgent ? 'agent' : 'buyer',
          message_text: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getOtherPartyName = () => {
    if (isAgent) {
      return 'Buyer';
    } else {
      return showingRequest.agent_profiles?.profiles?.first_name || 
             showingRequest.agent_profiles?.profiles?.email?.split('@')[0] || 
             'Agent';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Chat - {getOtherPartyName()}
            </CardTitle>
            <CardDescription>
              {showingRequest.properties?.full_address}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">
              {showingRequest.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Messages Area */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <ScrollArea className="h-80 pr-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.sender_id === user?.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOwnMessage 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3 h-3" />
                          <span className="text-xs font-medium">
                            {isOwnMessage ? 'You' : getOtherPartyName()}
                          </span>
                          <div className="flex items-center gap-1 text-xs opacity-70">
                            <Clock className="w-3 h-3" />
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {message.message_text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
            disabled={loading || !newMessage.trim()}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};