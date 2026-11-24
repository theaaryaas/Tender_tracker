import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Filter,
  ListFilter,
  ExternalLink,
  Star,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Eye,
  Sparkles,
  X,
  RotateCcw,
  Building2,
  Tag,
  Zap,
  Trash2,
  Copy
} from 'lucide-react';
import { tenderApi, exportApi, crmApi } from '../../utils/api';
import { formatDeadline } from '../../utils/dateUtils';
import { copyTenderLinkToClipboard } from '../../utils/navigation';


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

export const AllTendersView = () => {
  const { user, isSuperAdmin, isManager, openTenderDrawer, showNotification } = useApp();
  const canDeleteIndividual = isSuperAdmin || (user?.permissions || []).includes('can_delete_tenders');
  const canBulkDeletePast = isSuperAdmin || (user?.permissions || []).includes('can_bulk_delete_expired');

  const [tenders, setTenders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [purgingPast, setPurgingPast] = useState(false);

  const handlePurgePastTenders = async () => {
    if (!window.confirm(
      "Are you sure you want to bulk delete past tenders whose closing date has passed?\n\n" +
      "• Active pipeline deals (Reviewing, Bid Ready, Submitted, Won, Lost, Archived) will NOT be deleted.\n" +
      "• Starred tenders and CRM claimed bids will NOT be deleted.\n" +
      "• Only unacted expired bids in status 'New' will be permanently removed.\n\n" +
      "Do you want to proceed?"
    )) return;

    setPurgingPast(true);
    try {
      const res = await tenderApi.purgePastTenders();
      showNotification(res.data?.message || 'Past tenders successfully purged', 'success');
      fetchTenders();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to purge past tenders', 'error');
    } finally {
      setPurgingPast(false);
    }
  };

  const handleCopyLink = async (e, tid) => {
    e.stopPropagation();
    try {
      const url = await copyTenderLinkToClipboard(tid);
      showNotification(`Copied direct link for ${tid}`, 'success');
    } catch {
      showNotification('Failed to copy tender link', 'error');
    }
  };

  const handlePickTender = async (t) => {
    try {
      await crmApi.pickTender(t.id);
      setTenders((prev) =>
        prev.map((item) =>
          item.id === t.id
            ? { ...item, is_claimed: true, assigned_to: user?.username || 'You', status: 'Under Review' }
            : item
        )
      );
      showNotification(`Tender ${t.tender_id} claimed and added to your Bidding CRM!`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to pick tender', 'error');
    }
  };

  const handleUnpickTender = async (t) => {
    try {
      await crmApi.unpickTender(t.id);
      setTenders((prev) =>
        prev.map((item) =>
          item.id === t.id
            ? { ...item, is_claimed: false, assigned_to: null, status: item.status === 'Under Review' ? 'New' : item.status }
            : item
        )
      );
      showNotification(`Tender ${t.tender_id} released and unpicked!`, 'info');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to release tender', 'error');
    }
  };

  // Filters
  const [search, setSearch] = useState('');
  const [portal, setPortal] = useState('all');
  const [status, setStatus] = useState('all');
  const [eligibility, setEligibility] = useState('all');
  const [priority, setPriority] = useState('all');
  const [isStarredOnly, setIsStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState('id');
  const [sortDesc, setSortDesc] = useState(true);
  const [batchParsing, setBatchParsing] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeFiltersCount = (portal !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (eligibility !== 'all' ? 1 : 0) +
    (priority !== 'all' ? 1 : 0) +
    (isStarredOnly ? 1 : 0);

  const handleResetFilters = () => {
    setPortal('all');
    setStatus('all');
    setEligibility('all');
    setPriority('all');
    setIsStarredOnly(false);
    setSortBy('id');
    setSortDesc(true);
    setSearch('');
    setPage(1);
    fetchTenders('');
  };

  const handleBatchParse = async () => {
    setBatchParsing(true);
    try {
      const res = await tenderApi.batchParseTenders(25);
      showNotification(`Started extraction for ${res.data.count} high-priority tenders!`, 'info');
      setTimeout(() => {
        fetchTenders();
        setBatchParsing(false);
      }, 4000);
    } catch (e) {
      showNotification('Failed to start batch extraction', 'error');
      setBatchParsing(false);
    }
  };

  const fetchTenders = async (searchOverride) => {
    setLoading(true);
    try {
      const res = await tenderApi.getTenders({
        page,
        limit,
        search: (searchOverride !== undefined ? searchOverride : search) || undefined,
        portal: portal !== 'all' ? portal : undefined,
        status: status !== 'all' ? status : undefined,
        eligibility: eligibility !== 'all' ? eligibility : undefined,
        priority: priority !== 'all' ? priority : undefined,
        is_starred: isStarredOnly ? true : undefined,
        sort_by: sortBy,
        sort_desc: sortDesc,
      });
      setTenders(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error('Failed to load tenders', e);
      showNotification('Failed to load tenders from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, [page, limit, portal, status, eligibility, priority, sortBy, sortDesc, isStarredOnly]);

  // Real-time synchronization when tender is updated or deleted from drawer or actions
  useEffect(() => {
    const handleUpdate = (e) => {
      const updated = e.detail;
      if (updated?.id) {
        setTenders((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      }
    };
    const handleDeleted = (e) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setTenders((prev) => prev.filter((t) => t.id !== deletedId));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('tender:updated', handleUpdate);
    window.addEventListener('tender:deleted', handleDeleted);
    return () => {
      window.removeEventListener('tender:updated', handleUpdate);
      window.removeEventListener('tender:deleted', handleDeleted);
    };
  }, []);

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchTenders('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTenders();
  };

  const handleStatusChange = async (e, tenderId) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    try {
      const res = await tenderApi.updateTender(tenderId, { status: newStatus });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, status: newStatus } : t))
      );
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data || { id: tenderId, status: newStatus } }));
      showNotification(`Tender status changed to ${newStatus}`, 'success');
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleStarToggle = async (e, tender) => {
    e.stopPropagation();
    try {
      const updated = !tender.is_starred;
      const res = await tenderApi.updateTender(tender.id, { is_starred: updated });
      setTenders((prev) =>
        prev.map((t) => (t.id === tender.id ? { ...t, is_starred: updated } : t))
      );
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data || { id: tender.id, is_starred: updated } }));
    } catch (err) {
      showNotification('Failed to update star', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#E2DEEC] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by tender ID, title, organization, or keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) {
                  setPage(1);
                  fetchTenders('');
                }
              }}
              className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl sm:rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-xs sm:text-sm text-[#1E182B]"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className={`sm:hidden inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition touch-manipulation cursor-pointer ${showMobileFilters || activeFiltersCount > 0
                  ? 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8]'
                  : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-[#E6E6FA]'
                }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-[#6B46C1]" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#6B46C1] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleBatchParse}
              disabled={batchParsing}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition touch-manipulation cursor-pointer shrink-0"
              title="Parse GeM PDF documents for top tenders in the background"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{batchParsing ? 'Extracting...' : 'Auto-Extract'}</span>
            </button>

            <a
              href={exportApi.getExcelUrl({ search, portal, status, eligibility, is_starred: isStarredOnly ? true : undefined })}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#2E7D32] hover:bg-[#1B5E20] active:bg-[#144717] text-white text-xs font-semibold shadow-xs transition touch-manipulation shrink-0"
              download
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Export Excel</span>
              <span className="xs:hidden">Excel</span>
            </a>

            <a
              href={exportApi.getCsvUrl({ search, portal, status, eligibility, is_starred: isStarredOnly ? true : undefined })}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-lg bg-[#FAF9FD] hover:bg-[#E6E6FA] text-[#3B2961] border border-[#E2DEEC] text-xs font-semibold transition touch-manipulation shrink-0"
              download
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>CSV</span>
            </a>

            {canBulkDeletePast && (
              <button
                type="button"
                onClick={handlePurgePastTenders}
                disabled={purgingPast}
                className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold shadow-xs transition touch-manipulation shrink-0 cursor-pointer disabled:opacity-50"
                title="Bulk delete past tenders whose deadline has passed (Active pipeline bids are kept)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden xs:inline">{purgingPast ? 'Purging...' : 'Purge Past Bids'}</span>
                <span className="xs:hidden">Purge Past</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Chips (Mobile & Desktop) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto touch-pan-x no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => {
              setIsStarredOnly((prev) => !prev);
              setPage(1);
            }}
            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition border touch-manipulation cursor-pointer ${isStarredOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-[#E6E6FA]'
              }`}
          >
            <Star className={`w-3.5 h-3.5 ${isStarredOnly ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            <span>⭐ Favorites</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEligibility((prev) => prev === 'direct fit' ? 'all' : 'direct fit');
              setPage(1);
            }}
            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition border touch-manipulation cursor-pointer ${eligibility === 'direct fit'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-[#E6E6FA]'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Direct Fit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortal((prev) => prev === 'GeM' ? 'all' : 'GeM');
              setPage(1);
            }}
            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition border touch-manipulation cursor-pointer ${portal === 'GeM'
                ? 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8] shadow-2xs'
                : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-[#E6E6FA]'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>GeM BidPlus</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortal((prev) => prev === 'CPPP' ? 'all' : 'CPPP');
              setPage(1);
            }}
            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition border touch-manipulation cursor-pointer ${portal === 'CPPP'
                ? 'bg-[#E6E6FA] text-[#4A337A] border-[#D8BFD8] shadow-2xs'
                : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-[#E6E6FA]'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>CPPP</span>
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition touch-manipulation cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Detailed Filter Selects (Collapsible on mobile, permanent on sm+) */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden'} sm:grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs`}>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Portal</label>
            <select
              value={portal}
              onChange={(e) => { setPortal(e.target.value); setPage(1); }}
              className="w-full h-9 p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B46C1] text-xs"
            >
              <option value="all">All Portals</option>
              <option value="GeM">GeM BidPlus</option>
              <option value="CPPP">CPPP / Central</option>
              <option value="RailTel">RailTel</option>
              <option value="Pradesh">State Portals</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Eligibility Fit</label>
            <select
              value={eligibility}
              onChange={(e) => { setEligibility(e.target.value); setPage(1); }}
              className="w-full h-9 p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B46C1] text-xs"
            >
              <option value="all">All Fits</option>
              <option value="direct fit">Potential Direct Fit</option>
              <option value="partner">SI Partner Route</option>
              <option value="review">Manual Review</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full h-9 p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B46C1] text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Reviewing">Reviewing</option>
              <option value="Bid Ready">Bid Ready</option>
              <option value="Submitted">Submitted</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}
              className="w-full h-9 p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B46C1] text-xs"
            >
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort By</label>
            <select
              value={isStarredOnly ? 'favorites-true' : `${sortBy}-${sortDesc}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'favorites-true') {
                  setIsStarredOnly(true);
                  setPage(1);
                } else {
                  const [sb, sd] = val.split('-');
                  setIsStarredOnly(false);
                  setSortBy(sb);
                  setSortDesc(sd === 'true');
                  setPage(1);
                }
              }}
              className="w-full h-9 p-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B46C1] text-xs font-medium"
            >
              <option value="id-true">Latest Discovered</option>
              <option value="favorites-true">⭐ Favorites</option>
              <option value="fit_score-true">Highest Fit Score</option>
              <option value="closing_date-false">Closing Date (Earliest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tenders Container */}
      <div className="bg-white rounded-xl border border-[#E2DEEC] shadow-xs overflow-hidden">
        {/* 1. Mobile Cards View (md:hidden) */}
        <div className="md:hidden p-3 space-y-3 bg-[#FAF9FD]/50">
          {loading ? (
            <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-[#E2DEEC] p-6">
              <div className="inline-flex items-center space-x-2 animate-pulse">
                <div className="w-3 h-3 bg-[#6B46C1] rounded-full animate-bounce"></div>
                <span className="text-xs font-semibold text-[#4A337A]">Loading tenders...</span>
              </div>
            </div>
          ) : tenders.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2DEEC] p-6 text-center text-slate-400">
              {isStarredOnly ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Star className="w-8 h-8 text-amber-400 fill-amber-400/30" />
                  <p className="font-semibold text-slate-700 text-sm">No favorite tenders found</p>
                  <p className="text-xs text-slate-400">Tap the star icon on any tender to save it to your Favorites.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStarredOnly(false);
                      setPage(1);
                    }}
                    className="mt-2 px-3 py-1.5 text-xs text-[#6B46C1] bg-[#E6E6FA] hover:bg-[#D8BFD8] rounded-lg font-semibold cursor-pointer transition touch-manipulation"
                  >
                    Show All Tenders
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-700 text-sm">No tenders match your filters</p>
                  <p className="text-xs text-slate-400">Try adjusting your search keyword or clearing the active filters.</p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-2 px-3 py-1.5 text-xs text-[#6B46C1] bg-[#E6E6FA] hover:bg-[#D8BFD8] rounded-lg font-semibold cursor-pointer transition touch-manipulation"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            tenders.map((t) => {
              const fitScore = t.fit_score || 0;
              const fitLabel = fitScore >= 75 ? 'Direct Fit' : fitScore >= 50 ? 'SI Partner' : 'Manual Review';
              const fitBadgeClass = fitScore >= 75
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : fitScore >= 50
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200';

              const estValue = t.estimated_value && t.estimated_value !== 'Check tender PDF / ATC' && t.estimated_value !== 'Not specified in listing'
                ? t.estimated_value
                : (t.extracted_pdf_text ? 'Unquoted (BOQ)' : 'Pending Extract');

              const emdVal = t.emd_amount && t.emd_amount !== 'Check tender PDF / ATC' ? t.emd_amount : 'Pending Parse';

              return (
                <div
                  key={t.id}
                  onClick={() => openTenderDrawer(t)}
                  className="bg-white rounded-xl border border-[#E2DEEC] p-3.5 shadow-2xs hover:border-[#6B46C1]/40 active:bg-[#FAF9FD] transition touch-manipulation cursor-pointer space-y-3"
                >
                  {/* Card Top Row: Star, Full Tender ID, Portal, Fit Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pb-0.5">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleStarToggle(e, t)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer touch-manipulation shrink-0 ${t.is_starred
                            ? 'bg-amber-50 text-amber-500 border-amber-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-amber-500'
                          }`}
                        title={t.is_starred ? 'Favorited' : 'Add to favorites'}
                      >
                        <Star className={`w-3.5 h-3.5 ${t.is_starred ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                      <span className="font-mono font-bold text-xs text-slate-900 tracking-tight select-all">
                        {t.tender_id}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        {t.portal || 'GeM BidPlus'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${fitBadgeClass}`}>
                        {fitScore}% {fitLabel}
                      </span>
                    </div>
                  </div>

                  {/* Title & Department */}
                  <div className="space-y-1">
                    <h4
                      className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-3 sm:line-clamp-2 leading-snug break-words"
                      title={cleanTenderTitle(t.title, t.organisation)}
                    >
                      {cleanTenderTitle(t.title, t.organisation)}
                    </h4>
                    <p className="text-[11px] text-slate-600 flex items-center space-x-1.5 pt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-[#6B46C1] shrink-0" />
                      <span className="font-medium break-words leading-tight">{t.organisation || 'N/A'}</span>
                    </p>
                  </div>

                  {/* Key Metrics Grid (2x2) */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF9FD] p-2.5 rounded-xl border border-[#E2DEEC]/70">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Closing Date</span>
                      <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                        <span className={`font-semibold text-[11px] break-words ${formatDeadline(t.closing_date).isExpired ? 'text-rose-600 line-through' : 'text-slate-800'}`}>
                          {t.closing_date ? t.closing_date : 'Check portal'}
                        </span>
                        {formatDeadline(t.closing_date).isExpired && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                            ⏳ Deadline Passed
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Est. Value</span>
                      <span className="font-bold text-emerald-700 text-[11px] block mt-0.5 break-words">
                        {estValue}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">EMD Amount</span>
                      <span className="font-medium text-slate-700 text-[11px] block mt-0.5 break-words">
                        {emdVal}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Fit Assessment</span>
                      <span className="font-semibold text-[#4A337A] text-[11px] block mt-0.5 line-clamp-2 leading-tight">
                        {t.eligibility_assessment || `${fitScore}% Fit`}
                      </span>
                    </div>
                  </div>

                  {/* Matched Keywords Tags (if any) */}
                  {t.matched_keywords && (
                    <div className="text-[10px] text-slate-500 truncate flex items-center space-x-1">
                      <Tag className="w-3 h-3 text-[#8C82A0] shrink-0" />
                      <span className="truncate text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {t.matched_keywords}
                      </span>
                    </div>
                  )}

                  {/* Footer Actions: Status select & inspect button */}
                  <div className="pt-1 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-1 min-w-0">
                      <select
                        value={t.status || 'New'}
                        onChange={(e) => handleStatusChange(e, t.id)}
                        className={`w-full h-8 px-2 rounded-lg text-xs font-semibold border transition touch-manipulation ${t.status === 'Bid Ready'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : t.status === 'Reviewing'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : t.status === 'Submitted'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : t.status === 'Won'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                      >
                        <option value="New">Status: New</option>
                        <option value="Reviewing">Status: Reviewing</option>
                        <option value="Bid Ready">Status: Bid Ready</option>
                        <option value="Submitted">Status: Submitted</option>
                        <option value="Won">Status: Won</option>
                        <option value="Lost">Status: Lost</option>
                        <option value="Archived">Status: Archived</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {t.is_claimed ? (
                        <div className="inline-flex items-center space-x-1">
                          <span className="h-8 px-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold inline-flex items-center space-x-1" title={`Claimed by ${t.assigned_to}`}>
                            <span>👤 {t.assigned_to || 'Claimed'}</span>
                          </span>
                          {(isSuperAdmin || canDeleteIndividual || user?.username === t.assigned_to) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnpickTender(t);
                              }}
                              className="h-8 w-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition inline-flex items-center justify-center cursor-pointer"
                              title="Release / Unpick tender"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePickTender(t);
                          }}
                          className="h-8 px-2.5 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white text-xs font-semibold inline-flex items-center space-x-1 transition shadow-xs cursor-pointer"
                          title="Pick tender and add to your active Bidding CRM"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Pick</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openTenderDrawer(t)}
                        className="h-8 px-2.5 rounded-lg bg-[#FAF9FD] hover:bg-[#E6E6FA] active:bg-[#E9D8FD] border border-[#E2DEEC] text-[#4A337A] text-xs font-semibold inline-flex items-center space-x-1 transition touch-manipulation cursor-pointer"
                        title="View clauses, BOQ & AI"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#6B46C1]" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, t.tender_id || t.id)}
                        className="h-8 w-8 rounded-lg bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] text-[#6B46C1] flex items-center justify-center transition touch-manipulation cursor-pointer"
                        title="Copy direct link to this tender"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {t.url && (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 w-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center transition touch-manipulation"
                          title="Open official portal"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Multi-column Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9FD] border-b border-[#E2DEEC] text-[#584E6B] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStarredOnly((prev) => !prev);
                      setPage(1);
                    }}
                    title={isStarredOnly ? "Showing ⭐ Favorites only — Click to show all" : "Click to show ⭐ Favorites only"}
                    className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer ${isStarredOnly
                        ? "bg-amber-100 text-amber-500 ring-2 ring-amber-400 shadow-xs"
                        : "text-slate-400 hover:text-amber-500 hover:bg-slate-100"
                      }`}
                  >
                    <Star className={`w-4 h-4 ${isStarredOnly ? "fill-amber-400 text-amber-500" : ""}`} />
                  </button>
                </th>
                <th className="py-3 px-4 w-44">Tender ID / Portal</th>
                <th className="py-3 px-4 min-w-[280px]">Tender Title & Department</th>
                <th className="py-3 px-4 w-36">Closing Date</th>
                <th className="py-3 px-4 w-36">Est. Value & EMD</th>
                <th className="py-3 px-4 w-44">Eligibility & Fit</th>
                <th className="py-3 px-4 w-32">Status</th>
                <th className="py-3 px-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDF7]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center space-x-2 animate-pulse">
                      <div className="w-3 h-3 bg-[#6B46C1] rounded-full animate-bounce"></div>
                      <span className="font-medium text-[#4A337A]">Loading tenders...</span>
                    </div>
                  </td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    {isStarredOnly ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Star className="w-8 h-8 text-amber-400 fill-amber-400/30" />
                        <p className="font-semibold text-slate-700">No favorite tenders found</p>
                        <p className="text-xs text-slate-400">Click the star icon next to any tender to save it to your Favorites.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsStarredOnly(false);
                            setPage(1);
                          }}
                          className="mt-2 px-3 py-1 text-xs text-[#6B46C1] bg-[#E6E6FA] hover:bg-[#D8BFD8] rounded-md font-semibold cursor-pointer transition"
                        >
                          Show All Tenders
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700">No tenders match your search and filter criteria.</p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1 text-xs text-[#6B46C1] bg-[#E6E6FA] hover:bg-[#D8BFD8] rounded-md font-semibold cursor-pointer transition"
                        >
                          Reset Filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                tenders.map((t) => {
                  const fitScore = t.fit_score || 0;
                  const fitLabel = fitScore >= 75 ? 'Direct Fit' : fitScore >= 50 ? 'SI Partner' : 'Not Aligned';

                  return (
                    <tr
                      key={t.id}
                      onClick={() => openTenderDrawer(t)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      {/* Star */}
                      <td className="py-3 px-3 text-center" onClick={(e) => handleStarToggle(e, t)}>
                        <Star
                          className={`w-4 h-4 mx-auto transition ${t.is_starred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-slate-500'
                            }`}
                        />
                      </td>

                      {/* Tender ID & Portal */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition">
                          {t.tender_id}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          <span>{t.portal}</span>
                        </div>
                      </td>

                      {/* Title & Org */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 line-clamp-2 leading-relaxed" title={cleanTenderTitle(t.title, t.organisation)}>
                          {cleanTenderTitle(t.title, t.organisation)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1" title={t.organisation}>
                          {t.organisation || 'N/A'}
                        </p>
                      </td>

                      {/* Closing Date */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col space-y-0.5">
                          <span className={`font-medium ${formatDeadline(t.closing_date).isExpired ? 'text-rose-600 line-through' : 'text-slate-800'}`}>
                            {t.closing_date ? t.closing_date : 'Check portal'}
                          </span>
                          {formatDeadline(t.closing_date).isExpired && (
                            <span className="inline-flex items-center w-fit px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                              ⏳ Deadline Passed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Est. Value & EMD */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-700 text-xs">
                          {t.estimated_value && t.estimated_value !== 'Check tender PDF / ATC' && t.estimated_value !== 'Not specified in listing'
                            ? t.estimated_value
                            : (t.extracted_pdf_text ? 'Unquoted (See BOQ)' : 'Pending Extract')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          EMD: {t.emd_amount && t.emd_amount !== 'Check tender PDF / ATC' ? t.emd_amount : 'Pending Parse'}
                        </div>
                      </td>

                      {/* Eligibility & Fit */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${fitScore >= 75
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : fitScore >= 50
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                          >
                            {fitLabel}
                          </span>
                          <span className="font-bold text-slate-700 text-xs">
                            {fitScore}%
                          </span>
                        </div>
                        {t.matched_keywords && (
                          <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[180px]">
                            {t.matched_keywords}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.status || 'New'}
                          onChange={(e) => handleStatusChange(e, t.id)}
                          className={`text-xs font-semibold rounded px-2 py-1 border transition ${t.status === 'Bid Ready'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : t.status === 'Reviewing'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : t.status === 'Submitted'
                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                        >
                          <option value="New">New</option>
                          <option value="Reviewing">Reviewing</option>
                          <option value="Bid Ready">Bid Ready</option>
                          <option value="Submitted">Submitted</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {t.is_claimed ? (
                            <div className="inline-flex items-center space-x-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title={`Claimed by ${t.assigned_to}`}>
                                👤 {t.assigned_to || 'Claimed'}
                              </span>
                              {(isSuperAdmin || canDeleteIndividual || user?.username === t.assigned_to) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnpickTender(t);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Release / Unpick tender"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePickTender(t)}
                              className="px-2.5 py-1 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] text-white text-[11px] font-bold inline-flex items-center space-x-1 transition shadow-xs cursor-pointer"
                              title="Pick and add to Bidding CRM"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Pick</span>
                            </button>
                          )}
                          <button
                            onClick={() => openTenderDrawer(t)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                            title="Inspect tender"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleCopyLink(e, t.tender_id || t.id)}
                            className="p-1 text-slate-400 hover:text-[#6B46C1] rounded transition cursor-pointer"
                            title="Copy direct share link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {t.url && (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                              title="Open official portal link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Shared Pagination Bar */}
        <div className="py-3 px-3 sm:px-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600">
          <div className="text-center sm:text-left">
            Showing <span className="font-semibold">{tenders.length}</span> of{' '}
            <span className="font-semibold">{total}</span> tenders
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 active:bg-slate-200 transition touch-manipulation font-medium inline-flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-semibold px-2 py-1 bg-white rounded-md border border-slate-200 text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 active:bg-slate-200 transition touch-manipulation font-medium inline-flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllTendersView;
export { AllTendersView as TendersView };
