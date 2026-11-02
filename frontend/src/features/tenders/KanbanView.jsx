import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { formatDeadline } from '../../utils/dateUtils';
import { 
  ArrowRight, 
  Search, 
  X, 
  RefreshCw, 
  Building2, 
  Sparkles,
  Inbox,
  Eye,
  TrendingUp,
  Send,
  Trophy,
  Clock,
  Kanban
} from 'lucide-react';

const COLUMNS = [
  { 
    id: 'New', 
    title: 'New Opportunities', 
    icon: Inbox,
    dot: 'bg-blue-500',
    topBorder: 'border-t-4 border-t-blue-500',
    badge: 'bg-blue-100 text-blue-800'
  },
  { 
    id: 'Reviewing', 
    title: 'Under BD Review', 
    icon: Eye,
    dot: 'bg-amber-500',
    topBorder: 'border-t-4 border-t-amber-500',
    badge: 'bg-amber-100 text-amber-800'
  },
  { 
    id: 'Bid Ready', 
    title: 'Bid Decided (Go)', 
    icon: TrendingUp,
    dot: 'bg-indigo-500',
    topBorder: 'border-t-4 border-t-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800'
  },
  { 
    id: 'Submitted', 
    title: 'Bid Submitted', 
    icon: Send,
    dot: 'bg-sky-500',
    topBorder: 'border-t-4 border-t-sky-500',
    badge: 'bg-sky-100 text-sky-800'
  },
  { 
    id: 'Won', 
    title: 'Awarded / Won', 
    icon: Trophy,
    dot: 'bg-emerald-500',
    topBorder: 'border-t-4 border-t-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800'
  },
];

// Helper to format values cleanly into Lakhs / Crores
const formatTenderValue = (val) => {
  if (!val) return 'Open Value';
  const clean = String(val).trim();
  if (clean.toLowerCase().startsWith('not') || clean.toLowerCase().startsWith('check') || clean.toLowerCase().startsWith('await')) {
    return 'Open Value';
  }
  const numMatch = clean.replace(/,/g, '').match(/[\d.]+/);
  if (numMatch) {
    const num = parseFloat(numMatch[0]);
    if (!isNaN(num) && num > 0) {
      if (num >= 10000000) {
        return `₹ ${(num / 10000000).toFixed(2)} Cr`;
      }
      if (num >= 100000) {
        return `₹ ${(num / 100000).toFixed(2)} Lakh`;
      }
      return `₹ ${num.toLocaleString('en-IN')}`;
    }
  }
  return clean;
};

