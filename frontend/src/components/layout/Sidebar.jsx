import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  ListFilter, 
  Kanban, 
  RefreshCw, 
  BarChart3, 
  Sliders, 
  DownloadCloud 
} from 'lucide-react';

export const Sidebar = () => {
  const { currentTab, setCurrentTab, stats } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenders', label: 'Tenders Pipeline', icon: ListFilter, badge: stats?.total_tenders },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban },
    { id: 'sync', label: 'Sync Center', icon: RefreshCw },
    { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3 },
    { id: 'settings', label: 'Company Settings', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  active 
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    active ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-between">
          <span>Target Domains:</span>
          <span className="text-slate-400 font-semibold">AI, VMS, CCTV, ITMS</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          BitVivid Solutions Pvt. Ltd. Internal Enterprise Tracker v2.0
        </p>
      </div>
    </aside>
  );
};

