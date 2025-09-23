import { useState } from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import AgentDashboard from '@/components/AgentDashboard';
import ChatInbox from '@/components/ChatInbox';

const AgentDashboardNew = () => {
  const [activeTab, setActiveTab] = useState('bounties');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bounties':
      case 'disclosures':
        return <AgentDashboard activeTab={activeTab} />;
      case 'messages':
        return <ChatInbox userType="agent" />;
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