import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './features/dashboard/DashboardView';
import { AllTendersView } from './features/tenders/AllTendersView';
import { BidPipelineView } from './features/tenders/BidPipelineView';
import { SyncCenterView } from './features/sync/SyncCenterView';
import { AnalyticsInsightsView } from './features/analytics/AnalyticsInsightsView';
import { CompanySettingsView } from './features/settings/CompanySettingsView';
import { AuthView } from './features/auth/AuthView';
import { TenderDrawer } from './features/tenders/TenderDrawer';
import { CommandPalette } from './components/common/CommandPalette';
import { NotificationModal } from './components/layout/NotificationModal';
import { TenderBackground } from './components/common/TenderBackground';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const App = () => {
  const { currentTab, setCurrentTab, notification, isAuthenticated, isNotificationModalOpen, closeNotificationModal, openTenderDrawer } = useApp();

  // If user is not authenticated, present the Lavender Dream Login & Sign Up page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9FD] flex flex-col font-sans text-[#1E182B] selection:bg-[#E6E6FA] selection:text-[#553C9A]">
        <AuthView />

        {/* Global Notification Toast */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
            <div className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
              notification.type === 'success'
                ? 'bg-[#2E5A36] text-[#E8F5E9] border-[#A8C2A3]'
                : notification.type === 'error'
                ? 'bg-[#7F1D1D] text-[#FEE2E2] border-[#FCA5A5]'
                : 'bg-[#1E182B] text-[#E6E6FA] border-[#D8BFD8]'
            }`}>
              {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#C8D8C4]" />}
              {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-300" />}
              {notification.type === 'info' && <Info className="w-4 h-4 text-[#D8BFD8]" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9FD] flex flex-col font-sans text-[#1E182B] selection:bg-[#E6E6FA] selection:text-[#553C9A]">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <div className="flex flex-1 relative items-start">
        <Sidebar />

        {/* Content Area with Blueprint Truss & Contract Background */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          <TenderBackground />

          <main className="flex-1 px-6 py-5 w-full relative z-10">
            {currentTab === 'dashboard' && <DashboardView />}
            {currentTab === 'tenders' && <AllTendersView />}
            {currentTab === 'kanban' && <BidPipelineView />}
            {currentTab === 'sync' && <SyncCenterView />}
            {currentTab === 'analytics' && <AnalyticsInsightsView />}
            {currentTab === 'settings' && <CompanySettingsView />}
          </main>
        </div>
      </div>

      {/* Tender Details Slide-over Drawer */}
      <TenderDrawer />

      {/* Global Command Palette (Ctrl + K) */}
      <CommandPalette />

      {/* Tender Radar & Alerts Pop-up Window Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={closeNotificationModal}
        onSelectTender={openTenderDrawer}
        onNavigateSync={() => setCurrentTab('sync')}
        onNavigateDashboard={() => setCurrentTab('dashboard')}
      />

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-[#2E5A36] text-[#E8F5E9] border-[#A8C2A3]'
              : notification.type === 'error'
              ? 'bg-[#7F1D1D] text-[#FEE2E2] border-[#FCA5A5]'
              : 'bg-[#1E182B] text-[#E6E6FA] border-[#D8BFD8]'
          }`}>
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#C8D8C4]" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-300" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-[#D8BFD8]" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
