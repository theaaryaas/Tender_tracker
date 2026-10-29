import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { syncApi, settingsApi } from '../../utils/api';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Globe, 
  Play, 
  History,
  FileCheck2
} from 'lucide-react';

export const SyncCenterView = () => {
  const { syncState, refreshSyncStatus, showNotification, refreshStats } = useApp();
  const [portals, setPortals] = useState([]);
  const [selectedPortals, setSelectedPortals] = useState(['gem']);
  const [gemPages, setGemPages] = useState(3);
  const [extractPdfs, setExtractPdfs] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const loadPortalsAndHistory = async () => {
      try {
        const [portalRes, histRes] = await Promise.all([
          settingsApi.getPortals(),
          syncApi.getHistory(10)
        ]);
        setPortals(portalRes.data || []);
        setHistory(histRes.data || []);
      } catch (e) {
        console.error('Failed to load sync center data', e);
      }
    };
    loadPortalsAndHistory();
  }, [syncState.is_running]);

  const togglePortal = (key) => {
    setSelectedPortals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleStartSync = async () => {
    if (selectedPortals.length === 0) {
      showNotification('Please select at least one portal', 'warning');
      return;
    }
    try {
      await syncApi.triggerSync({
        sites: selectedPortals,
        gem_pages: gemPages,
        extract_pdfs: extractPdfs
      });
      showNotification('Sync operation started in background', 'success');
      refreshSyncStatus();
      refreshStats();
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Failed to start sync', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Portal Sync Center</h2>
        <p className="text-xs text-slate-500">
          Run asynchronous discovery crawls across e-procurement portals with automated scoring and deduplication.
        </p>
      </div>

      {/* Live Sync Progress Bar */}
      {syncState.is_running && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 text-amber-700 animate-spin" />
              <span className="font-bold text-amber-900 text-sm">Sync Crawl in Progress...</span>
            </div>
            <span className="font-bold text-amber-800 text-sm">{syncState.progress}%</span>
          </div>

          <div className="w-full bg-amber-200/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-amber-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${syncState.progress}%` }}
            ></div>
          </div>

          <p className="text-xs text-amber-800 font-medium">{syncState.current_task}</p>
        </div>
      )}

      {/* Sync Configuration Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Select Portals to Search</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {portals.map((p) => {
            const isChecked = selectedPortals.includes(p.key);
            return (
              <div
                key={p.key}
                onClick={() => togglePortal(p.key)}
                className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                  isChecked
                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{p.name}</span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="rounded text-blue-600 focus:ring-0"
                />
              </div>
            );
          })}
        </div>

        {/* Sync Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GeM Search Depth: <span className="text-blue-600 font-bold">{gemPages} Pages</span> (~{gemPages * 10} tenders/kw)
            </label>
            <input
              type="range"
              min="1"
              max="6"
              value={gemPages}
              onChange={(e) => setGemPages(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex items-center space-x-3 pt-4 sm:pt-0">
            <input
              type="checkbox"
              id="extract_pdfs"
              checked={extractPdfs}
              onChange={(e) => setExtractPdfs(e.target.checked)}
              className="rounded text-blue-600 w-4 h-4"
            />
            <label htmlFor="extract_pdfs" className="text-xs text-slate-700 font-medium cursor-pointer">
              Automatically download and parse PDF tender notices for discovered bids
            </label>
          </div>
        </div>

        {/* Start Button */}
        <div className="pt-2 flex justify-end">
          <button
            disabled={syncState.is_running}
            onClick={handleStartSync}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-2 transition"
          >
            <Play className="w-4 h-4" />
            <span>{syncState.is_running ? 'Sync in Progress...' : 'Start Multi-Portal Sync'}</span>
          </button>
        </div>
      </div>

      {/* Sync History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center space-x-2 font-bold text-slate-900 text-sm">
          <History className="w-4 h-4 text-slate-500" />
          <span>Recent Sync History</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Started At</th>
                <th className="py-2.5 px-4">Portals</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Tenders Found</th>
                <th className="py-2.5 px-4 text-center">New Added</th>
                <th className="py-2.5 px-4">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length > 0 ? (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {h.started_at ? new Date(h.started_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{h.portal_filter}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        h.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{h.tenders_found}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">+{h.tenders_added}</td>
                    <td className="py-3 px-4 text-slate-500">{h.duration_seconds}s</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No sync logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

