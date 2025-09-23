import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardSidebar from '@/components/DashboardSidebar';
import BuyerDashboard from '@/components/BuyerDashboard';
import ChatInbox from '@/components/ChatInbox';
import BuyerSettings from '@/components/BuyerSettings';

const BuyerDashboardNew = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('purchased');
  const [selectedShowingId, setSelectedShowingId] = useState<string | null>(null);

  // Handle navigation state from notifications and URL parameters
  useEffect(() => {
    // Check URL parameters first
    const searchParams = new URLSearchParams(location.search);
    const showingFromUrl = searchParams.get('showing');
    if (showingFromUrl) {
      setActiveTab('messages');
      setSelectedShowingId(showingFromUrl);
      return;
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
      case 'purchased':
      case 'available':
      case 'compare':
      case 'upcoming':
      case 'completed':
        return <BuyerDashboard activeTab={activeTab} />;
      case 'messages':
        return <ChatInbox userType="buyer" selectedShowingId={selectedShowingId} />;
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

export default BuyerDashboardNew;