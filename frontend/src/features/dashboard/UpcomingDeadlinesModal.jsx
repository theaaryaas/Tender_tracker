import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  X,
  Search,
  ExternalLink,
  Building2,
  ArrowUpDown,
  Calendar
} from 'lucide-react';
import { tenderApi } from '../../utils/api';
import { formatDeadline, parseTenderDate, sortTendersByDeadline } from '../../utils/dateUtils';

export const UpcomingDeadlinesModal = ({ isOpen, onClose, onSelectTender }) => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, 24h, 48h, 3to7d
  const [sortAsc, setSortAsc] = useState(true); // true = nearest deadline first
  const [counts, setCounts] = useState({ critical_24h: 0, urgent_48h: 0, week_7d: 0, total: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const fetchDeadlines = async () => {
      setLoading(true);
      try {
        const res = await tenderApi.getUpcomingDeadlines({ limit: 100, days: 7 });
        if (res.data?.items) {
          const list = res.data.items.map(item => item.tender || item);
          setTenders(list);
          if (res.data.counts) {
            setCounts({
              critical_24h: res.data.counts.critical_24h || 0,
              urgent_48h: res.data.counts.urgent_48h || 0,
              week_7d: res.data.counts.week_7d || 0,
              total: res.data.counts.week_7d || list.length
            });
          }
        }
      } catch (err) {
        try {
          const fallbackRes = await tenderApi.getTenders({ page: 1, limit: 100 });
          const items = fallbackRes.data.items || [];
          setTenders(items);
        } catch (e) {
          console.error('Failed to load deadline tenders', e);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
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

  // Filter & sort tenders strictly within 7 days
  const processedTenders = useMemo(() => {
    let list = [...tenders];
    const now = new Date().getTime();
    const sevenDaysMs = 7 * 86400 * 1000;

    list = list.filter(t => {
      const parsed = parseTenderDate(t.closing_date);
      if (!parsed) return false;
      const timeMs = parsed.getTime();
      const diff = timeMs - now;
      return diff >= 0 && diff <= sevenDaysMs;
    });

    if (timeFilter === '24h') {
      list = list.filter(t => {
        const d = parseTenderDate(t.closing_date)?.getTime();
        return d && (d - now) <= 24 * 3600 * 1000;
      });
    } else if (timeFilter === '48h') {
      list = list.filter(t => {
        const d = parseTenderDate(t.closing_date)?.getTime();
        return d && (d - now) <= 48 * 3600 * 1000;
      });
    } else if (timeFilter === '3to7d') {
      list = list.filter(t => {
        const d = parseTenderDate(t.closing_date)?.getTime();
        return d && (d - now) > 48 * 3600 * 1000 && (d - now) <= sevenDaysMs;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.tender_id && t.tender_id.toLowerCase().includes(q)) ||
        (t.organisation && t.organisation.toLowerCase().includes(q)) ||
        (t.portal && t.portal.toLowerCase().includes(q))
      );
    }

    return sortTendersByDeadline(list, sortAsc);
  }, [tenders, search, timeFilter, sortAsc]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#141021]/65 backdrop-blur-xs flex items-end sm:items-center justify-center animate-in fade-in duration-150 p-0 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[100dvh] sm:h-[84vh] sm:max-h-[720px] max-w-4xl bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-[#E2DEEC] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed & Lavender Dream High Contrast */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-4 border-b border-[#E2DEEC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#FFF2E5] border border-[#FFDAB9] flex items-center justify-center text-[#9A3412] shadow-2xs shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#9A3412] animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-[#1E182B] text-xs sm:text-lg md:text-xl tracking-tight leading-tight truncate">
                  Approaching Deadlines<span className="hidden sm:inline"> (Next 7 Days)</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#FFF2E5] text-[#9A3412] border border-[#FFDAB9] shrink-0">
                  {processedTenders.length} Bids
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#584E6B] mt-0.5 font-medium line-clamp-1">
                Priority bids closing strictly within 7 days, sorted chronologically with nearest first
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] active:bg-[#FAF5FF] border border-transparent hover:border-[#E2DEEC] transition flex items-center justify-center shrink-0 cursor-pointer touch-manipulation ml-2"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Strip - Fixed & Touch Responsive */}
        <div className="px-3.5 sm:px-6 py-2 sm:py-2.5 bg-[#FAF9FD] border-b border-[#E2DEEC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
          {/* Quick Filter Pills (Strictly 7 Days) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto touch-pan-x no-scrollbar pb-0.5 sm:pb-0 w-full sm:w-auto">
            <button
              onClick={() => setTimeFilter('all')}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer touch-manipulation whitespace-nowrap ${timeFilter === 'all'
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
                }`}
            >
              <span className="sm:hidden">All (7d)</span>
              <span className="hidden sm:inline">All (≤ 7 Days)</span>
            </button>
            <button
              onClick={() => setTimeFilter('24h')}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer touch-manipulation whitespace-nowrap ${timeFilter === '24h'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 inline-block animate-ping"></span>
              <span className="sm:hidden">&lt; 24h Critical</span>
              <span className="hidden sm:inline">&lt; 24h Critical</span>
            </button>
            <button
              onClick={() => setTimeFilter('48h')}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer touch-manipulation whitespace-nowrap ${timeFilter === '48h'
                  ? 'bg-[#FFDAB9] text-[#7C2D12] border border-[#FFC499] shadow-xs'
                  : 'bg-white text-[#9A3412] hover:bg-[#FFF2E5] border border-[#FFDAB9]'
                }`}
            >
              <span className="sm:hidden">&lt; 48h Urgent</span>
              <span className="hidden sm:inline">&lt; 48h Urgent</span>
            </button>
            <button
              onClick={() => setTimeFilter('3to7d')}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer touch-manipulation whitespace-nowrap ${timeFilter === '3to7d'
                  ? 'bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
                }`}
            >
              <span>3 to 7 Days</span>
            </button>
          </div>

          {/* Sort Direction Toggle */}
          <button
            onClick={() => setSortAsc(prev => !prev)}
            className="inline-flex items-center justify-center self-end sm:self-auto space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold bg-white border border-[#E2DEEC] text-[#1E182B] hover:bg-[#FAF9FD] active:bg-[#FAF5FF] transition shadow-2xs cursor-pointer touch-manipulation shrink-0"
            title="Toggle chronological sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#8C82A0]" />
            <span>{sortAsc ? 'Nearest First' : 'Furthest First'}</span>
          </button>
        </div>

        {/* Search Bar - Fixed */}
        <div className="px-3.5 sm:px-6 py-2 sm:py-2.5 bg-white border-b border-[#E2DEEC] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tender ID, title, department, or portal..."
              className="w-full pl-9 pr-3.5 py-1.5 sm:py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition shadow-2xs"
            />
          </div>
        </div>

        {/* Tenders List - Scrollable with min-h-0 constraint */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 space-y-2.5 sm:space-y-3 bg-[#FAF9FD]/40">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Clock className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#8C82A0]">Loading synchronized 7-day deadlines...</p>
            </div>
          ) : processedTenders.length > 0 ? (
            processedTenders.map((t, idx) => {
              const deadline = formatDeadline(t.closing_date);

              let badgeColor = 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC]';
              if (deadline.urgency === 'critical') {
                badgeColor = 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] font-extrabold shadow-2xs';
              } else if (deadline.urgency === 'urgent') {
                badgeColor = 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9] font-bold';
              } else if (deadline.urgency === 'upcoming') {
                badgeColor = 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8] font-semibold';
              }

              return (
                <div
                  key={t.id || idx}
                  className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] hover:border-[#D8BFD8] hover:shadow-md transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer shadow-2xs touch-manipulation"
                  onClick={() => {
                    onSelectTender(t);
                    onClose();
                  }}
                >
                  {/* Left Column: Index, ID, Portal, Full Title, Org */}
                  <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5 w-full">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#FAF9FD] text-[#584E6B] text-[10px] sm:text-[10.5px] font-bold flex items-center justify-center border border-[#E2DEEC]">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[10.5px] sm:text-[11px] font-bold text-[#4A337A] bg-[#E6E6FA] px-2 py-0.5 rounded border border-[#D8BFD8]">
                        {t.tender_id}
                      </span>
                      <span className="text-[10px] sm:text-[10.5px] font-semibold text-[#584E6B] bg-[#FAF9FD] px-2 sm:px-2.5 py-0.5 rounded-full border border-[#E2DEEC]">
                        {t.portal}
                      </span>
                      {t.fit_score && (
                        <span className={`text-[9.5px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border ${t.fit_score >= 80
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4]'
                            : 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                          }`}>
                          {t.fit_score}% Fit
                        </span>
                      )}
                    </div>

                    {/* Clear, Highly Visible Full Title */}
                    <h4
                      className="text-xs sm:text-sm font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition leading-snug line-clamp-2 mt-1 break-words"
                      title={t.title}
                    >
                      {t.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs text-[#8C82A0] pt-0.5">
                      <span className="flex items-center space-x-1.5 truncate max-w-[200px] sm:max-w-sm">
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                        <span className="truncate text-[#584E6B] font-medium">{cleanOrg(t.organisation)}</span>
                      </span>

                      {t.estimated_value && !t.estimated_value.toLowerCase().includes('check') && (
                        <span className="text-[#2E7D32] font-semibold font-mono text-[11px] sm:text-xs">
                          Val: {t.estimated_value}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Synchronized Deadline & Time Left */}
                  <div className="w-full sm:w-auto shrink-0 flex items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-[#F0EDF7] sm:border-transparent mt-0.5 sm:mt-0">
                    <div className="flex items-center sm:justify-end space-x-1.5">
                      <span className={`inline-flex items-center space-x-1 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs border ${badgeColor}`}>
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{deadline.countdown}</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-right">
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#1E182B] leading-tight">
                          {deadline.date}
                        </p>
                        <p className="text-[10.5px] sm:text-[11px] font-semibold text-[#9A3412] leading-tight">
                          {deadline.time}
                        </p>
                      </div>

                      {t.url && (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-[#8C82A0] hover:text-[#6B46C1] hover:bg-[#FAF9FD] active:bg-[#FAF5FF] transition cursor-pointer touch-manipulation"
                          title="Open portal tender link"
                        >
                          <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center space-y-2">
              <Calendar className="w-9 h-9 text-[#8C82A0] mx-auto opacity-50" />
              <p className="text-sm font-semibold text-[#1E182B]">No tenders closing within 7 days match your filter.</p>
              <p className="text-xs text-[#8C82A0]">Try adjusting the filter or search keywords.</p>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-t border-[#E2DEEC] bg-[#FAF9FD] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#584E6B] shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <span className="text-center sm:text-left text-[11px] sm:text-xs">
            Showing <strong className="text-[#1E182B] font-bold">{processedTenders.length}</strong> tenders closing in &le; 7 days
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 bg-white hover:bg-[#FAF9FD] active:bg-[#FAF5FF] border border-[#E2DEEC] hover:border-[#D8BFD8] text-[#1E182B] font-semibold rounded-lg text-xs transition cursor-pointer shadow-2xs touch-manipulation"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UpcomingDeadlinesModal;
