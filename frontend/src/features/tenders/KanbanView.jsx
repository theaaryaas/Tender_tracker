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
  Filter
} from 'lucide-react';

const COLUMNS = [
  { 
    id: 'New', 
    title: 'New Opportunities', 
    icon: Inbox,
    dot: 'bg-blue-500 ring-4 ring-blue-500/15',
    pill: 'bg-blue-50 text-blue-700 border-blue-200/80',
    countBadge: 'bg-blue-100 text-blue-800'
  },
  { 
    id: 'Reviewing', 
    title: 'Under BD Review', 
    icon: Eye,
    dot: 'bg-amber-500 ring-4 ring-amber-500/15',
    pill: 'bg-amber-50 text-amber-700 border-amber-200/80',
    countBadge: 'bg-amber-100 text-amber-800'
  },
  { 
    id: 'Bid Ready', 
    title: 'Bid Decided (Go)', 
    icon: TrendingUp,
    dot: 'bg-indigo-500 ring-4 ring-indigo-500/15',
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    countBadge: 'bg-indigo-100 text-indigo-800'
  },
  { 
    id: 'Submitted', 
    title: 'Bid Submitted', 
    icon: Send,
    dot: 'bg-sky-500 ring-4 ring-sky-500/15',
    pill: 'bg-sky-50 text-sky-700 border-sky-200/80',
    countBadge: 'bg-sky-100 text-sky-800'
  },
  { 
    id: 'Won', 
    title: 'Awarded / Won', 
    icon: Trophy,
    dot: 'bg-emerald-500 ring-4 ring-emerald-500/15',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    countBadge: 'bg-emerald-100 text-emerald-800'
  },
];

// Formats currency values into Lakhs / Crores cleanly
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
    if (p.includes('gem')) return 'bg-amber-50 text-amber-800 border-amber-200/80';
    if (p.includes('cppp') || p.includes('central')) return 'bg-blue-50 text-blue-800 border-blue-200/80';
    if (p.includes('railtel')) return 'bg-cyan-50 text-cyan-800 border-cyan-200/80';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. Sleek, Linear-Style Header & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Bid Pipeline</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
              {filteredTenders.length} {filteredTenders.length === 1 ? 'Bid' : 'Bids'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track opportunities, qualify criteria, and advance stage progression toward bid submission
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ID, ministry, keyword..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Fit Filter Segmented Buttons */}
          <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-3 py-1 rounded-md transition cursor-pointer text-xs ${
                fitFilter === 'all' 
                  ? 'bg-white text-slate-900 font-bold shadow-2xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center space-x-1 text-xs ${
                fitFilter === 'direct_fit' 
                  ? 'bg-white text-emerald-800 font-bold shadow-2xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>≥ 80% Fit</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchKanbanTenders}
            disabled={loading}
            className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Refresh pipeline data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Board Columns (Full-Width Symmetrical Grid with Opaque Surfaces) */}
      <div className="overflow-x-auto pb-4 w-full">
        <div className="grid grid-cols-5 gap-3.5 min-w-[1100px] w-full items-start">
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
                className="bg-slate-100/75 rounded-2xl p-2.5 flex flex-col space-y-2.5 border border-slate-200/70 shadow-xs min-h-[640px] w-full"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${col.dot} shrink-0`} />
                    <span className="font-bold text-xs text-slate-800 tracking-tight truncate">
                      {col.title}
                    </span>
                  </div>
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${col.countBadge}`}>
                    {isFiltering && colTenders.length !== totalInCol ? `${colTenders.length}/${totalInCol}` : colTenders.length}
                  </span>
                </div>

                {/* Cards Scroll Lane */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-14rem)] pr-0.5">
                  {displayedTenders.map((t) => {
                    const deadlineInfo = formatDeadline(t.closing_date);
                    const isUrgent = deadlineInfo.urgency === 'critical' || deadlineInfo.urgency === 'urgent';
                    const isUpcoming = deadlineInfo.urgency === 'upcoming';
                    const formattedValue = formatTenderValue(t.estimated_value);

                    return (
                      <div
                        key={t.id}
                        onClick={() => openTenderDrawer(t)}
                        className="bg-white rounded-xl border border-slate-200/80 hover:border-blue-400/90 shadow-2xs hover:shadow-md transition-all duration-150 p-3.5 space-y-2.5 cursor-pointer group"
                      >
                        {/* Row 1: ID, Portal & Match Tag */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded group-hover:text-blue-700 transition">
                              {t.tender_id}
                            </span>
                            <span className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded border truncate ${getPortalStyle(t.portal)}`}>
                              {t.portal || 'GeM'}
                            </span>
                          </div>

                          {t.fit_score && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border shrink-0 ${
                              t.fit_score >= 80 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90' 
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {t.fit_score}% Fit
                            </span>
                          )}
                        </div>

                        {/* Row 2: Tender Title */}
                        <h4 
                          className="text-xs font-semibold text-slate-900 line-clamp-2 leading-relaxed group-hover:text-blue-700 transition-colors"
                          title={t.title}
                        >
                          {t.title}
                        </h4>

                        {/* Row 3: Organisation / Department */}
                        {t.organisation && (
                          <p className="text-[11px] text-slate-500 truncate flex items-center space-x-1.5">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{cleanOrg(t.organisation)}</span>
                          </p>
                        )}

                        {/* Row 4: Financial Value & Deadline Countdown */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="font-bold text-slate-900 truncate max-w-[120px]">
                            {formattedValue}
                          </span>

                          <div className="flex items-center space-x-1 shrink-0">
                            <Clock className={`w-3 h-3 ${isUrgent ? 'text-rose-500' : isUpcoming ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className={`text-[10px] font-semibold ${
                              isUrgent 
                                ? 'text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200' 
                                : isUpcoming 
                                  ? 'text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200' 
                                  : 'text-slate-500'
                            }`}>
                              {deadlineInfo.countdown}
                            </span>
                          </div>
                        </div>

                        {/* Row 5: Sleek Micro Stage Dropdown (No bulky brick buttons) */}
                        <div 
                          className="pt-1.5 border-t border-slate-100 flex items-center justify-between"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Move Stage
                          </span>
                          <select
                            value={t.status || 'New'}
                            onChange={(e) => moveTender(e, t.id, e.target.value)}
                            className="text-[10.5px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition"
                          >
                            <option value="New">New Opportunity</option>
                            <option value="Reviewing">Under BD Review</option>
                            <option value="Bid Ready">Bid Decided (Go)</option>
                            <option value="Submitted">Bid Submitted</option>
                            <option value="Won">Awarded / Won</option>
                            <option value="Lost">Lost</option>
                            <option value="Archived">Archived</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  {/* Load More for Column 1 */}
                  {col.id === 'New' && colTenders.length > visibleNewCount && (
                    <button
                      onClick={() => setVisibleNewCount((prev) => prev + 30)}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-blue-50/80 border border-slate-200/80 text-blue-700 text-xs font-semibold shadow-2xs hover:border-blue-300 transition text-center cursor-pointer"
                    >
                      Load 30 More ({colTenders.length - visibleNewCount} remaining)
                    </button>
                  )}

                  {/* Clean Empty Stage Dropzone */}
                  {colTenders.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center p-4 text-center border border-dashed border-slate-300/80 rounded-xl bg-white/40 space-y-1.5 my-2">
                      <ColIcon className="w-5 h-5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-600">No tenders in this stage</p>
                      <p className="text-[10.5px] text-slate-400">Select stage from card menu</p>
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
