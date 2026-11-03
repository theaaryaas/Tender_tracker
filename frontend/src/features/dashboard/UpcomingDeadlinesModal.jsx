import React, { useState, useEffect, useMemo } from 'react';
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

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-[#141021]/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] flex flex-col h-[84vh] max-h-[680px] overflow-hidden my-auto animate-in zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed & Lavender Dream High Contrast */}
        <div className="px-6 py-4 border-b border-[#E2DEEC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFF2E5] border border-[#FFDAB9] flex items-center justify-center text-[#9A3412] shadow-2xs shrink-0">
              <Clock className="w-5 h-5 text-[#9A3412] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="font-extrabold text-[#1E182B] text-lg sm:text-xl tracking-tight leading-none">
                  Approaching Submission Deadlines (Next 7 Days)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFF2E5] text-[#9A3412] border border-[#FFDAB9]">
                  {processedTenders.length} Bids
                </span>
              </div>
              <p className="text-xs text-[#584E6B] mt-1 font-medium">
                Priority bids closing strictly within 7 days, sorted chronologically with nearest first
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

        {/* Filter Strip - Fixed */}
        <div className="px-6 py-2.5 bg-[#FAF9FD] border-b border-[#E2DEEC] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Quick Filter Pills (Strictly 7 Days) */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              All (&le; 7 Days)
            </button>
            <button
              onClick={() => setTimeFilter('24h')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                timeFilter === '24h'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-ping"></span>
              <span>&lt; 24h Critical</span>
            </button>
            <button
              onClick={() => setTimeFilter('48h')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timeFilter === '48h'
                  ? 'bg-[#FFDAB9] text-[#7C2D12] border border-[#FFC499] shadow-xs'
                  : 'bg-white text-[#9A3412] hover:bg-[#FFF2E5] border border-[#FFDAB9]'
              }`}
            >
              &lt; 48h Urgent
            </button>
            <button
              onClick={() => setTimeFilter('3to7d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timeFilter === '3to7d'
                  ? 'bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-xs'
                  : 'bg-white text-[#584E6B] hover:bg-[#FAF9FD] border border-[#E2DEEC]'
              }`}
            >
              3 to 7 Days
            </button>
          </div>

          {/* Sort Direction Toggle */}
          <button
            onClick={() => setSortAsc(prev => !prev)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-[#E2DEEC] text-[#1E182B] hover:bg-[#FAF9FD] transition shadow-2xs cursor-pointer"
            title="Toggle chronological sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#8C82A0]" />
            <span>{sortAsc ? 'Nearest First' : 'Furthest First'}</span>
          </button>
        </div>

        {/* Search Bar - Fixed */}
        <div className="px-6 py-2.5 bg-white border-b border-[#E2DEEC] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C82A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tender ID, title keyword, department, or portal..."
              className="w-full pl-10 pr-4 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
          </div>
        </div>

        {/* Tenders List - Scrollable with min-h-0 constraint */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-3 bg-[#FAF9FD]/40">
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
                badgeColor = 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9] font-extrabold shadow-2xs';
              } else if (deadline.urgency === 'urgent') {
                badgeColor = 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] font-bold';
              } else if (deadline.urgency === 'upcoming') {
                badgeColor = 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8] font-semibold';
              }

              return (
                <div
                  key={t.id || idx}
                  className="group p-4 rounded-xl bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] hover:border-[#D8BFD8] hover:shadow-md transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer shadow-2xs"
                  onClick={() => {
                    onSelectTender(t);
                    onClose();
                  }}
                >
                  {/* Left Column: Index, ID, Portal, Full Title, Org */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[#FAF9FD] text-[#584E6B] text-[10.5px] font-bold flex items-center justify-center border border-[#E2DEEC]">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#4A337A] bg-[#E6E6FA] px-2 py-0.5 rounded border border-[#D8BFD8]">
                        {t.tender_id}
                      </span>
                      <span className="text-[10.5px] font-semibold text-[#584E6B] bg-[#FAF9FD] px-2.5 py-0.5 rounded-full border border-[#E2DEEC]">
                        {t.portal}
                      </span>
                      {t.fit_score && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          t.fit_score >= 80 
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4]'
                            : 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                        }`}>
                          {t.fit_score}% Fit
                        </span>
                      )}
                    </div>

                    {/* Clear, Highly Visible Full Title */}
                    <h4 
                      className="text-sm font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition leading-snug line-clamp-2 mt-1"
                      title={t.title}
                    >
                      {t.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8C82A0] pt-0.5">
                      <span className="flex items-center space-x-1.5 truncate max-w-sm">
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                        <span className="truncate text-[#584E6B] font-medium">{cleanOrg(t.organisation)}</span>
                      </span>

                      {t.estimated_value && !t.estimated_value.toLowerCase().includes('check') && (
                        <span className="text-[#2E7D32] font-semibold font-mono">
                          Val: {t.estimated_value}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Synchronized Deadline & Time Left */}
                  <div className="w-full sm:w-auto shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2.5 sm:pt-0 border-[#E2DEEC]">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center sm:justify-end space-x-1.5">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs border ${badgeColor}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{deadline.countdown}</span>
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#1E182B] mt-1">
                        {deadline.date}
                      </p>
                      <p className="text-[11px] font-semibold text-[#9A3412]">
                        {deadline.time}
                      </p>
                    </div>

                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[#8C82A0] hover:text-[#6B46C1] hover:bg-[#FAF9FD] transition sm:mt-1.5 cursor-pointer"
                        title="Open portal tender link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
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
        <div className="px-6 py-3.5 border-t border-[#E2DEEC] bg-[#FAF9FD] flex items-center justify-between text-xs text-[#584E6B] shrink-0">
          <span>
            Showing <strong className="text-[#1E182B] font-bold">{processedTenders.length}</strong> tenders closing in &le; 7 days
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-[#FAF9FD] border border-[#E2DEEC] hover:border-[#D8BFD8] text-[#1E182B] font-semibold rounded-lg text-xs transition cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpcomingDeadlinesModal;
