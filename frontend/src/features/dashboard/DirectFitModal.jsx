import React, { useState, useEffect, useMemo } from 'react';
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
  Filter
} from 'lucide-react';
import { tenderApi } from '../../utils/api';
import { formatDeadline, parseTenderDate } from '../../utils/dateUtils';

export const DirectFitModal = ({ isOpen, onClose, onSelectTender }) => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // all, ai_90, cctv_80, infra_70
  const [sortBy, setSortBy] = useState('fit_desc'); // fit_desc, fit_asc, deadline_asc, value_desc

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

  // Clean organisation display
  const cleanOrg = (org) => {
    if (!org) return 'Government Department';
    const primary = org.split('/')[0].split('-')[0].trim();
    return primary.length > 3 ? primary : org.split('/')[0].trim();
  };

  // Clean title deduplication
  const cleanTitle = (rawTitle) => {
    if (!rawTitle) return 'Tender Notice Details';
    const parts = rawTitle.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.join(' • ');
  };

  // Filter & sort tenders in proper order
  const processedTenders = useMemo(() => {
    let list = [...tenders];

    // 1. Tier filtering
    if (tierFilter === 'ai_90') {
      list = list.filter(t => (t.fit_score || 0) >= 90);
    } else if (tierFilter === 'cctv_80') {
      list = list.filter(t => (t.fit_score || 0) >= 80 && (t.fit_score || 0) < 90);
    } else if (tierFilter === 'infra_70') {
      list = list.filter(t => (t.fit_score || 0) >= 70 && (t.fit_score || 0) < 80);
    }

    // 2. Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
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
      ai_90: tenders.filter(t => (t.fit_score || 0) >= 90).length,
      cctv_80: tenders.filter(t => (t.fit_score || 0) >= 80 && (t.fit_score || 0) < 90).length,
      infra_70: tenders.filter(t => (t.fit_score || 0) >= 70 && (t.fit_score || 0) < 80).length
    };
  }, [tenders]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#141021]/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] flex flex-col h-[88vh] max-h-[760px] overflow-hidden my-auto animate-in zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed & High Contrast */}
        <div className="px-6 py-4 border-b border-[#E2DEEC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] border border-[#C8D8C4] flex items-center justify-center text-[#2E7D32] shadow-2xs shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="font-extrabold text-[#1E182B] text-lg sm:text-xl tracking-tight leading-none">
                  Top Potential Direct Fit Opportunities
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8D8C4]">
                  {processedTenders.length} Direct Fit Bids
                </span>
              </div>
              <p className="text-xs text-[#584E6B] mt-1 font-medium">
                Ranked strictly by BitVivid technical capability synergy &amp; AI video surveillance fit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] border border-transparent hover:border-[#E2DEEC] transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Strip & Proper Order Controls */}
        <div className="px-6 py-2.5 bg-[#FAF9FD] border-b border-[#E2DEEC] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'all'
                  ? 'bg-[#2E5A36] text-white shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              All Direct Fit ({counts.total})
            </button>
            <button
              onClick={() => setTierFilter('ai_90')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                tierFilter === 'ai_90'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core AI &amp; VMS (90%+) ({counts.ai_90})</span>
            </button>
            <button
              onClick={() => setTierFilter('cctv_80')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'cctv_80'
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-white text-[#6B46C1] hover:bg-[#FAF5FF] border border-[#E9D8FD]'
              }`}
            >
              CCTV Systems (80-89%) ({counts.cctv_80})
            </button>
            <button
              onClick={() => setTierFilter('infra_70')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'infra_70'
                  ? 'bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              Surveillance Hardware (70-79%) ({counts.infra_70})
            </button>
          </div>

          {/* Sort Control */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Order by:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-bold bg-white border border-[#E2DEEC] rounded-lg px-2.5 py-1.5 text-[#1E182B] focus:outline-none focus:ring-1 focus:ring-[#6B46C1] cursor-pointer shadow-2xs"
            >
              <option value="fit_desc">Highest Fit Score (95% → 70%)</option>
              <option value="deadline_asc">Nearest Submission Deadline</option>
              <option value="value_desc">Highest Estimated Value</option>
              <option value="fit_asc">Lowest Fit Score</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-2.5 bg-white border-b border-[#E2DEEC] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search direct fit tenders by ID, title, department, or equipment..."
              className="w-full pl-10 pr-4 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8C82A0] hover:text-[#1E182B]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tenders List - Scrollable with proper order */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-3 bg-[#FAF9FD]/40">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-[#2E7D32] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#8C82A0]">Loading ranked direct fit opportunities...</p>
            </div>
          ) : processedTenders.length > 0 ? (
            processedTenders.map((t, idx) => {
              const deadline = formatDeadline(t.closing_date);
              const score = t.fit_score || 0;

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
                  className="bg-white rounded-xl border border-[#E2DEEC] hover:border-[#D8BFD8] hover:shadow-md transition-all p-4 space-y-2.5 group"
                >
                  {/* Top Bar: Rank, Fit Score, ID, Portal, and Deadline */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF5FF] border border-[#E9D8FD] text-[#6B46C1] shadow-2xs">
                        #{(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center space-x-1 ${scoreBadge}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{score}% Fit</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-[#1E182B] bg-[#FAF9FD] px-2 py-0.5 rounded border border-[#E2DEEC]">
                        {t.tender_id}
                      </span>
                      <span className="text-[11px] font-semibold text-[#584E6B] px-2 py-0.5 bg-[#FAF9FD] rounded border border-[#E2DEEC]">
                        {t.portal || 'GeM BidPlus'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        deadline.urgency === 'critical'
                          ? 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                          : deadline.urgency === 'urgent'
                            ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                            : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC]'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        <span>Closes {t.closing_date ? t.closing_date.split(' ')[0] : 'Check ATC'}</span>
                        {deadline.relative && <span className="opacity-80">({deadline.relative})</span>}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h4
                    onClick={() => {
                      if (onSelectTender) onSelectTender(t);
                    }}
                    className="font-bold text-[#1E182B] text-sm hover:text-[#6B46C1] cursor-pointer transition line-clamp-2 leading-snug"
                    title={t.title}
                  >
                    {cleanTitle(t.title)}
                  </h4>

                  {/* Meta Strip: Organisation, Estimated Value, EMD */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[#F0EDF7]">
                    <div className="flex flex-wrap items-center gap-3 text-[#584E6B]">
                      <span className="inline-flex items-center space-x-1 font-semibold text-[#1E182B]">
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0]" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </span>

                      {t.estimated_value && !t.estimated_value.toLowerCase().includes('check') && (
                        <span className="inline-flex items-center space-x-1 text-[#2E7D32] font-mono font-bold bg-[#E8F5E9]/60 px-2 py-0.5 rounded border border-[#C8D8C4]/60">
                          <IndianRupee className="w-3 h-3" />
                          <span>{t.estimated_value}</span>
                        </span>
                      )}

                      {t.emd_amount && !t.emd_amount.toLowerCase().includes('check') && (
                        <span className="inline-flex items-center space-x-1 text-[#4A337A] font-semibold bg-[#FAF5FF] px-2 py-0.5 rounded border border-[#E9D8FD]">
                          <ShieldCheck className="w-3 h-3 text-[#6B46C1]" />
                          <span>EMD: {t.emd_amount}</span>
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {t.doc_url && (
                        <a
                          href={t.doc_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] border border-transparent hover:border-[#E2DEEC] transition cursor-pointer"
                          title="Open official bid document"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          if (onSelectTender) onSelectTender(t);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E6E6FA] text-[#4A337A] hover:bg-[#6B46C1] hover:text-white border border-[#D8BFD8] transition shadow-2xs cursor-pointer group-hover:border-[#6B46C1]"
                      >
                        <span>View Clauses &amp; BOQ</span>
                        <ArrowRight className="w-3 h-3" />
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
                onClick={() => {
                  setSearch('');
                  setTierFilter('all');
                }}
                className="text-xs text-[#6B46C1] font-semibold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E2DEEC] bg-[#FAF9FD] flex items-center justify-between text-xs text-[#8C82A0] shrink-0">
          <span>Showing {processedTenders.length} direct fit opportunities (sorted by {sortBy === 'fit_desc' ? 'Highest Fit Score' : sortBy === 'deadline_asc' ? 'Nearest Deadline' : 'Estimated Value'})</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-[#E2DEEC] text-[#1E182B] font-bold hover:bg-[#FAF9FD] transition shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

