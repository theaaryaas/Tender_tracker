import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { formatDeadline } from '../../utils/dateUtils';
import { 
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
  ArrowRight,
  Kanban
} from 'lucide-react';

const COLUMNS = [
  { 
    id: 'New', 
    title: 'New Opportunities', 
    icon: Inbox,
    dot: 'bg-blue-600',
    headerBg: 'bg-blue-50/80 border-blue-200',
    headerText: 'text-blue-950',
    countBadge: 'bg-blue-600 text-white'
  },
  { 
    id: 'Reviewing', 
    title: 'Under BD Review', 
    icon: Eye,
    dot: 'bg-amber-600',
    headerBg: 'bg-amber-50/80 border-amber-200',
    headerText: 'text-amber-950',
    countBadge: 'bg-amber-600 text-white'
  },
  { 
    id: 'Bid Ready', 
    title: 'Bid Decided (Go)', 
    icon: TrendingUp,
    dot: 'bg-indigo-600',
    headerBg: 'bg-indigo-50/80 border-indigo-200',
    headerText: 'text-indigo-950',
    countBadge: 'bg-indigo-600 text-white'
  },
  { 
    id: 'Submitted', 
    title: 'Bid Submitted', 
    icon: Send,
    dot: 'bg-sky-600',
    headerBg: 'bg-sky-50/80 border-sky-200',
    headerText: 'text-sky-950',
    countBadge: 'bg-sky-600 text-white'
  },
  { 
    id: 'Won', 
    title: 'Awarded / Won', 
    icon: Trophy,
    dot: 'bg-emerald-600',
    headerBg: 'bg-emerald-50/80 border-emerald-200',
    headerText: 'text-emerald-950',
    countBadge: 'bg-emerald-600 text-white'
  },
];

