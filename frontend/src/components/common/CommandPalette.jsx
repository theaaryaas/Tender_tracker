import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  X, 
  ChevronRight, 
  Clock, 
  Flame, 
  BarChart3, 
  Kanban, 
  RefreshCw 
} from 'lucide-react';
import { tenderApi } from '../../utils/api';

export const CommandPalette = () => {
  const { 
    isCommandPaletteOpen, 
    setIsCommandPaletteOpen, 
    openTenderDrawer, 
    setCurrentTab 
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Auto focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [isCommandPaletteOpen]);

  // Debounced search
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
        console.error('Command palette search error:', e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const handleSelectTender = (tender) => {
    openTenderDrawer(tender);
    setIsCommandPaletteOpen(false);
  };

  const handleQuickAction = (action) => {
    setIsCommandPaletteOpen(false);
    if (action === 'urgent') {
      window.dispatchEvent(new CustomEvent('tender:open-deadlines'));
    } else if (action === 'kanban') {
      setCurrentTab('kanban');
    } else if (action === 'sync') {
      setCurrentTab('sync');
    } else if (action === 'analytics') {
      setCurrentTab('analytics');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#141021]/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E2DEEC]">
          <Search className="w-5 h-5 text-[#6B46C1] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tenders by ID, department, keywords, or jump to..."
            className="w-full text-sm font-medium text-[#1E182B] placeholder-[#8C82A0] bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#8C82A0] hover:text-[#1E182B] p-1 mr-1 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-bold text-[#8C82A0] bg-[#FAF9FD] px-2 py-0.5 rounded border border-[#E2DEEC]">
            ESC
          </span>
        </div>

        {/* Content Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3">
          {/* Live Search Results */}
          {loading && (
            <div className="p-4 text-center text-xs text-[#8C82A0]">
              Searching all tenders...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8C82A0]">
                Tenders Found ({results.length})
              </p>
              <div className="space-y-1">
                {results.map((tender) => (
                  <button
                    key={tender.id}
                    onClick={() => handleSelectTender(tender)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-[#FAF9FD] transition flex items-center justify-between group border border-transparent hover:border-[#D8BFD8] cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-[#4A337A] bg-[#E6E6FA] px-1.5 py-0.2 rounded border border-[#D8BFD8]">
                          {tender.tender_id}
                        </span>
                        <span className="text-[10px] text-[#8C82A0] truncate">
                          {tender.portal}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#1E182B] truncate mt-1 group-hover:text-[#6B46C1] transition">
                        {tender.title}
                      </p>
                      {tender.organisation && (
                        <p className="text-[10px] text-[#8C82A0] truncate">
                          {tender.organisation}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                        (tender.fit_score || 0) >= 80 
                          ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8D8C4]' 
                          : 'bg-[#FAF9FD] text-[#584E6B] border border-[#E2DEEC]'
                      }`}>
                        {tender.fit_score}% Fit
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#8C82A0] group-hover:text-[#6B46C1] transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-xs text-[#8C82A0] italic">
              No tenders found matching "{query}".
            </div>
          )}

          {/* Quick Shortcuts (shown when query is short) */}
          {query.length < 2 && (
            <div className="space-y-3">
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8C82A0]">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickAction('urgent')}
                    className="p-2.5 rounded-xl bg-[#FFF2E5] border border-[#FFDAB9] hover:bg-[#FFE8D6] text-left transition flex items-center space-x-2.5 group cursor-pointer shadow-2xs"
                  >
                    <span className="p-1.5 bg-[#FFDAB9] text-[#9A3412] rounded-lg group-hover:scale-105 transition">
                      <Flame className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#7C2D12]">&lt; 48h Deadlines</p>
                      <p className="text-[10px] text-[#9A3412]">Urgent closing bids</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('kanban')}
                    className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] hover:bg-white hover:border-[#D8BFD8] text-left transition flex items-center space-x-2.5 group cursor-pointer shadow-2xs"
                  >
                    <span className="p-1.5 bg-[#E6E6FA] text-[#6B46C1] rounded-lg group-hover:bg-[#6B46C1] group-hover:text-white transition">
                      <Kanban className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition">Presales War Room</p>
                      <p className="text-[10px] text-[#584E6B]">Pipeline & Checklists</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('sync')}
                    className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] hover:bg-white hover:border-[#D8BFD8] text-left transition flex items-center space-x-2.5 group cursor-pointer shadow-2xs"
                  >
                    <span className="p-1.5 bg-[#E6E6FA] text-[#6B46C1] rounded-lg group-hover:bg-[#6B46C1] group-hover:text-white transition">
                      <RefreshCw className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition">Portal Sync Center</p>
                      <p className="text-[10px] text-[#584E6B]">23+ Portals Scraper</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('analytics')}
                    className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] hover:bg-white hover:border-[#D8BFD8] text-left transition flex items-center space-x-2.5 group cursor-pointer shadow-2xs"
                  >
                    <span className="p-1.5 bg-[#E6E6FA] text-[#6B46C1] rounded-lg group-hover:bg-[#6B46C1] group-hover:text-white transition">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition">Analytics Insights</p>
                      <p className="text-[10px] text-[#584E6B]">Fit & Domain Trends</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Navigation Hint */}
              <div className="p-2.5 bg-[#FAF9FD] rounded-xl border border-[#E2DEEC] text-[11px] text-[#584E6B] flex items-center justify-between">
                <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-[#E2DEEC] rounded font-semibold text-[#1E182B]">Ctrl + K</kbd> anywhere to open Spotlight</span>
                <span className="text-[#6B46C1] font-semibold cursor-pointer hover:underline" onClick={() => setIsCommandPaletteOpen(false)}>Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
