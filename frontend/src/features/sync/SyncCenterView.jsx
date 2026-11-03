import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { syncApi, settingsApi } from '../../utils/api';
import { 
  RefreshCw, 
  Globe, 
  Play, 
  History
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
      {/* 1. Header Card (Lavender Dream Palette) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Portal Sync Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs">
                Multi-Portal Engine
              </span>
            </div>
            <p className="text-xs font-medium text-[#584E6B] mt-1">
              Run automated scrapers across e-procurement portals with AI keyword extraction and deduplication
            </p>
          </div>
        </div>
      </div>

      {/* 2. Live Sync Status Progress Card (Peach Puff #FFDAB9 Accent) */}
      {syncState.is_running && (
        <div className="bg-[#FFF2E5] border border-[#FFDAB9] rounded-2xl p-5 space-y-3 shadow-xs animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <RefreshCw className="w-4 h-4 text-[#A85B24] animate-spin" />
              <span className="font-bold text-[#8C4A1D] text-sm">Background Portal Crawl Active</span>
            </div>
            <span className="font-mono font-bold text-[#9A3412] text-sm">{syncState.progress}%</span>
          </div>

          <div className="w-full bg-[#FFE5CC] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#C96E2E] h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncState.progress}%` }}
            ></div>
          </div>

          <p className="text-xs text-[#8C4A1D] font-medium font-mono">{syncState.current_task}</p>
        </div>
      )}

      {/* 3. Scraper Configuration Card */}
      <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7]">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-[#584E6B]" />
            <h3 className="font-bold text-[#1E182B] text-sm">Target Procurement Portals</h3>
          </div>
          <span className="text-xs text-[#8C82A0] font-mono">Select portals to query</span>
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
                    ? 'bg-[#E6E6FA] border-[#6B46C1] text-[#1E182B] shadow-2xs'
                    : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B] hover:bg-[#F3EFF8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{p.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isChecked ? 'bg-[#6B46C1] text-white' : 'bg-[#E2DEEC] text-[#584E6B]'}`}>
                    {isChecked ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#8C82A0] font-normal">
                  {p.key === 'gem' ? 'GeM BidPlus Portal' : p.key === 'cppp' ? 'Central Public Procurement' : 'State & Rail E-Tenders'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Scraper Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#F0EDF7]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1E182B]">
                GeM Search Depth: <span className="text-[#6B46C1] font-bold">{gemPages} Pages</span>
              </label>
              <span className="text-[11px] text-[#8C82A0] font-mono">~{gemPages * 10} tenders/kw</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              value={gemPages}
              onChange={(e) => setGemPages(parseInt(e.target.value))}
              className="w-full accent-[#6B46C1] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#FAF9FD] rounded-xl border border-[#E2DEEC]">
            <div>
              <p className="text-xs font-bold text-[#1E182B]">Auto-Extract Tender PDFs</p>
              <p className="text-[11px] text-[#584E6B]">Download and parse BOQ &amp; ATC requirements</p>
            </div>
            <input
              type="checkbox"
              id="extract_pdfs"
              checked={extractPdfs}
              onChange={(e) => setExtractPdfs(e.target.checked)}
              className="rounded text-[#6B46C1] w-4 h-4 cursor-pointer accent-[#6B46C1]"
            />
          </div>
        </div>

        {/* Action Trigger (Royal Iris #6B46C1) */}
        <div className="pt-2 flex justify-end">
          <button
            disabled={syncState.is_running}
            onClick={handleStartSync}
            className="px-5 py-2.5 bg-[#6B46C1] hover:bg-[#553C9A] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-900/15 inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{syncState.is_running ? 'Sync in Progress...' : 'Start Multi-Portal Scraper'}</span>
          </button>
        </div>
      </div>

      {/* 4. Sync History Table */}
      <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#F0EDF7] flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-sm">
            <History className="w-4 h-4 text-[#584E6B]" />
            <span>Recent Sync Audit Log</span>
          </div>
          <span className="text-xs text-[#8C82A0] font-mono">Last 10 Crawls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9FD] text-[#584E6B] font-semibold uppercase tracking-wider border-b border-[#E2DEEC]">
              <tr>
                <th className="py-2.5 px-4">Started At (IST)</th>
                <th className="py-2.5 px-4">Portals</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Tenders Scanned</th>
                <th className="py-2.5 px-4 text-center">New Added</th>
                <th className="py-2.5 px-4">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDF7]">
              {history.length > 0 ? (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-[#E6E6FA]/20 transition">
                    <td className="py-3 px-4 font-medium text-[#1E182B]">
                      <div className="flex items-center space-x-2">
                        <span>{formatIndianDateTime(h.started_at)}</span>
                        <span className="text-[10px] font-bold text-[#3B2961] bg-[#E6E6FA] border border-[#D8BFD8] px-1.5 py-0.2 rounded font-mono">
                          IST
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#584E6B] truncate max-w-xs">{h.portal_filter}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        h.status === 'COMPLETED' ? 'bg-[#E8F3E6] text-[#244E2C] border border-[#C8D8C4]' : 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#1E182B] font-mono">{h.tenders_found}</td>
                    <td className="py-3 px-4 text-center font-bold text-[#2E7D32] font-mono">+{h.tenders_added}</td>
                    <td className="py-3 px-4 text-[#8C82A0] font-mono">{h.duration_seconds}s</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[#8C82A0]">
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
