import React from 'react';
import { useApp } from '../../context/AppContext';
import { RefreshCw, Bell, Search, ExternalLink, ShieldCheck } from 'lucide-react';
import { syncApi } from '../../utils/api';

export const Navbar = () => {
  const { syncState, refreshSyncStatus, showNotification, setCurrentTab } = useApp();

  const handleQuickSync = async () => {
    if (syncState.is_running) return;
    try {
      await syncApi.triggerSync({ sites: ['gem'], gem_pages: 3 });
      showNotification('GeM Quick Sync initiated in background', 'success');
      refreshSyncStatus();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Failed to start sync', 'error');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
            BV
          </div>
          <div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">BitVivid</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
              Tender Intelligence
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Sync Status Indicator */}
        {syncState.is_running ? (
          <div 
            onClick={() => setCurrentTab('sync')}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer text-xs font-medium animate-pulse"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing ({syncState.progress}%)</span>
          </div>
        ) : (
          <button
            onClick={handleQuickSync}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            title="Search GeM for new bids"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Sync GeM</span>
          </button>
        )}

        <div className="h-5 w-px bg-slate-200"></div>

        {/* Profile Tag */}
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
            BD
          </div>
          <span className="hidden sm:inline font-medium text-slate-700">Business Dev Team</span>
        </div>
      </div>
    </header>
  );
};