// Formats financial numbers into Lakhs / Crores
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

  // Synchronize when updated from slide-over drawer
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
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data || { id: tenderId, status: nextStatus } }));
      if (refreshStats) {
        refreshStats();
      }
      showNotification(`Moved to ${nextStatus}`, 'success');
    } catch (e) {
      showNotification('Failed to update stage', 'error');
    }
  };

  const cleanOrg = (org) => {
    if (!org) return 'Government Department';
    const primary = org.split('/')[0].split('-')[0].trim();
    return primary.length > 3 ? primary : org.split('/')[0].trim();
  };

  // Real-time filtering
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

  const getPortalBadge = (portal) => {
    const p = (portal || '').toLowerCase();
    if (p.includes('gem')) return 'bg-amber-100 text-amber-950 border-amber-300';
    if (p.includes('cppp') || p.includes('central')) return 'bg-blue-100 text-blue-950 border-blue-300';
    if (p.includes('railtel')) return 'bg-cyan-100 text-cyan-950 border-cyan-300';
    return 'bg-slate-100 text-slate-900 border-slate-300';
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. SOLID PURE-WHITE HEADER CARD (Ultra-High Contrast & Perfect Alignment) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Description with Pill */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                Bid Pipeline
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                {filteredTenders.length} Bids
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Track opportunities, qualify criteria, and advance stage progression toward bid submission
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, ministry..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Fit Filter Segmented Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                fitFilter === 'all' 
                  ? 'bg-white text-slate-950 font-black shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
                fitFilter === 'direct_fit' 
                  ? 'bg-emerald-600 text-white font-black shadow-xs' 
                  : 'text-emerald-800 hover:text-emerald-950'
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
            className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            title="Refresh pipeline data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Filter Notification Banner */}
      {isFiltering && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 font-semibold shadow-2xs w-full">
          <span>
            {search && (
              <>
                Matching search <strong className="text-blue-900 font-bold">"{search}"</strong>
              </>
            )}
            {search && fitFilter !== 'all' && ' • '}
            {fitFilter === 'direct_fit' && 'Filtered by ≥ 80% Fit'}
            <span className="text-blue-800 ml-2 font-bold">
              (Showing <strong>{filteredTenders.length}</strong> of {tenders.length} total bids)
            </span>
          </span>

          <button
            onClick={() => {
              setSearch('');
              setFitFilter('all');
            }}
            className="text-[11px] font-bold text-blue-700 hover:text-blue-950 underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* 2. SOLID OPAQUE 5-STAGE COLUMNS GRID (Edge-to-Edge Aligned) */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="grid grid-cols-5 gap-3.5 min-w-[1050px] w-full items-start">
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
                className="bg-white rounded-2xl p-3 flex flex-col space-y-3 border border-slate-200/90 shadow-sm w-full min-h-[660px]"
              >
                {/* Column Header Card */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${col.headerBg}`}>
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot} shrink-0`} />
                    <h3 className={`font-black text-xs uppercase tracking-tight truncate ${col.headerText}`}>
                      {col.title}
                    </h3>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 shadow-2xs ${col.countBadge}`}>
                    {isFiltering && colTenders.length !== totalInCol ? `${colTenders.length}/${totalInCol}` : colTenders.length}
                  </span>
                </div>

                {/* Cards Scroll Lane */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)] pr-0.5">
                  {displayedTenders.map((t) => {
                    const deadlineInfo = formatDeadline(t.closing_date);
                    const isUrgent = deadlineInfo.urgency === 'critical' || deadlineInfo.urgency === 'urgent';
                    const isUpcoming = deadlineInfo.urgency === 'upcoming';
                    const formattedValue = formatTenderValue(t.estimated_value);

                    return (
                      <div
                        key={t.id}
                        onClick={() => openTenderDrawer(t)}
                        className="bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200/90 hover:border-blue-500 hover:shadow-md transition-all duration-150 p-3.5 space-y-2.5 cursor-pointer group"
                      >
                        {/* Row 1: ID, Portal & Match Tag */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="text-[10.5px] font-mono font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded group-hover:text-blue-700 transition">
                              {t.tender_id}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border truncate ${getPortalBadge(t.portal)}`}>
                              {t.portal || 'GeM'}
                            </span>
                          </div>

                          {t.fit_score && (
                            <span className={`text-[10.5px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${
                              t.fit_score >= 80 
                                ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                                : 'bg-slate-200 text-slate-800 border-slate-300'
                            }`}>
                              {t.fit_score}% Fit
                            </span>
                          )}
                        </div>

                        {/* Row 2: Tender Title */}
                        <h4 
                          className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700 transition"
                          title={t.title}
                        >
                          {t.title}
                        </h4>

                        {/* Row 3: Organisation / Department */}
                        {t.organisation && (
                          <p className="text-[11px] font-semibold text-slate-600 truncate flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{cleanOrg(t.organisation)}</span>
                          </p>
                        )}

                        {/* Row 4: Financial Value & Deadline Countdown */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-xs">
                          <span className="font-black text-emerald-800 truncate max-w-[120px]">
                            {formattedValue}
                          </span>

                          <div className="flex items-center space-x-1 shrink-0">
                            <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-rose-600' : isUpcoming ? 'text-amber-600' : 'text-slate-500'}`} />
                            <span className={`text-[10.5px] font-extrabold px-1.5 py-0.2 rounded border ${
                              isUrgent 
                                ? 'text-rose-900 bg-rose-100 border-rose-300' 
                                : isUpcoming 
                                  ? 'text-amber-950 bg-amber-100 border-amber-300' 
                                  : 'text-slate-700 bg-white border-slate-200'
                            }`}>
                              {deadlineInfo.countdown}
                            </span>
                          </div>
                        </div>

                        {/* Row 5: Action Button (Ultra-Visible Stage Advancement) */}
                        {nextCol ? (
                          <button
                            onClick={(e) => moveTender(e, t.id, nextCol)}
                            className="w-full mt-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-between shadow-2xs cursor-pointer group/btn"
                          >
                            <span>Advance to {nextCol}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-white group-hover/btn:translate-x-0.5 transition-transform" />
                          </button>
                        ) : (
                          <div className="w-full mt-1 py-1.5 px-3 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black text-center flex items-center justify-center space-x-1.5 shadow-2xs">
                            <Trophy className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Awarded Contract</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Progressive Loading for Column 1 */}
                  {col.id === 'New' && colTenders.length > visibleNewCount && (
                    <button
                      onClick={() => setVisibleNewCount((prev) => prev + 30)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 border border-slate-300 text-blue-700 text-xs font-bold shadow-2xs hover:border-blue-400 transition text-center cursor-pointer"
                    >
                      Load 30 More ({colTenders.length - visibleNewCount} remaining)
                    </button>
                  )}

                  {/* Empty Stage State */}
                  {colTenders.length === 0 && (
                    <div className="h-44 flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-1.5 my-2">
                      <ColIcon className="w-6 h-6 text-slate-400" />
                      <p className="text-xs font-bold text-slate-700">No tenders in this stage</p>
                      <p className="text-[11px] text-slate-500 font-medium">Advance qualified bids here</p>
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
