import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Home from "./pages/Home";
import Analyze from "./pages/Analyze";
import Auth from "./pages/Auth";
import BuyerDashboard from "./pages/BuyerDashboard";
import BuyerDashboardNew from "./pages/BuyerDashboardNew";
import AgentDashboardNew from "./pages/AgentDashboardNew";
import ReportView from "./pages/ReportView";
import AgentLogin from "./pages/AgentLogin";
import UploadDisclosure from "./pages/UploadDisclosure";
import EmailConfirmation from "./pages/EmailConfirmation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze/:propertyId" element={<Analyze />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/confirm-email" element={<EmailConfirmation />} />
            <Route path="/dashboard" element={<BuyerDashboard />} />
            <Route path="/buyer-dashboard" element={<BuyerDashboardNew />} />
            <Route path="/agent-dashboard-new" element={<AgentDashboardNew />} />
            <Route path="/report/:reportId" element={<ReportView />} />
            <Route path="/agent-dashboard" element={<AgentLogin />} />
            <Route path="/upload/:bountyId" element={<UploadDisclosure />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
