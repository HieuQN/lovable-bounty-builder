import { useState } from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import BuyerDashboard from '@/components/BuyerDashboard';
import ChatInbox from '@/components/ChatInbox';
import BuyerSettings from '@/components/BuyerSettings';

const BuyerDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('purchased');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'purchased':
      case 'available':
      case 'compare':
      case 'upcoming':
      case 'completed':
        return <BuyerDashboard activeTab={activeTab} />;
      case 'messages':
        return <ChatInbox userType="buyer" />;
      case 'settings':
        return <BuyerSettings />;
      default:
        return <BuyerDashboard activeTab={activeTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar userType="buyer" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboardPage;