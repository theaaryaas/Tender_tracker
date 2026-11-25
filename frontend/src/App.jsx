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
import { BiddingCRMView } from './features/crm/BiddingCRMView';
import { UserManagementView } from './features/admin/UserManagementView';
import { AuditTrailView } from './features/audit/AuditTrailView';
import { CompanyContactsView } from './features/contacts/CompanyContactsView';
import { TenderAnalysisPage } from './features/analysis/TenderAnalysisPage';
import { AuthView } from './features/auth/AuthView';
import { TenderDrawer } from './features/tenders/TenderDrawer';
import { CommandPalette } from './components/common/CommandPalette';
import { NotificationModal } from './components/layout/NotificationModal';
import { TenderBackground } from './components/common/TenderBackground';
import { 
  CheckCircle2, 
  AlertCircle, 
  Info,
  LayoutDashboard,
  ListFilter,
  Kanban,
  RefreshCw,
  Sliders,
  Menu
} from 'lucide-react';

export const App = () => {
  const { 
    currentTab, 
    setCurrentTab, 
    stats,
    notification, 
    isAuthenticated, 
    isNotificationModalOpen, 
    closeNotificationModal, 
    openTenderDrawer,
    setIsMobileSidebarOpen 
  } = useApp();

  // If user is not authenticated, present the Lavender Dream Login & Sign Up page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9FD] flex flex-col font-sans text-[#1E182B] selection:bg-[#E6E6FA] selection:text-[#553C9A]">
        <AuthView />

        {/* Global Notification Toast */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-[80] animate-in slide-in-from-bottom-5 duration-200">
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

          <main className="flex-1 px-3 sm:px-6 py-4 sm:py-5 w-full relative z-10 pb-24 sm:pb-20 md:pb-6">
            {currentTab === 'dashboard' && <DashboardView />}
            {currentTab === 'tenders' && <AllTendersView />}
            {currentTab === 'analysis' && <TenderAnalysisPage />}
            {currentTab === 'contacts' && <CompanyContactsView />}
            {currentTab === 'crm' && <BiddingCRMView />}
            {currentTab === 'kanban' && <BidPipelineView />}
            {currentTab === 'sync' && <SyncCenterView />}
            {currentTab === 'analytics' && <AnalyticsInsightsView />}
            {currentTab === 'users' && <UserManagementView />}
            {currentTab === 'audit' && <AuditTrailView />}
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

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E2DEEC] z-40 md:hidden flex items-center justify-around py-1 px-1 shadow-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'tenders', label: 'Tenders', icon: ListFilter, badge: stats?.total_tenders },
          { id: 'kanban', label: 'Pipeline', icon: Kanban },
          { id: 'settings', label: 'Settings', icon: Sliders },
          { id: 'more', label: 'Menu', icon: Menu, isDrawerTrigger: true },
        ].map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isDrawerTrigger) {
                  setIsMobileSidebarOpen(true);
                } else {
                  setCurrentTab(item.id);
                }
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition cursor-pointer relative ${
                active && !item.isDrawerTrigger
                  ? 'text-[#6B46C1] font-bold'
                  : 'text-[#8C82A0] hover:text-[#584E6B]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${active && !item.isDrawerTrigger ? 'text-[#6B46C1]' : 'text-[#8C82A0]'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#6B46C1] text-white text-[8px] font-mono font-bold px-1 rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-[80] animate-in slide-in-from-bottom-5 duration-200">
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
