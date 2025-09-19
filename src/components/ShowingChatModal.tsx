import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Send, User, UserCheck } from 'lucide-react';

interface ShowingRequest {
  id: string;
  status: string;
  winning_agent_id: string | null;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
  agent_profiles?: {
    user_id: string;
    profile_bio: string;
  };
}

interface ShowingChatModalProps {
  showingRequest: ShowingRequest;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  sender_type: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  showing_request_id: string;
  updated_at: string;
}

export const ShowingChatModal = ({ showingRequest, isOpen, onClose }: ShowingChatModalProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && showingRequest.id) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [isOpen, showingRequest.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('showing_messages')
        .select('*')
        .eq('showing_request_id', showingRequest.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`showing-messages-${showingRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'showing_messages',
          filter: `showing_request_id=eq.${showingRequest.id}`
        },
        (payload) => {
          console.log('New message:', payload);
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          sender_type: 'buyer',
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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  let lastDate = '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[600px] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Chat with Agent
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default">
              {showingRequest.status === 'awarded' ? 'Matched' : 'Confirmed'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Connected with your assigned agent
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => {
              const messageDate = formatDate(message.created_at);
              const showDateSeparator = messageDate !== lastDate;
              lastDate = messageDate;

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <Badge variant="outline" className="text-xs">
                        {messageDate}
                      </Badge>
                    </div>
                  )}
                  
                  <div
                    className={`flex gap-3 ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user?.id && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_id === user?.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                    
                    {message.sender_id === user?.id && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 flex gap-2 pt-4">
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
      </DialogContent>
    </Dialog>
  );
};