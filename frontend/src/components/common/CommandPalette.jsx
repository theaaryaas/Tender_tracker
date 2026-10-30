import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import {
  Search,
  Clock,
  Sparkles,
  Kanban,
  RefreshCw,
  BarChart3,
  ExternalLink,
  Flame,
  FileSpreadsheet,
  X,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

export const CommandPalette = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setCurrentTab,
    openTenderDrawer,
    setTenderFilter,
    showNotification
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  // Search tenders as query changes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await tenderApi.getTenders({ search: query, limit: 6 });
        setResults(res.data.items || []);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isCommandPaletteOpen) return null;

  const handleSelectTender = (tender) => {
    setIsCommandPaletteOpen(false);
    openTenderDrawer(tender);
  };

  const handleQuickAction = (action) => {
    setIsCommandPaletteOpen(false);
    if (action === 'urgent') {
      setTenderFilter('urgent');
      setCurrentTab('tenders');
    } else if (action === 'kanban') {
      setCurrentTab('kanban');
    } else if (action === 'sync') {
      setCurrentTab('sync');
    } else if (action === 'analytics') {
      setCurrentTab('analytics');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200">
          <Search className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tenders by ID, department, keywords, or jump to..."
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1 mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </span>
        </div>

        {/* Content Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3">
          {/* Live Search Results */}
          {loading && (
            <div className="p-4 text-center text-xs text-slate-400">
              Searching tenders pipeline...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Tenders Found ({results.length})
              </p>
              <div className="space-y-1">
                {results.map((tender) => (
                  <button
                    key={tender.id}
                    onClick={() => handleSelectTender(tender)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50/80 transition flex items-center justify-between group border border-transparent hover:border-blue-100"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                          {tender.tender_id}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {tender.portal}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 truncate mt-1 group-hover:text-blue-700">
                        {tender.title}
                      </p>
                      {tender.organisation && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {tender.organisation}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                        (tender.fit_score || 0) >= 80 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {tender.fit_score}% Fit
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 italic">
              No tenders found matching "{query}".
            </div>
          )}

          {/* Quick Shortcuts (shown when query is short) */}
          {query.length < 2 && (
            <div className="space-y-3">
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickAction('urgent')}
                    className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 hover:bg-rose-100/70 text-left transition flex items-center space-x-2.5 group"
                  >
                    <span className="p-1.5 bg-rose-200 text-rose-700 rounded-lg group-hover:scale-105 transition">
                      <Flame className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-rose-900">&lt; 48h Deadlines</p>
                      <p className="text-[10px] text-rose-600">Urgent closing bids</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('kanban')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/70 hover:border-blue-200 text-left transition flex items-center space-x-2.5 group"
                  >
                    <span className="p-1.5 bg-slate-200 text-slate-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <Kanban className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Presales War Room</p>
                      <p className="text-[10px] text-slate-500">Pipeline & Checklists</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('sync')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/70 hover:border-blue-200 text-left transition flex items-center space-x-2.5 group"
                  >
                    <span className="p-1.5 bg-slate-200 text-slate-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <RefreshCw className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Portal Sync Center</p>
                      <p className="text-[10px] text-slate-500">23+ Portals Scraper</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('analytics')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/70 hover:border-blue-200 text-left transition flex items-center space-x-2.5 group"
                  >
                    <span className="p-1.5 bg-slate-200 text-slate-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Analytics Insights</p>
                      <p className="text-[10px] text-slate-500">Fit & Domain Trends</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Navigation Hint */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-semibold text-slate-700">Ctrl + K</kbd> anywhere to open Spotlight</span>
                <span className="text-blue-600 font-semibold cursor-pointer" onClick={() => setIsCommandPaletteOpen(false)}>Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

