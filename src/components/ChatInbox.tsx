import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ChatList from '@/components/ChatList';
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

interface ChatInboxProps {
  userType: 'buyer' | 'agent';
}

const ChatInbox = ({ userType }: ChatInboxProps) => {
  const [selectedChat, setSelectedChat] = useState<LocalShowingRequest | null>(null);
  const [showingRequests, setShowingRequests] = useState<LocalShowingRequest[]>([]);

  const handleChatSelect = (showing: LocalShowingRequest) => {
    setSelectedChat(showing);
  };

  const handleCloseChat = () => {
    setSelectedChat(null);
    // Refresh the chat list when closing
    window.location.reload();
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Chat List Sidebar */}
      <div className="w-1/3 min-w-[320px] border-r border-border">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversations
          </h2>
        </div>
        <div className="overflow-y-auto h-full">
          <ChatList userType={userType} onChatSelect={handleChatSelect} />
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1">
        {selectedChat ? (
          <ShowingChat
            showingRequest={selectedChat as any}
            onClose={handleCloseChat}
          />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Select a Conversation</h3>
              <p className="text-muted-foreground">
                Choose a conversation from the left to start chatting
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ChatInbox;