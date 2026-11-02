import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { syncApi, settingsApi } from '../../utils/api';
import { 
  RefreshCw, 
  Globe, 
  Play, 
  History,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { formatIndianDateTime } from '../../utils/dateUtils';

export const SyncCenterView = () => {
  const { syncState, refreshSyncStatus, showNotification, refreshStats } = useApp();
  const [portals, setPortals] = useState([]);
  const [selectedPortals, setSelectedPortals] = useState(['gem']);
  const [gemPages, setGemPages] = useState(3);
  const [extractPdfs, setExtractPdfs] = useState(false);
  const [history, setHistory] = useState([]);

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
    <div className="space-y-5 w-full">
      {/* 1. Solid Pure-White Header Card (High Contrast & Perfectly Aligned) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                Portal Sync Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                Multi-Portal Engine
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Run automated scrapers across e-procurement portals with AI keyword extraction and deduplication
            </p>
          </div>
        </div>
      </div>

      {/* 2. Live Sync Status Progress Card (When running) */}
      {syncState.is_running && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 space-y-3 shadow-xs animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
              <span className="font-bold text-amber-950 text-sm">Background Portal Crawl Active</span>
            </div>
            <span className="font-mono font-bold text-amber-900 text-sm">{syncState.progress}%</span>
          </div>

          <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncState.progress}%` }}
            ></div>
          </div>

          <p className="text-xs text-amber-800 font-medium font-mono">{syncState.current_task}</p>
        </div>
      )}

      {/* 3. Scraper Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Target Procurement Portals</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Select portals to query</span>
        </div>

        {/* Portal Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {portals.map((p) => {
            const isChecked = selectedPortals.includes(p.key);
            return (
              <div
                key={p.key}
                onClick={() => togglePortal(p.key)}
                className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex flex-col justify-between space-y-2 select-none ${
                  isChecked
                    ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{p.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isChecked ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {isChecked ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 font-normal">
                  {p.key === 'gem' ? 'GeM BidPlus Portal' : p.key === 'cppp' ? 'Central Public Procurement' : 'State & Rail E-Tenders'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Scraper Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                GeM Search Depth: <span className="text-blue-600 font-bold">{gemPages} Pages</span>
              </label>
              <span className="text-[11px] text-slate-400">~{gemPages * 10} tenders per keyword</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              value={gemPages}
              onChange={(e) => setGemPages(parseInt(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-800">Auto-Extract Tender PDFs</p>
              <p className="text-[11px] text-slate-500">Download and parse BOQ &amp; ATC requirements</p>
            </div>
            <input
              type="checkbox"
              id="extract_pdfs"
              checked={extractPdfs}
              onChange={(e) => setExtractPdfs(e.target.checked)}
              className="rounded text-blue-600 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>

        {/* Action Trigger */}
        <div className="pt-2 flex justify-end">
          <button
            disabled={syncState.is_running}
            onClick={handleStartSync}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{syncState.is_running ? 'Sync in Progress...' : 'Start Multi-Portal Scraper'}</span>
          </button>
        </div>
      </div>

      {/* 4. Sync History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <History className="w-4 h-4 text-slate-500" />
            <span>Recent Sync Audit Log</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Last 10 Crawls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-4">Started At (IST)</th>
                <th className="py-2.5 px-4">Portals</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Tenders Scanned</th>
                <th className="py-2.5 px-4 text-center">New Added</th>
                <th className="py-2.5 px-4">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length > 0 ? (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span>{formatIndianDateTime(h.started_at)}</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                          IST
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{h.portal_filter}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        h.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
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

export default SyncCenterView;
