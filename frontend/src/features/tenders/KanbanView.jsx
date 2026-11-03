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
    dot: 'bg-[#6B46C1]',
    headerBg: 'bg-white border-[#E2DEEC]',
    headerText: 'text-[#1E182B]',
    countBadge: 'bg-[#6B46C1] text-white'
  },
  { 
    id: 'Reviewing', 
    title: 'Under BD Review', 
    icon: Eye,
    dot: 'bg-[#A85B24]',
    headerBg: 'bg-white border-[#E2DEEC]',
    headerText: 'text-[#1E182B]',
    countBadge: 'bg-[#A85B24] text-white'
  },
  { 
    id: 'Bid Ready', 
    title: 'Bid Decided (Go)', 
    icon: TrendingUp,
    dot: 'bg-[#553C9A]',
    headerBg: 'bg-white border-[#E2DEEC]',
    headerText: 'text-[#1E182B]',
    countBadge: 'bg-[#553C9A] text-white'
  },
  { 
    id: 'Submitted', 
    title: 'Bid Submitted', 
    icon: Send,
    dot: 'bg-[#0284C7]',
    headerBg: 'bg-white border-[#E2DEEC]',
    headerText: 'text-[#1E182B]',
    countBadge: 'bg-[#0284C7] text-white'
  },
  { 
    id: 'Won', 
    title: 'Awarded / Won', 
    icon: Trophy,
    dot: 'bg-[#2E7D32]',
    headerBg: 'bg-white border-[#E2DEEC]',
    headerText: 'text-[#1E182B]',
    countBadge: 'bg-[#2E7D32] text-white'
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
    if (p.includes('gem')) return 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]';
    if (p.includes('cppp') || p.includes('central')) return 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8]';
    if (p.includes('railtel')) return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
    return 'bg-[#F3EFF8] text-[#3B2961] border-[#E2DEEC]';
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. LAVENDER DREAM HEADER CARD */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Description with Pill */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0">
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Bid Pipeline
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs">
                {filteredTenders.length} Bids
              </span>
            </div>
            <p className="text-xs font-medium text-[#584E6B] mt-1">
              Track opportunities, qualify technical criteria, and advance stages toward bid submission
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ID, title, ministry..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C82A0] hover:text-[#1E182B] cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Fit Filter Segmented Buttons */}
          <div className="flex items-center bg-[#F3EFF8] p-1 rounded-xl border border-[#E2DEEC] text-xs font-semibold text-[#584E6B]">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                fitFilter === 'all' 
                  ? 'bg-white text-[#1E182B] font-bold shadow-xs' 
                  : 'text-[#584E6B] hover:text-[#1E182B]'
              }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
                fitFilter === 'direct_fit' 
                  ? 'bg-[#2E7D32] text-white font-bold shadow-xs' 
                  : 'text-[#2E7D32] hover:text-[#1B5E20]'
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
            className="px-3 py-2 bg-white border border-[#E2DEEC] hover:border-[#D8BFD8] rounded-xl hover:bg-[#FAF9FD] text-[#584E6B] font-semibold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            title="Refresh pipeline data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#584E6B] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Filter Notification Banner */}
      {isFiltering && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#E6E6FA] border border-[#D8BFD8] rounded-xl text-xs text-[#3B2961] font-medium shadow-2xs w-full">
          <span>
            {search && (
              <>
                Matching search <strong className="text-[#1E182B] font-bold">"{search}"</strong>
              </>
            )}
            {search && fitFilter !== 'all' && ' • '}
            {fitFilter === 'direct_fit' && 'Filtered by ≥ 80% Fit'}
            <span className="text-[#584E6B] ml-2 font-mono">
              ({filteredTenders.length} of {tenders.length} bids)
            </span>
          </span>

          <button
            onClick={() => {
              setSearch('');
              setFitFilter('all');
            }}
            className="text-[11px] font-bold text-[#6B46C1] hover:text-[#553C9A] underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* 2. 5-STAGE COLUMNS GRID */}
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
                className="bg-[#FAF9FD] rounded-2xl p-3 flex flex-col space-y-3 border border-[#E2DEEC] shadow-xs w-full min-h-[660px]"
              >
                {/* Column Header Card */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${col.headerBg}`}>
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                    <ColIcon className="w-4 h-4 text-[#584E6B] shrink-0" />
                    <span className={`font-bold text-xs truncate ${col.headerText}`}>
                      {col.title}
                    </span>
                  </div>
                  <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${col.countBadge}`}>
                    {colTenders.length}
                    {colTenders.length !== totalInCol && (
                      <span className="opacity-75 font-normal">/{totalInCol}</span>
                    )}
                  </span>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
                  {displayedTenders.map((t) => {
                    const isFit = (t.fit_score || 0) >= 80;
                    const isUrgent = t.closing_date && t.closing_date.toLowerCase().includes('today');
                    const deadlineInfo = formatDeadline(t.closing_date);
                    const isUpcoming = deadlineInfo.daysLeft !== null && deadlineInfo.daysLeft <= 3;

                    return (
                      <div
                        key={t.id}
                        onClick={() => openTenderDrawer(t)}
                        className="bg-white rounded-xl border border-[#E2DEEC] hover:border-[#D8BFD8] p-3.5 space-y-2.5 transition-all shadow-[0_1px_3px_rgba(45,38,56,0.04)] hover:shadow-md cursor-pointer group"
                      >
                        {/* Row 1: Header Chips */}
                        <div className="flex items-center justify-between gap-1 text-[10.5px]">
                          {/* Portal Chip */}
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold border ${getPortalBadge(t.portal)}`}>
                            {t.portal || 'GeM'}
                          </span>

                          {/* Fit Score Badge (Sage Mist #C8D8C4 / Peach Puff #FFDAB9) */}
                          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold border ${
                            isFit 
                              ? 'bg-[#E8F3E6] text-[#244E2C] border-[#C8D8C4]' 
                              : 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                          }`}>
                            <Sparkles className="w-3 h-3" />
                            <span>{t.fit_score || 75}% Fit</span>
                          </div>
                        </div>

                        {/* Row 2: Ministry / Organisation */}
                        <div className="flex items-center space-x-1.5 text-[11px] text-[#584E6B] font-semibold truncate">
                          <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                          <span className="truncate" title={t.organisation}>
                            {cleanOrg(t.organisation)}
                          </span>
                        </div>

                        {/* Row 3: Tender Title */}
                        <h4 
                          className="font-bold text-xs text-[#1E182B] group-hover:text-[#6B46C1] transition leading-snug line-clamp-2"
                          title={t.title}
                        >
                          {t.title}
                        </h4>

                        {/* Row 4: Value and Deadline Information */}
                        <div className="pt-2 border-t border-[#F0EDF7] flex items-center justify-between text-xs">
                          {/* Financial Value */}
                          <div className="font-mono font-bold text-[#1E182B] text-[11.5px]">
                            {formatTenderValue(t.tender_value)}
                          </div>

                          {/* Deadline Countdown */}
                          <div className="flex items-center space-x-1">
                            <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-rose-600' : isUpcoming ? 'text-[#9A3412]' : 'text-[#8C82A0]'}`} />
                            <span className={`text-[10.5px] font-semibold px-1.5 py-0.2 rounded border ${
                              isUrgent 
                                ? 'text-rose-800 bg-rose-50 border-rose-200' 
                                : isUpcoming 
                                  ? 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]' 
                                  : 'text-[#584E6B] bg-[#FAF9FD] border-[#E2DEEC]'
                            }`}>
                              {deadlineInfo.countdown}
                            </span>
                          </div>
                        </div>

                        {/* Row 5: Action Button (Royal Iris #6B46C1) */}
                        {nextCol ? (
                          <button
                            onClick={(e) => moveTender(e, t.id, nextCol)}
                            className="w-full mt-1 py-1.5 px-3 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold transition flex items-center justify-between shadow-2xs cursor-pointer group/btn"
                          >
                            <span>Advance to {nextCol}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#E6E6FA] group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-transform" />
                          </button>
                        ) : (
                          <div className="w-full mt-1 py-1.5 px-3 rounded-lg bg-[#E8F3E6] text-[#244E2C] border border-[#C8D8C4] text-xs font-bold text-center flex items-center justify-center space-x-1.5 shadow-2xs">
                            <Trophy className="w-3.5 h-3.5 text-[#2E7D32]" />
                            <span>Awarded Contract</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Load More Button for New Column */}
                  {col.id === 'New' && colTenders.length > visibleNewCount && (
                    <button
                      onClick={() => setVisibleNewCount((prev) => prev + 30)}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] text-[#6B46C1] text-xs font-semibold shadow-2xs transition text-center cursor-pointer"
                    >
                      Load 30 More ({colTenders.length - visibleNewCount} remaining)
                    </button>
                  )}

                  {/* Empty Stage State */}
                  {colTenders.length === 0 && (
                    <div className="h-44 flex flex-col items-center justify-center p-4 text-center border border-dashed border-[#E2DEEC] rounded-xl bg-white/70 space-y-1.5 my-2">
                      <ColIcon className="w-6 h-6 text-[#8C82A0]" />
                      <p className="text-xs font-semibold text-[#584E6B]">No tenders in this stage</p>
                      <p className="text-[11px] text-[#8C82A0]">Advance qualified bids here</p>
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
