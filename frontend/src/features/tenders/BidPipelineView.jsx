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
  Kanban,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  CheckCircle2,
  XCircle
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
  {
    id: 'Rejected',
    title: 'Rejected',
    icon: XCircle,
    dot: 'bg-rose-600',
    headerBg: 'bg-white border-rose-200',
    headerText: 'text-rose-900',
    countBadge: 'bg-rose-600 text-white'
  },
];

// Clean and deduplicate title strings
const cleanTenderTitle = (rawTitle, organisation = '') => {
  if (!rawTitle) return organisation ? `Tender Notice — ${organisation}` : 'Tender Notice Details';
  let s = String(rawTitle).trim().replace(/^[;,\s\-:]+|[;,\s\-:,]+$/g, '');
  const rawParts = s.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
  const uniqueParts = [];
  const seen = new Set();
  for (const part of rawParts) {
    const norm = part.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      uniqueParts.push(part);
    }
  }
  let formatted = uniqueParts.length > 0 ? uniqueParts.join(' • ') : s;
  return formatted.replace(/[;,\s\-:,]+$/g, '').trim();
};

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

export const BidPipelineView = () => {
  const { openTenderDrawer, showNotification, refreshStats } = useApp();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fitFilter, setFitFilter] = useState('all'); // all, direct_fit (>=80), partner (<80)
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [visibleNewCount, setVisibleNewCount] = useState(30);
  const [activeMobileCol, setActiveMobileCol] = useState('New');

  // Touch swipe support for mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const normalizeStage = (rawStatus) => {
    if (!rawStatus) return 'New';
    if (rawStatus === 'Under Review') return 'Reviewing';
    return rawStatus;
  };

  const fetchKanbanTenders = async () => {
    setLoading(true);
    try {
      const res = await tenderApi.getTenders({ page: 1, limit: 1000 });
      let allItems = res.data.items || [];
      const totalPages = res.data.pages || 1;
      if (totalPages > 1) {
        const restRequests = [];
        for (let p = 2; p <= totalPages; p += 1) {
          restRequests.push(tenderApi.getTenders({ page: p, limit: 1000 }));
        }
        const restResponses = await Promise.all(restRequests);
        restResponses.forEach((r) => {
          if (r?.data?.items) {
            allItems = allItems.concat(r.data.items);
          }
        });
      }
      setTenders(allItems);
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

  const ownerOptions = useMemo(() => {
    const owners = new Set();
    tenders.forEach((t) => {
      if (t.assigned_to && String(t.assigned_to).trim()) {
        owners.add(String(t.assigned_to).trim());
      }
    });
    return Array.from(owners).sort((a, b) => a.localeCompare(b));
  }, [tenders]);

  // Real-time filtering
  const filteredTenders = useMemo(() => {
    let list = tenders;

    if (fitFilter === 'direct_fit') {
      list = list.filter((t) => (t.fit_score || 0) >= 80);
    } else if (fitFilter === 'partner') {
      list = list.filter((t) => (t.fit_score || 0) < 80);
    }

    if (ownerFilter !== 'all') {
      list = list.filter(
        (t) => (t.assigned_to || '').trim().toLowerCase() === ownerFilter.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((t) =>
        (t.tender_id && t.tender_id.toLowerCase().includes(q)) ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.organisation && t.organisation.toLowerCase().includes(q)) ||
        (t.portal && t.portal.toLowerCase().includes(q)) ||
        (t.matched_keywords && t.matched_keywords.toLowerCase().includes(q)) ||
        (t.assigned_to && t.assigned_to.toLowerCase().includes(q)) ||
        (t.bid_progress && t.bid_progress.toLowerCase().includes(q)) ||
        (t.bid_date && t.bid_date.toLowerCase().includes(q))
      );
    }

    return list;
  }, [tenders, search, fitFilter, ownerFilter]);

  const isFiltering = search.trim().length > 0 || fitFilter !== 'all' || ownerFilter !== 'all';

  const getPortalBadge = (portal) => {
    const p = (portal || '').toLowerCase();
    if (p.includes('gem')) return 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]';
    if (p.includes('cppp') || p.includes('central')) return 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8]';
    if (p.includes('gov') || p.includes('framework')) return 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]';
    if (p.includes('railtel')) return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
    return 'bg-[#F3EFF8] text-[#3B2961] border-[#E2DEEC]';
  };

  const getProgressBadgeClass = (progress) => {
    const p = (progress || '').toLowerCase();
    if (p.includes('placed') || p.includes('submitted')) {
      return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
    }
    if (p.includes('preparing') || p.includes('working')) {
      return 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
    }
    return 'bg-[#F3EFF8] text-[#4A337A] border-[#D8BFD8]';
  };

  // Helper properties for active mobile stage
  const activeColIndex = COLUMNS.findIndex((c) => c.id === activeMobileCol);
  const activeColObj = COLUMNS[activeColIndex >= 0 ? activeColIndex : 0];
  const prevCol = activeColIndex > 0 ? COLUMNS[activeColIndex - 1] : null;
  const nextStageCol = activeColIndex < COLUMNS.length - 1 ? COLUMNS[activeColIndex + 1] : null;

  const activeColTenders = filteredTenders.filter((t) => normalizeStage(t.status) === activeColObj.id);
  const displayedActiveTenders = activeColObj.id === 'New'
    ? activeColTenders.slice(0, visibleNewCount)
    : activeColTenders;
  const ActiveColIcon = activeColObj.icon;

  // Touch swipe gesture handlers
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50 && nextStageCol) {
      setActiveMobileCol(nextStageCol.id);
    } else if (distance < -50 && prevCol) {
      setActiveMobileCol(prevCol.id);
    }
  };

  // Render individual tender card
  const renderTenderCard = (t, nextCol) => {
    const isFit = (t.fit_score || 0) >= 80;
    const isUrgent = t.closing_date && t.closing_date.toLowerCase().includes('today');
    const deadlineInfo = formatDeadline(t.closing_date);
    const isUpcoming = deadlineInfo.daysLeft !== null && deadlineInfo.daysLeft <= 3;
    const displayTitle = cleanTenderTitle(t.title, t.organisation);

    return (
      <div
        key={t.id}
        onClick={() => openTenderDrawer(t)}
        className="bg-white rounded-xl border border-[#E2DEEC] hover:border-[#D8BFD8] p-3.5 space-y-2.5 transition-all shadow-[0_1px_3px_rgba(45,38,56,0.04)] hover:shadow-md cursor-pointer touch-manipulation group"
      >
        {/* Row 1: Header - Tender ID, Portal Chip & Fit Score Badge */}
        <div className="flex items-center justify-between gap-1 text-[10.5px]">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="font-mono font-bold text-xs text-[#1E182B] tracking-tight truncate">
              {t.tender_id}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold border shrink-0 ${getPortalBadge(t.portal)}`}>
              {t.portal || 'GeM'}
            </span>
          </div>

          {/* Fit Score Badge */}
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold border shrink-0 ${isFit
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
          className="font-bold text-xs sm:text-sm text-[#1E182B] group-hover:text-[#6B46C1] transition leading-snug line-clamp-2 break-words"
          title={displayTitle}
        >
          {displayTitle}
        </h4>

        {/* Row 3b: Tracking Metadata (Owner / Progress / Bid Date) */}
        {(t.assigned_to || t.bid_progress || t.bid_date) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10.5px]">
            {t.assigned_to && (
              <span
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#F3EFF8] text-[#4A337A] border border-[#D8BFD8] font-bold"
                title={`Assigned to ${t.assigned_to}`}
              >
                <User className="w-3 h-3 text-[#6B46C1]" />
                <span>{t.assigned_to}</span>
              </span>
            )}
            {t.bid_progress && (
              <span
                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border font-bold ${getProgressBadgeClass(t.bid_progress)}`}
                title={`Progress: ${t.bid_progress}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>{t.bid_progress}</span>
              </span>
            )}
            {t.bid_date && (
              <span
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                title={`Bid Date: ${t.bid_date}`}
              >
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>Bid: {t.bid_date}</span>
              </span>
            )}
          </div>
        )}

        {/* Row 4: Value and Deadline Information */}
        <div className="pt-2 border-t border-[#F0EDF7] flex items-center justify-between gap-2 text-xs">
          {/* Financial Value */}
          <div className="font-mono font-bold text-[#1E182B] text-xs sm:text-[12.5px] truncate">
            {formatTenderValue(t.estimated_value || t.tender_value)}
          </div>

          {/* Closing Date & Countdown */}
          <div className="flex items-center space-x-1 shrink-0" title={t.closing_date ? `Closing: ${t.closing_date}` : 'No closing date'}>
            <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-rose-600' : isUpcoming ? 'text-[#9A3412]' : 'text-[#8C82A0]'}`} />
            <span className={`text-[10.5px] font-semibold px-1.5 py-0.2 rounded border ${isUrgent
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : isUpcoming
                ? 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                : 'text-[#584E6B] bg-[#FAF9FD] border-[#E2DEEC]'
              }`}>
              {deadlineInfo.date && deadlineInfo.date !== 'Open'
                ? `${deadlineInfo.date} • ${deadlineInfo.countdown}`
                : deadlineInfo.countdown}
            </span>
          </div>
        </div>

        {/* Row 5: Action Button (Royal Iris #6B46C1) */}
        {nextCol ? (
          <button
            onClick={(e) => moveTender(e, t.id, nextCol.id)}
            className="w-full mt-1 py-2 px-3 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white text-xs font-semibold transition flex items-center justify-between shadow-2xs cursor-pointer touch-manipulation group/btn"
          >
            <span className="truncate">Advance to {nextCol.title}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#E6E6FA] group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
          </button>
        ) : normalizeStage(t.status) === 'Rejected' ? (
          <div className="w-full mt-1 py-2 px-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold text-center flex items-center justify-center space-x-1.5 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected</span>
          </div>
        ) : (
          <div className="w-full mt-1 py-2 px-3 rounded-xl bg-[#E8F3E6] text-[#244E2C] border border-[#C8D8C4] text-xs font-bold text-center flex items-center justify-center space-x-1.5 shadow-2xs">
            <Trophy className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span>Awarded Contract</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. LAVENDER DREAM HEADER CARD */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2DEEC] shadow-xs w-full flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Title & Description with Pill */}
        <div className="flex items-start sm:items-center space-x-3 sm:space-x-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0 mt-0.5 sm:mt-0">
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Bid Pipeline
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs shrink-0">
                {filteredTenders.length} Bids
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-[#584E6B] mt-1 leading-normal">
              Track opportunities, qualify technical criteria, and advance stages toward bid submission
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          {/* Live Search Input */}
          <div className="relative flex-1 sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ID, title, owner, progress..."
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

          {/* Owner / Name Filter */}
          {ownerOptions.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Filter by assigned owner"
              className="px-3 py-2 bg-white border border-[#E2DEEC] hover:border-[#D8BFD8] rounded-xl text-xs font-semibold text-[#584E6B] focus:outline-none focus:border-[#6B46C1] transition shadow-xs cursor-pointer"
            >
              <option value="all">All Owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          )}

          {/* Quick Fit Filter Segmented Buttons */}
          <div className="flex items-center bg-[#F3EFF8] p-1 rounded-xl border border-[#E2DEEC] text-xs font-semibold text-[#584E6B]">
            <button
              onClick={() => setFitFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition touch-manipulation cursor-pointer ${fitFilter === 'all'
                ? 'bg-white text-[#1E182B] font-bold shadow-xs'
                : 'text-[#584E6B] hover:text-[#1E182B]'
                }`}
            >
              All Bids
            </button>
            <button
              onClick={() => setFitFilter('direct_fit')}
              className={`px-3 py-1.5 rounded-lg transition touch-manipulation cursor-pointer flex items-center space-x-1.5 ${fitFilter === 'direct_fit'
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
            className="px-3 py-2 bg-white border border-[#E2DEEC] hover:border-[#D8BFD8] rounded-xl hover:bg-[#FAF9FD] text-[#584E6B] font-semibold text-xs flex items-center space-x-1.5 transition shadow-xs touch-manipulation cursor-pointer"
            title="Refresh pipeline data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#584E6B] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Filter Notification Banner */}
      {isFiltering && (
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 bg-[#E6E6FA] border border-[#D8BFD8] rounded-xl text-xs text-[#3B2961] font-medium shadow-2xs w-full">
          <span className="truncate mr-2">
            {search && (
              <>
                Matching search <strong className="text-[#1E182B] font-bold">"{search}"</strong>
              </>
            )}
            {search && fitFilter !== 'all' && ' • '}
            {fitFilter === 'direct_fit' && 'Filtered by ≥ 80% Fit'}
            {(search || fitFilter !== 'all') && ownerFilter !== 'all' && ' • '}
            {ownerFilter !== 'all' && (
              <>
                Owner: <strong className="text-[#1E182B] font-bold">{ownerFilter}</strong>
              </>
            )}
            <span className="text-[#584E6B] ml-2 font-mono">
              ({filteredTenders.length} of {tenders.length} bids)
            </span>
          </span>

          <button
            onClick={() => {
              setSearch('');
              setFitFilter('all');
              setOwnerFilter('all');
            }}
            className="text-[11px] font-bold text-[#6B46C1] hover:text-[#553C9A] underline cursor-pointer shrink-0"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* 2. MOBILE VIEW (< md): Touch-Friendly Stage Navigator + Full-Width Column Feed */}
      <div className="md:hidden space-y-3">
        {/* Stage Quick Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x no-scrollbar pb-1">
          {COLUMNS.map((col) => {
            const count = filteredTenders.filter((t) => normalizeStage(t.status) === col.id).length;
            const isActive = activeMobileCol === col.id;
            return (
              <button
                key={col.id}
                onClick={() => setActiveMobileCol(col.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition flex items-center space-x-1.5 cursor-pointer touch-manipulation ${isActive
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-white text-[#584E6B] border border-[#E2DEEC]'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="font-semibold">{col.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-[#FAF9FD] text-[#584E6B] border border-[#E2DEEC]'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stage Indicator & Prev/Next Action Bar */}
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E2DEEC] shadow-xs flex items-center justify-between gap-2">
          <button
            onClick={() => prevCol && setActiveMobileCol(prevCol.id)}
            disabled={!prevCol}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition touch-manipulation cursor-pointer ${prevCol
              ? 'text-[#6B46C1] bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC]'
              : 'text-slate-300 border border-slate-100 cursor-not-allowed opacity-40'
              }`}
            title={prevCol ? `Go to ${prevCol.title}` : 'First stage'}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          <div className="flex items-center space-x-2 text-center min-w-0 px-1">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeColObj.dot}`} />
            <span className="font-bold text-xs sm:text-sm text-[#1E182B] truncate">
              {activeColObj.title}
            </span>
            <span className="text-[11px] font-mono font-bold text-[#6B46C1] bg-[#E6E6FA] border border-[#D8BFD8] px-2 py-0.5 rounded-full shrink-0">
              {activeColTenders.length} bids
            </span>
          </div>

          <button
            onClick={() => nextStageCol && setActiveMobileCol(nextStageCol.id)}
            disabled={!nextStageCol}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition touch-manipulation cursor-pointer ${nextStageCol
              ? 'text-[#6B46C1] bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC]'
              : 'text-slate-300 border border-slate-100 cursor-not-allowed opacity-40'
              }`}
            title={nextStageCol ? `Go to ${nextStageCol.title}` : 'Last stage'}
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Full-Width Mobile Cards Feed with Native Scroll and Swipe Gestures */}
        <div
          className="bg-[#FAF9FD] rounded-2xl p-3 border border-[#E2DEEC] shadow-xs space-y-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="space-y-2.5">
            {displayedActiveTenders.map((t) =>
              renderTenderCard(
                t,
                activeColObj.id === 'Won' || activeColObj.id === 'Rejected' ? null : nextStageCol
              )
            )}
          </div>

          {/* Load More Button for New Stage */}
          {activeMobileCol === 'New' && activeColTenders.length > visibleNewCount && (
            <button
              onClick={() => setVisibleNewCount((prev) => prev + 30)}
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] text-[#6B46C1] text-xs font-semibold shadow-2xs transition text-center cursor-pointer touch-manipulation"
            >
              Load 30 More ({activeColTenders.length - visibleNewCount} remaining)
            </button>
          )}

          {/* Empty Stage State */}
          {activeColTenders.length === 0 && (
            <div className="h-44 flex flex-col items-center justify-center p-4 text-center border border-dashed border-[#E2DEEC] rounded-xl bg-white/70 space-y-1.5 my-2">
              <ActiveColIcon className="w-6 h-6 text-[#8C82A0]" />
              <p className="text-xs font-semibold text-[#584E6B]">No tenders in {activeColObj.title}</p>
              <p className="text-[11px] text-[#8C82A0]">Advance qualified bids here</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. DESKTOP VIEW (md and above): Full 6-Stage Kanban Columns Grid */}
      <div className="hidden md:block w-full overflow-x-auto pb-4">
        <div className="grid grid-cols-6 gap-3.5 min-w-[1260px] w-full items-start">
          {COLUMNS.map((col, idx) => {
            const colTenders = filteredTenders.filter((t) => normalizeStage(t.status) === col.id);
            const totalInCol = tenders.filter((t) => normalizeStage(t.status) === col.id).length;
            const ColIcon = col.icon;
            const nextCol = col.id === 'Won' || col.id === 'Rejected' ? null : COLUMNS[idx + 1];

            const displayedTenders = col.id === 'New'
              ? colTenders.slice(0, visibleNewCount)
              : colTenders;

            return (
              <div
                key={col.id}
                id={`kanban-col-${col.id}`}
                className="bg-[#FAF9FD] rounded-2xl p-3 flex flex-col space-y-3 border border-[#E2DEEC] shadow-xs w-full min-h-[620px]"
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
                  {displayedTenders.map((t) => renderTenderCard(t, nextCol))}

                  {/* Load More Button for New Column */}
                  {col.id === 'New' && colTenders.length > visibleNewCount && (
                    <button
                      onClick={() => setVisibleNewCount((prev) => prev + 30)}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] text-[#6B46C1] text-xs font-semibold shadow-2xs transition text-center cursor-pointer touch-manipulation"
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

export default BidPipelineView;
export { BidPipelineView as KanbanView };
