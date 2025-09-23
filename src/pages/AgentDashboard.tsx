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

  // Handle navigation state from notifications
  useEffect(() => {
    if (location.state) {
      const { activeTab: navActiveTab, selectedShowingId: navShowingId } = location.state as any;
      if (navActiveTab) {
        setActiveTab(navActiveTab);
      }
      if (navShowingId) {
        setSelectedShowingId(navShowingId);
      }
    }
  }, [location.state]);

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