export const KanbanView = () => {
  const { openTenderDrawer, showNotification, refreshStats } = useApp();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fitFilter, setFitFilter] = useState('all'); // all, direct_fit (>=80), partner (<80)
  const [visibleNewCount, setVisibleNewCount] = useState(30);

  const fetchKanbanTenders = async () => {
    setLoading(true);
    try {
      const res = await tenderApi.getTenders({ limit: 500 });
      setTenders(res.data.items || []);
    } catch (e) {
      console.error(e);
      showNotification('Failed to load Bid Pipeline', 'error');
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

  const getPortalStyle = (portal) => {
    const p = (portal || '').toLowerCase();
    if (p.includes('gem')) return 'bg-amber-50 text-amber-900 border-amber-300';
    if (p.includes('cppp') || p.includes('central')) return 'bg-blue-50 text-blue-900 border-blue-300';
    if (p.includes('railtel')) return 'bg-cyan-50 text-cyan-900 border-cyan-300';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-5 w-full">
      {/* 1. Page Header & Search Toolbar Card (High Contrast & Visible) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Kanban className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Bid Pipeline
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Track and advance bids through business development stages
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, ministry..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
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
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                fitFilter === 'all' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center space-x-1.5 ${
                fitFilter === 'direct_fit' 
                  ? 'bg-emerald-600 text-white shadow-xs font-bold' 
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>≥ 80% Fit</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchKanbanTenders}
            disabled={loading}
            className="text-xs font-bold px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0"
            title="Refresh board data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Filter Notification Banner */}
      {isFiltering && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 shadow-2xs w-full">
          <span>
            {search && (
              <>
                Matching search <strong className="text-blue-950 font-bold">"{search}"</strong>
              </>
            )}
            {search && fitFilter !== 'all' && ' • '}
            {fitFilter === 'direct_fit' && 'Filtered by ≥ 80% Fit'}
            <span className="text-blue-700 ml-2 font-medium">
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

      {/* 2. Columns Row (Grid of 5 Equal Width Columns, 100% Full-Width Aligned, Solid Opaque Surface) */}
      <div className="overflow-x-auto pb-4 w-full">
        <div className="grid grid-cols-5 gap-3.5 min-w-[1150px] w-full items-start min-h-[620px]">
          {COLUMNS.map((col, idx) => {
            const colTenders = filteredTenders.filter((t) => (t.status || 'New') === col.id);
            const totalInCol = tenders.filter((t) => (t.status || 'New') === col.id).length;
            const ColIcon = col.icon;
            const nextCol = COLUMNS[idx + 1]?.id;

            const displayedTenders = col.id === 'New' 
              ? colTenders.slice(0, visibleNewCount)
              : colTenders;

            return (
              <div 
                key={col.id} 
                className={`bg-slate-100 rounded-xl p-3 flex flex-col space-y-3 border border-slate-200 shadow-xs w-full ${col.topBorder}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot} shrink-0`} />
                    <span className="font-extrabold text-xs text-slate-800 tracking-tight truncate">{col.title}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold shadow-2xs shrink-0 ${col.badge}`}>
                    {isFiltering && colTenders.length !== totalInCol ? `${colTenders.length} / ${totalInCol}` : colTenders.length}
                  </span>
                </div>

                {/* Scrollable Cards Lane */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-17rem)] min-h-[460px] pr-0.5">
                  {displayedTenders.map((t) => {
                    const deadlineInfo = formatDeadline(t.closing_date);
                    const isUrgent = deadlineInfo.urgency === 'critical' || deadlineInfo.urgency === 'urgent';
                    const isUpcoming = deadlineInfo.urgency === 'upcoming';
                    const formattedValue = formatTenderValue(t.estimated_value);

                    return (
                      <div
                        key={t.id}
                        onClick={() => openTenderDrawer(t)}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer space-y-2.5 group"
                      >
                        {/* Top Row: ID, Portal & Fit Badge */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono shrink-0">
                              {t.tender_id}
                            </span>
                            <span className={`text-[9.5px] px-1.5 py-0.5 rounded border font-bold truncate ${getPortalStyle(t.portal)}`}>
                              {t.portal || 'GeM'}
                            </span>
                          </div>

                          {t.fit_score && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${
                              t.fit_score >= 80 
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}>
                              {t.fit_score}% Fit
                            </span>
                          )}
                        </div>

                        {/* Tender Title */}
                        <h4 
                          className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700 transition"
                          title={t.title}
                        >
                          {t.title}
                        </h4>

                        {/* Organisation */}
                        {t.organisation && (
                          <p className="text-[10.5px] font-medium text-slate-600 truncate flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{cleanOrg(t.organisation)}</span>
                          </p>
                        )}

                        {/* Metadata Row: Value & Deadline Countdown */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10.5px]">
                          <span className={`font-extrabold truncate max-w-[110px] ${
                            formattedValue.includes('₹') ? 'text-emerald-700' : 'text-slate-500'
                          }`}>
                            {formattedValue}
                          </span>

                          <div className="flex items-center space-x-1 shrink-0">
                            <Clock className={`w-3 h-3 ${isUrgent ? 'text-rose-500' : isUpcoming ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className={`font-bold text-[10px] ${
                              isUrgent 
                                ? 'text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200' 
                                : isUpcoming 
                                  ? 'text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200' 
                                  : 'text-slate-600'
                            }`}>
                              {deadlineInfo.countdown}
                            </span>
                          </div>
                        </div>

                        {/* Action Button: Next Stage */}
                        {nextCol ? (
                          <button
                            onClick={(e) => moveTender(e, t.id, nextCol)}
                            className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-blue-50/70 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 border border-blue-200/80 hover:border-blue-600 cursor-pointer shadow-2xs"
                          >
                            <span>Advance to {nextCol}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="w-full mt-1 py-1 px-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold text-center flex items-center justify-center space-x-1">
                            <Trophy className="w-3 h-3 text-emerald-600" />
                            <span>Awarded &amp; Won</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Progressive Loading for Column 1 */}
                  {col.id === 'New' && colTenders.length > visibleNewCount && (
                    <button
                      onClick={() => setVisibleNewCount((prev) => prev + 30)}
                      className="w-full py-2 px-3 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 text-xs font-bold shadow-2xs hover:border-blue-300 transition text-center cursor-pointer"
                    >
                      Load 30 More ({colTenders.length - visibleNewCount} remaining)
                    </button>
                  )}

                  {/* Visible Empty State Dropzone */}
                  {colTenders.length === 0 && (
                    <div className="h-44 flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-slate-200 rounded-xl my-4 bg-white/70 space-y-1.5">
                      <ColIcon className="w-6 h-6 text-slate-400" />
                      <p className="text-xs font-bold text-slate-700">No tenders in this stage</p>
                      <p className="text-[11px] text-slate-400 leading-tight">Advance qualified bids here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KanbanView;
