import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  X,
  Search,
  ExternalLink,
  Building2,
  ArrowUpDown,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Filter,
  Copy,
  Check,
  ArrowUp
} from 'lucide-react';
import { tenderApi } from '../../utils/api';
import { formatDeadline, parseTenderDate } from '../../utils/dateUtils';

export const DirectFitModal = ({ isOpen, onClose, onSelectTender }) => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // all, ai_90, cctv_80, infra_70
  const [sortBy, setSortBy] = useState('fit_desc'); // fit_desc, fit_asc, deadline_asc, value_desc
  const [copiedId, setCopiedId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDirectFit = async () => {
      setLoading(true);
      try {
        const res = await tenderApi.getTenders({
          page: 1,
          limit: 150,
          eligibility: 'direct fit',
          sort_by: 'fit_score',
          sort_desc: true
        });
        if (res.data?.items) {
          setTenders(res.data.items);
        }
      } catch (err) {
        console.error('Failed to load direct fit tenders', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDirectFit();
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset scroll to top when filters change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [tierFilter, search, sortBy]);

  // Track scroll position for "Back to top" button
  const handleScroll = (e) => {
    if (e.currentTarget.scrollTop > 240) {
      if (!showScrollTop) setShowScrollTop(true);
    } else {
      if (showScrollTop) setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Quick copy tender ID with feedback
  const handleCopyId = (e, id) => {
    e.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Clean organisation display
  const cleanOrg = (org) => {
    if (!org) return 'Government Department';
    const primary = org.split('/')[0].split('-')[0].trim();
    return primary.length > 3 ? primary : org.split('/')[0].trim();
  };

  // Clean title deduplication
  const cleanTitle = (rawTitle) => {
    if (!rawTitle) return 'Tender Notice Details';
    const parts = rawTitle.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.join(' • ');
  };

  // Parse matched keywords for capability synergy pills
  const parseKeywords = (kw) => {
    if (!kw) return [];
    if (Array.isArray(kw)) return kw.slice(0, 3);
    return kw
      .split(/[,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 1 && !k.toLowerCase().includes('direct') && !k.toLowerCase().includes('synergy'))
      .slice(0, 3);
  };

  // Filter & sort tenders in proper order
  const processedTenders = useMemo(() => {
    let list = [...tenders];

    // 1. Tier filtering
    if (tierFilter === 'ai_90') {
      list = list.filter((t) => (t.fit_score || 0) >= 90);
    } else if (tierFilter === 'cctv_80') {
      list = list.filter((t) => (t.fit_score || 0) >= 80 && (t.fit_score || 0) < 90);
    } else if (tierFilter === 'infra_70') {
      list = list.filter((t) => (t.fit_score || 0) >= 70 && (t.fit_score || 0) < 80);
    }

    // 2. Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.tender_id && t.tender_id.toLowerCase().includes(q)) ||
          (t.organisation && t.organisation.toLowerCase().includes(q)) ||
          (t.scope_summary && t.scope_summary.toLowerCase().includes(q)) ||
          (t.matched_keywords && t.matched_keywords.toLowerCase().includes(q))
      );
    }

    // 3. Proper Ordering
    list.sort((a, b) => {
      if (sortBy === 'fit_desc') {
        const scoreDiff = (b.fit_score || 0) - (a.fit_score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        // Secondary sort: nearest deadline
        const dateA = parseTenderDate(a.closing_date)?.getTime() || 9999999999999;
        const dateB = parseTenderDate(b.closing_date)?.getTime() || 9999999999999;
        return dateA - dateB;
      } else if (sortBy === 'fit_asc') {
        return (a.fit_score || 0) - (b.fit_score || 0);
      } else if (sortBy === 'deadline_asc') {
        const dateA = parseTenderDate(a.closing_date)?.getTime() || 9999999999999;
        const dateB = parseTenderDate(b.closing_date)?.getTime() || 9999999999999;
        return dateA - dateB;
      } else if (sortBy === 'value_desc') {
        const parseVal = (s) => {
          if (!s) return 0;
          const m = s.match(/[\d,.]+/);
          return m ? parseFloat(m[0].replace(/,/g, '')) : 0;
        };
        return parseVal(b.estimated_value) - parseVal(a.estimated_value);
      }
      return 0;
    });

    return list;
  }, [tenders, search, tierFilter, sortBy]);

  // Tier counts
  const counts = useMemo(() => {
    return {
      total: tenders.length,
      ai_90: tenders.filter((t) => (t.fit_score || 0) >= 90).length,
      cctv_80: tenders.filter((t) => (t.fit_score || 0) >= 80 && (t.fit_score || 0) < 90).length,
      infra_70: tenders.filter((t) => (t.fit_score || 0) >= 70 && (t.fit_score || 0) < 80).length
    };
  }, [tenders]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#141021]/65 backdrop-blur-xs flex items-end sm:items-center justify-center animate-in fade-in duration-150 p-0 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[100dvh] sm:h-[88vh] sm:max-h-[780px] sm:max-w-5xl bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-[#E2DEEC] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Adaptive & Mobile Optimized */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-[#E2DEEC] flex items-center justify-between bg-white shrink-0 z-20">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 flex-1 mr-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#E8F5E9] border border-[#C8D8C4] flex items-center justify-center text-[#2E7D32] shadow-2xs shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#2E7D32]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-[#1E182B] text-sm sm:text-lg tracking-tight leading-none truncate">
                  <span className="hidden sm:inline">Top Potential </span>Direct Fit Opportunities
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8D8C4] shrink-0">
                  {processedTenders.length} Bids
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs text-[#584E6B] mt-0.5 font-medium truncate">
                Ranked strictly by BitVivid capability synergy &amp; AI video fit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] active:bg-[#E2DEEC] border border-transparent hover:border-[#E2DEEC] transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Strip & Order Controls */}
        <div className="px-3 sm:px-6 py-2 bg-[#FAF9FD] border-b border-[#E2DEEC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          {/* Category Tabs - Touch Swipeable */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 touch-pan-x snap-x snap-mandatory">
            <button
              type="button"
              onClick={() => setTierFilter('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap snap-start shrink-0 cursor-pointer ${
                tierFilter === 'all'
                  ? 'bg-[#2E5A36] text-white shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              <span className="sm:hidden">All ({counts.total})</span>
              <span className="hidden sm:inline">All Direct Fit ({counts.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('ai_90')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 whitespace-nowrap snap-start shrink-0 cursor-pointer ${
                tierFilter === 'ai_90'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="sm:hidden">AI &amp; VMS ({counts.ai_90})</span>
              <span className="hidden sm:inline">Core AI &amp; VMS (90%+) ({counts.ai_90})</span>
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('cctv_80')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap snap-start shrink-0 cursor-pointer ${
                tierFilter === 'cctv_80'
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-white text-[#6B46C1] hover:bg-[#FAF5FF] border border-[#E9D8FD]'
              }`}
            >
              <span className="sm:hidden">CCTV ({counts.cctv_80})</span>
              <span className="hidden sm:inline">CCTV Systems (80-89%) ({counts.cctv_80})</span>
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('infra_70')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap snap-start shrink-0 cursor-pointer ${
                tierFilter === 'infra_70'
                  ? 'bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              <span className="sm:hidden">Hardware ({counts.infra_70})</span>
              <span className="hidden sm:inline">Surveillance Hardware (70-79%) ({counts.infra_70})</span>
            </button>
          </div>

          {/* Sort Control */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1 shrink-0">
              <ArrowUpDown className="w-3 h-3" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-auto flex-1 sm:flex-initial text-xs font-bold bg-white border border-[#E2DEEC] rounded-lg px-2.5 py-1 text-[#1E182B] focus:outline-none focus:ring-1 focus:ring-[#6B46C1] cursor-pointer shadow-2xs"
            >
              <option value="fit_desc">Highest Fit Score (95% → 70%)</option>
              <option value="deadline_asc">Nearest Submission Deadline</option>
              <option value="value_desc">Highest Estimated Value</option>
              <option value="fit_asc">Lowest Fit Score</option>
            </select>
          </div>
        </div>

        {/* Search Bar with result counter */}
        <div className="px-3 sm:px-6 py-2 bg-white border-b border-[#E2DEEC] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, keyword, buyer, or equipment..."
              className="w-full pl-9 pr-9 py-1.5 sm:py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="w-6 h-6 rounded-full absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C82A0] hover:text-[#1E182B] flex items-center justify-center cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tenders List - Scrollable with fluid cards */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 space-y-2.5 sm:space-y-3 bg-[#FAF9FD]/50 overscroll-contain"
        >
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-[#2E7D32] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#8C82A0]">Loading ranked direct fit opportunities...</p>
            </div>
          ) : processedTenders.length > 0 ? (
            processedTenders.map((t, idx) => {
              const deadline = formatDeadline(t.closing_date);
              const score = t.fit_score || 0;
              const keywords = parseKeywords(t.matched_keywords);

              let scoreBadge = 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4]';
              if (score >= 90) {
                scoreBadge = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-700 shadow-xs';
              } else if (score >= 80) {
                scoreBadge = 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4] font-extrabold';
              } else {
                scoreBadge = 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]';
              }

              return (
                <div
                  key={t.id || t.tender_id}
                  onClick={() => {
                    if (onSelectTender) onSelectTender(t);
                  }}
                  className="bg-white rounded-xl sm:rounded-2xl border border-[#E2DEEC] hover:border-[#6B46C1]/40 hover:shadow-md transition-all p-3 sm:p-4 space-y-2.5 group cursor-pointer active:scale-[0.995]"
                >
                  {/* Top Bar: Rank + Fit Synergy Score + Deadline countdown */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <span className="font-mono text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF5FF] border border-[#E9D8FD] text-[#6B46C1] shadow-2xs">
                        #{(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border inline-flex items-center space-x-1 ${scoreBadge}`}>
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span>{score}% Synergy</span>
                      </span>
                    </div>

                    {/* Deadline Chip */}
                    <span className={`inline-flex items-center space-x-1 text-[10.5px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full border shrink-0 ${
                      deadline.urgency === 'critical'
                        ? 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                        : deadline.urgency === 'urgent'
                          ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                          : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC]'
                    }`}>
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{deadline.date || (t.closing_date ? t.closing_date.split(' ')[0] : 'Check ATC')}</span>
                      {deadline.countdown && !deadline.isExpired && (
                        <span className="opacity-75 hidden xs:inline font-mono">({deadline.countdown})</span>
                      )}
                    </span>
                  </div>

                  {/* Identification Row: Tender ID + Quick Copy + Portal + Keywords */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <div className="inline-flex items-center bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-2 py-0.5 space-x-1 font-mono text-[11px] text-[#1E182B] font-bold">
                      <span className="tracking-tight">{t.tender_id}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(e, t.tender_id)}
                        className="text-[#8C82A0] hover:text-[#6B46C1] p-0.5 rounded transition cursor-pointer"
                        title="Copy tender ID"
                      >
                        {copiedId === t.tender_id ? (
                          <Check className="w-3 h-3 text-[#2E7D32]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <span className="text-[10px] sm:text-[11px] font-semibold text-[#584E6B] px-1.5 py-0.5 bg-[#FAF9FD] rounded-lg border border-[#E2DEEC]">
                      {t.portal || 'GeM BidPlus'}
                    </span>

                    {/* Synergy Capability Tags */}
                    {keywords.map((kw, ki) => (
                      <span
                        key={ki}
                        className="text-[10px] font-medium text-[#6B46C1] bg-[#FAF5FF] border border-[#E9D8FD] px-1.5 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Tender Title */}
                  <h4
                    className="font-bold text-[#1E182B] text-xs sm:text-sm hover:text-[#6B46C1] transition line-clamp-2 leading-snug"
                    title={t.title}
                  >
                    {cleanTitle(t.title)}
                  </h4>

                  {/* Buyer & Commercial Details Strip */}
                  <div className="pt-2 border-t border-[#F0EDF7] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#584E6B]">
                      <span
                        className="inline-flex items-center space-x-1.5 font-semibold text-[#1E182B] break-words"
                        title={t.organisation}
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </span>

                      {t.estimated_value && !t.estimated_value.toLowerCase().includes('check') && (
                        <span className="inline-flex items-center space-x-1 text-[#2E7D32] font-mono font-bold bg-[#E8F5E9]/60 px-2 py-0.5 rounded-lg border border-[#C8D8C4]/60 text-[11px]">
                          <IndianRupee className="w-3 h-3 shrink-0" />
                          <span>{t.estimated_value}</span>
                        </span>
                      )}

                      {t.emd_amount && !t.emd_amount.toLowerCase().includes('check') && (
                        <span className="inline-flex items-center space-x-1 text-[#4A337A] font-semibold bg-[#FAF5FF] px-2 py-0.5 rounded-lg border border-[#E9D8FD] text-[11px]">
                          <ShieldCheck className="w-3 h-3 text-[#6B46C1] shrink-0" />
                          <span>EMD: {t.emd_amount}</span>
                        </span>
                      )}
                    </div>

                    {/* Actions: Document link + Primary CTA */}
                    <div className="flex items-center gap-2 w-full sm:w-auto pt-0.5 sm:pt-0">
                      {t.doc_url && (
                        <a
                          href={t.doc_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 sm:p-1.5 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] border border-[#E2DEEC] transition cursor-pointer shrink-0 flex items-center justify-center"
                          title="Open official bid document"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectTender) onSelectTender(t);
                        }}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-[#6B46C1] sm:bg-[#E6E6FA] text-white sm:text-[#4A337A] hover:bg-[#553C9A] sm:hover:bg-[#6B46C1] sm:hover:text-white border border-[#6B46C1] sm:border-[#D8BFD8] transition shadow-xs cursor-pointer group-hover:border-[#6B46C1] active:scale-[0.98]"
                      >
                        <span>View Clauses &amp; BOQ</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#8C82A0] mx-auto opacity-50" />
              <p className="text-sm font-bold text-[#1E182B]">No direct fit opportunities match "{search}"</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTierFilter('all');
                }}
                className="text-xs text-[#6B46C1] font-semibold hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Floating Back to Top Button on Mobile */}
        {showScrollTop && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1E182B] text-white text-[11px] font-bold shadow-lg shadow-purple-950/30 hover:bg-[#6B46C1] transition cursor-pointer active:scale-95"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Back to top</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-t border-[#E2DEEC] bg-[#FAF9FD] flex items-center justify-between text-xs text-[#8C82A0] shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-[11px] sm:text-xs">
            Showing <strong className="text-[#1E182B]">{processedTenders.length}</strong> opportunities
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#E2DEEC] text-[#1E182B] font-bold hover:bg-[#FAF9FD] transition shadow-2xs cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DirectFitModal;
