import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardSidebar from '@/components/DashboardSidebar';
import AgentDashboard from '@/components/AgentDashboard';
import ChatInbox from '@/components/ChatInbox';
import AgentShowingRequests from '@/components/AgentShowingRequests';
import AgentUpcomingShowings from '@/components/AgentUpcomingShowings';
import AgentCompletedShowings from '@/components/AgentCompletedShowings';
import AgentSettings from '@/components/AgentSettings';

const AgentDashboardNew = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('bounties');
  const [selectedShowingId, setSelectedShowingId] = useState<string | null>(null);

  // Handle navigation state from notifications and URL parameters
  useEffect(() => {
    // Check URL parameters
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const showingParam = searchParams.get('showing');
    
    if (tabParam) {
      setActiveTab(tabParam);
    }
    
    if (showingParam) {
      setActiveTab('messages');
      setSelectedShowingId(showingParam);
    }
    
    // Check navigation state from notifications
    if (location.state) {
      const { activeTab: navActiveTab, selectedShowingId: navShowingId } = location.state as any;
      if (navActiveTab) {
        setActiveTab(navActiveTab);
      }
      if (navShowingId) {
        setSelectedShowingId(navShowingId);
      }
    }
  }, [location.search, location.state]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bounties':
      case 'disclosures':
        return <AgentDashboard activeTab={activeTab} />;
      case 'showing-requests':
        return <AgentShowingRequests />;
      case 'upcoming-showings':
        return <AgentUpcomingShowings />;
      case 'completed-showings':
        return <AgentCompletedShowings />;
      case 'messages':
        return <ChatInbox userType="agent" selectedShowingId={selectedShowingId} />;
      case 'settings':
        return <AgentSettings />;
      default:
        return <AgentDashboard activeTab={activeTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar userType="agent" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboardNew;