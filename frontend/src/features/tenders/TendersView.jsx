import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  Star,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  Eye,
  CheckCircle2,
  Users,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { tenderApi, exportApi } from '../../utils/api';

export const TendersView = () => {
  const { openTenderDrawer, showNotification } = useApp();
  const [tenders, setTenders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [portal, setPortal] = useState('all');
  const [status, setStatus] = useState('all');
  const [eligibility, setEligibility] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [sortDesc, setSortDesc] = useState(true);
  const [batchParsing, setBatchParsing] = useState(false);

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

  const fetchTenders = async () => {
    setLoading(true);
    try {
      const res = await tenderApi.getTenders({
        page,
        limit,
        search: search || undefined,
        portal: portal !== 'all' ? portal : undefined,
        status: status !== 'all' ? status : undefined,
        eligibility: eligibility !== 'all' ? eligibility : undefined,
        priority: priority !== 'all' ? priority : undefined,
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
  }, [page, limit, portal, status, eligibility, priority, sortBy, sortDesc]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTenders();
  };

  const handleStatusChange = async (e, tenderId) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    try {
      await tenderApi.updateTender(tenderId, { status: newStatus });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, status: newStatus } : t))
      );
      showNotification(`Tender status changed to ${newStatus}`, 'success');
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleStarToggle = async (e, tender) => {
    e.stopPropagation();
    try {
      const updated = !tender.is_starred;
      await tenderApi.updateTender(tender.id, { is_starred: updated });
      setTenders((prev) =>
        prev.map((t) => (t.id === tender.id ? { ...t, is_starred: updated } : t))
      );
    } catch (err) {
      showNotification('Failed to update star', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by tender ID, title, organization, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </form>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleBatchParse}
              disabled={batchParsing}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
              title="Parse GeM PDF documents for top tenders in the background"
            >
              <Sparkles className="w-4 h-4" />
              <span>{batchParsing ? 'Extracting...' : 'Auto-Extract Criteria'}</span>
            </button>
            <a
              href={exportApi.getExcelUrl({ search, portal, status, eligibility })}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
              download
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </a>
            <a
              href={exportApi.getCsvUrl({ search, portal, status, eligibility })}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              download
            >
              <FileText className="w-4 h-4" />
              <span>CSV</span>
            </a>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Portal</label>
            <select
              value={portal}
              onChange={(e) => { setPortal(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full p-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Fits</option>
              <option value="direct fit">Potential Direct Fit</option>
              <option value="partner">SI Partner Route</option>
              <option value="review">Manual Review</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pipeline Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full p-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort By</label>
            <select
              value={`${sortBy}-${sortDesc}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split('-');
                setSortBy(sb);
                setSortDesc(sd === 'true');
                setPage(1);
              }}
              className="w-full p-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="id-true">Latest Discovered</option>
              <option value="fit_score-true">Highest Fit Score</option>
              <option value="closing_date-false">Closing Date (Earliest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">⭐</th>
                <th className="py-3 px-4 w-44">Tender ID / Portal</th>
                <th className="py-3 px-4 min-w-[280px]">Tender Title & Department</th>
                <th className="py-3 px-4 w-36">Closing Date</th>
                <th className="py-3 px-4 w-36">Est. Value & EMD</th>
                <th className="py-3 px-4 w-44">Eligibility & Fit</th>
                <th className="py-3 px-4 w-32">Status</th>
                <th className="py-3 px-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center space-x-2 animate-pulse">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                      <span>Loading tenders...</span>
                    </div>
                  </td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No tenders match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                tenders.map((t) => {
                  const isDirect = (t.eligibility_assessment || '').toLowerCase().includes('direct fit');
                  const isPartner = (t.eligibility_assessment || '').toLowerCase().includes('partner');

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
                        <p className="font-medium text-slate-900 line-clamp-2 leading-relaxed">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {t.organisation || 'N/A'}
                        </p>
                      </td>

                      {/* Closing Date */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">
                          {t.closing_date ? t.closing_date : 'Check portal'}
                        </span>
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
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${isDirect
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isPartner
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                          >
                            {isDirect ? 'Direct Fit' : isPartner ? 'SI Partner' : 'Review'}
                          </span>
                          <span className="font-bold text-slate-700 text-xs">
                            {t.fit_score}%
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
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openTenderDrawer(t)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                            title="Inspect tender"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {t.url && (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
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

        {/* Pagination Bar */}
        <div className="py-3 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold">{tenders.length}</span> of{' '}
            <span className="font-semibold">{total}</span> tenders
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

