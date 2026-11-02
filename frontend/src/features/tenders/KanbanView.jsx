import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { 
  ArrowRight, 
  Search, 
  X, 
  RefreshCw, 
  Building2, 
  Filter, 
  Sparkles 
} from 'lucide-react';

const COLUMNS = [
  { id: 'New', title: 'New Opportunities', color: 'border-slate-300' },
  { id: 'Reviewing', title: 'Under BD Review', color: 'border-amber-400' },
  { id: 'Bid Ready', title: 'Bid Decided (Go)', color: 'border-emerald-500' },
  { id: 'Submitted', title: 'Bid Submitted', color: 'border-blue-500' },
  { id: 'Won', title: 'Awarded / Won', color: 'border-purple-500' },
];

export const KanbanView = () => {
  const { openTenderDrawer, showNotification, refreshStats } = useApp();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fitFilter, setFitFilter] = useState('all'); // all, direct_fit (>=80), partner (<80)

  const fetchKanbanTenders = async () => {
    setLoading(true);
    try {
      // Fetch up to 500 active pipeline tenders to display across stages
      const res = await tenderApi.getTenders({ limit: 500 });
      setTenders(res.data.items || []);
    } catch (e) {
      console.error(e);
      showNotification('Failed to load Kanban board', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanbanTenders();
  }, []);

  // Real-time synchronization when tender is updated from drawer
  useEffect(() => {
    const handleUpdate = (e) => {
      const updated = e.detail;
      if (updated?.id) {
        setTenders((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      }
    };
    window.addEventListener('tender:updated', handleUpdate);
    return () => window.removeEventListener('tender:updated', handleUpdate);
  }, []);

  const moveTender = async (e, tenderId, nextStatus) => {
    e.stopPropagation();
    try {
      const res = await tenderApi.updateTender(tenderId, { status: nextStatus });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, status: nextStatus } : t))
      );
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data }));
      if (refreshStats) {
        refreshStats();
      }
      showNotification(`Moved to ${nextStatus}`, 'success');
    } catch (e) {
      showNotification('Failed to update tender stage', 'error');
    }
  };

  const cleanOrg = (org) => {
    if (!org) return 'Government Department';
    const primary = org.split('/')[0].split('-')[0].trim();
    return primary.length > 3 ? primary : org.split('/')[0].trim();
  };

  // Filter tenders in real-time across all columns
  const filteredTenders = useMemo(() => {
    let list = tenders;

    if (fitFilter === 'direct_fit') {
      list = list.filter((t) => (t.fit_score || 0) >= 80);
    } else if (fitFilter === 'partner') {
      list = list.filter((t) => (t.fit_score || 0) < 80);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((t) =>
        (t.tender_id && t.tender_id.toLowerCase().includes(q)) ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.organisation && t.organisation.toLowerCase().includes(q)) ||
        (t.portal && t.portal.toLowerCase().includes(q)) ||
        (t.matched_keywords && t.matched_keywords.toLowerCase().includes(q))
      );
    }

    return list;
  }, [tenders, search, fitFilter]);

  const isFiltering = search.trim().length > 0 || fitFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Board Header & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Opportunity Pipeline Board</h2>
          <p className="text-xs text-slate-500">Track and advance bids through business development stages</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project by ID, title, ministry..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Fit Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60 text-xs">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                fitFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center space-x-1 ${
                fitFilter === 'direct_fit' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>&ge; 80% Fit</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchKanbanTenders}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition shadow-2xs cursor-pointer shrink-0"
            title="Refresh board data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Search Notification Banner */}
      {isFiltering && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border border-blue-200/80 rounded-lg text-xs text-blue-900 animate-in fade-in duration-150">
          <span>
            {search && (
              <>
                Matching search <strong className="text-blue-950 font-bold">"{search}"</strong>
              </>
            )}
            {search && fitFilter !== 'all' && ' • '}
            {fitFilter === 'direct_fit' && 'Filtered by ≥ 80% Fit'}
            <span className="text-blue-700 ml-2">
              (Found <strong>{filteredTenders.length}</strong> of {tenders.length} total projects)
            </span>
          </span>

          <button
            onClick={() => {
              setSearch('');
              setFitFilter('all');
            }}
            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-h-[600px] pb-4">
        {COLUMNS.map((col, idx) => {
          const colTenders = filteredTenders.filter((t) => (t.status || 'New') === col.id);
          const totalInCol = tenders.filter((t) => (t.status || 'New') === col.id).length;
          const nextCol = COLUMNS[idx + 1]?.id;

          return (
            <div key={col.id} className="bg-slate-100/70 rounded-xl p-3 flex flex-col space-y-3 border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-xs text-slate-800">{col.title}</span>
                <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-700">
                  {isFiltering && colTenders.length !== totalInCol ? `${colTenders.length} / ${totalInCol}` : colTenders.length}
                </span>
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
                {colTenders.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 font-mono">
                        {t.tender_id}
                      </span>
                      {t.fit_score && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          t.fit_score >= 80 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {t.fit_score}% Fit
                        </span>
                      )}
                    </div>

                    <h4 
                      className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700 transition"
                      title={t.title}
                    >
                      {t.title}
                    </h4>

                    {t.organisation && (
                      <p className="text-[10.5px] text-slate-500 truncate flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{cleanOrg(t.organisation)}</span>
                      </p>
                    )}

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-50">
                      <span className="truncate max-w-[100px] text-[10.5px] font-medium text-slate-600">{t.portal}</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {t.closing_date ? t.closing_date.split(' ')[0] : ''}
                      </span>
                    </div>

                    {nextCol && (
                      <button
                        onClick={(e) => moveTender(e, t.id, nextCol)}
                        className="w-full mt-1.5 py-1 px-2 rounded bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-medium transition flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer"
                      >
                        <span>Advance to {nextCol}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {colTenders.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    {isFiltering ? 'No projects match in this stage.' : 'No tenders in this stage.'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanView;
