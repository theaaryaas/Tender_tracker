import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './features/dashboard/DashboardView';
import { TendersView } from './features/tenders/TendersView';
import { KanbanView } from './features/tenders/KanbanView';
import { SyncCenterView } from './features/sync/SyncCenterView';
import { AnalyticsView } from './features/analytics/AnalyticsView';
import { SettingsView } from './features/settings/SettingsView';
import { TenderDrawer } from './features/tenders/TenderDrawer';
import { CommandPalette } from './components/common/CommandPalette';
import { TenderBackground } from './components/common/TenderBackground';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const App = () => {
  const { currentTab, notification } = useApp();

  return (
    <div className="min-h-screen bg-[#eef3f8] flex flex-col font-sans text-slate-800">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <div className="flex flex-1 relative items-start">
        <Sidebar />

        {/* Content Area with Blueprint Truss & Contract Background */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          <TenderBackground />

          <main className="flex-1 p-5 pb-6 max-w-7xl mx-auto w-full relative z-10">
            {currentTab === 'dashboard' && <DashboardView />}
            {currentTab === 'tenders' && <TendersView />}
            {currentTab === 'kanban' && <KanbanView />}
            {currentTab === 'sync' && <SyncCenterView />}
            {currentTab === 'analytics' && <AnalyticsView />}
            {currentTab === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>

      {/* Tender Details Slide-over Drawer */}
      <TenderDrawer />

      {/* Global Command Palette (Ctrl + K) */}
      <CommandPalette />

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : notification.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-slate-900 text-slate-100 border-slate-700'
          }`}>
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
