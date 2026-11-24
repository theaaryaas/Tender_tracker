import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { contactsApi } from '../../utils/api';
import { 
  Building2, 
  Mail, 
  Search, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Clock, 
  Sparkles, 
  Send,
  X,
  ShieldCheck,
  Briefcase,
  Edit2,
  FileText,
  Zap,
  Check,
  Info,
  AlertCircle,
  Sliders
} from 'lucide-react';

export const CompanyContactsView = () => {
  const { openTenderDrawer, showNotification, syncState, setCurrentTab } = useApp();

  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ 
    total_companies: 0, 
    with_emails: 0, 
    without_emails: 0,
    total_linked_tenders: 0,
    parsed_tenders: 0,
    unextracted_tenders: 0
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [portal, setPortal] = useState('all');
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [sortBy, setSortBy] = useState('tender_count');
  const [sortDesc, setSortDesc] = useState(true);
  const [loading, setLoading] = useState(false);

  // Dynamic Batch Extraction state
  const [extractSelection, setExtractSelection] = useState('25'); // '10' | '25' | '50' | '100' | 'all' | 'custom'
  const [customExtractCount, setCustomExtractCount] = useState(50);
  const [extracting, setExtracting] = useState(false);
  const [extractingCompany, setExtractingCompany] = useState(null);
  const [extractProgress, setExtractProgress] = useState(null); // { is_running, progress, processed, target, discovered_emails, current_task }

  const pollIntervalRef = useRef(null);

  // Expanded officer emails popover state
  const [expandedOfficers, setExpandedOfficers] = useState({});

  // Editing state for manual email override
  const [editingCompany, setEditingCompany] = useState(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch contacts from backend
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactsApi.getContacts({
        page,
        limit,
        search: search.trim() || undefined,
        portal: portal !== 'all' ? portal : undefined,
        has_email_only: hasEmailOnly || undefined,
        sort_by: sortBy,
        sort_desc: sortDesc,
      });

      setContacts(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load company contacts:', err);
      showNotification('Failed to load company email directory', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, portal, hasEmailOnly, sortBy, sortDesc, showNotification]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  // Live Sync Reactivity: Re-fetch whenever a portal sync finishes
  useEffect(() => {
    if (!syncState.is_running) {
      fetchContacts();
    }
  }, [syncState.is_running]);

  // Poll background extraction job status
  const startPollingProgress = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await contactsApi.getExtractStatus();
        const data = res.data;
        setExtractProgress(data);

        if (!data.is_running) {
          // Finished!
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setExtracting(false);
          setExtractingCompany(null);

          if (data.error) {
            showNotification(`Extraction notice error: ${data.error}`, 'error');
          } else {
            showNotification(
              data.current_task || `Finished extracting notices! Discovered ${data.discovered_emails} buyer emails.`,
              'success'
            );
          }
          fetchContacts();
        }
      } catch (err) {
        console.error('Error polling extraction progress:', err);
      }
    }, 1200);
  }, [fetchContacts, showNotification]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        showNotification(`${label} copied to clipboard!`, 'success');
      })
      .catch(() => {
        showNotification(`Failed to copy ${label}`, 'error');
      });
  };

  const handleExportCsv = () => {
    const url = contactsApi.getCsvUrl({
      search: search.trim() || undefined,
      portal: portal !== 'all' ? portal : undefined,
      has_email_only: hasEmailOnly || undefined,
    });
    window.open(url, '_blank');
    showNotification('Exporting Company Directory to CSV...', 'info');
  };

  // Compute effective batch count to request
  const unextractedTotal = stats.unextracted_tenders || 0;
  let effectiveBatchCount = 25;
  if (extractSelection === 'all') {
    effectiveBatchCount = Math.max(1, unextractedTotal);
  } else if (extractSelection === 'custom') {
    effectiveBatchCount = Math.max(1, Number(customExtractCount) || 10);
  } else {
    effectiveBatchCount = Number(extractSelection) || 25;
  }

  // Run dynamic background extraction
  const handleBatchExtract = async () => {
    setExtracting(true);
    setExtractProgress({
      is_running: true,
      progress: 5,
      processed: 0,
      target: effectiveBatchCount,
      discovered_emails: 0,
      current_task: `Connecting to portal to parse ${effectiveBatchCount} notices...`
    });

    try {
      await contactsApi.batchExtract(effectiveBatchCount, null);
      showNotification(`Extraction job started in background for ${effectiveBatchCount} tenders.`, 'info');
      startPollingProgress();
    } catch (err) {
      console.error('Batch extraction launch failed:', err);
      setExtracting(false);
      setExtractProgress(null);
      if (err.response && err.response.status === 409) {
        showNotification('An extraction job is already currently running.', 'warning');
        startPollingProgress();
      } else {
        showNotification('Failed to start notice extraction', 'error');
      }
    }
  };

  // Run extraction specifically for one company
  const handleExtractForCompany = async (companyName) => {
    setExtractingCompany(companyName);
    setExtracting(true);
    setExtractProgress({
      is_running: true,
      progress: 10,
      processed: 0,
      target: 10,
      discovered_emails: 0,
      current_task: `Downloading and parsing notices for ${companyName}...`
    });

    try {
      await contactsApi.batchExtract(15, companyName);
      showNotification(`Parsing notices for ${companyName}...`, 'info');
      startPollingProgress();
    } catch (err) {
      console.error('Company extraction launch failed:', err);
      setExtractingCompany(null);
      setExtracting(false);
      setExtractProgress(null);
      showNotification(`Failed to extract notices for ${companyName}`, 'error');
    }
  };

  const handleOpenEdit = (contact) => {
    setEditingCompany(contact);
    setEditEmailValue(contact.email || '');
  };

  const handleSaveEmail = async () => {
    if (!editingCompany || !editEmailValue.trim()) return;
    setSavingEdit(true);
    try {
      await contactsApi.updateEmail(editingCompany.company_name, editEmailValue.trim());
      showNotification(`Updated official email for ${editingCompany.company_name}`, 'success');
      setEditingCompany(null);
      fetchContacts();
    } catch (err) {
      console.error('Failed to update email:', err);
      showNotification('Failed to update email', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleOfficerDropdown = (companyId) => {
    setExpandedOfficers(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2DEEC] shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6B46C1] to-[#9F7AEA] text-white flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1E182B] tracking-tight flex items-center gap-2">
                Company & Buyer Contact Directory
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6E6FA] text-[#553C9A] border border-[#D8BFD8]">
                  Dynamic Portal Extraction
                </span>
              </h1>
              <p className="text-xs text-[#8C82A0]">
                Live buyer emails extracted directly from official tender notice documents. Consolidated strictly by company.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchContacts}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] text-xs font-semibold text-[#553C9A] flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            title="Refresh latest contacts from tenders"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B46C1] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
            title="Download full company contacts as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC LIVE NOTICE EXTRACTOR CONTROLLER (Includes Total Present Options) */}
      <div className="bg-gradient-to-r from-[#FAF5FF] via-[#F3E8FF] to-[#FAF9FD] p-4 rounded-2xl border border-[#E9D8FD] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1E182B] flex items-center gap-2">
                Dynamic Tender Notice Extractor
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E2DEEC] text-[#553C9A]">
                  {unextractedTotal.toLocaleString()} Remaining to Extract ({stats.parsed_tenders} / {stats.total_linked_tenders} Already Parsed)
                </span>
              </h2>
              <p className="text-xs text-[#584E6B] mt-0.5">
                Download and parse notice PDFs to discover official buyer emails directly from the portal:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Number of Tenders Selector Dropdown including Total Present */}
            <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#D8BFD8]">
              <span className="text-xs font-semibold text-[#584E6B]">Batch:</span>
              <select
                value={extractSelection}
                onChange={(e) => setExtractSelection(e.target.value)}
                disabled={extracting}
                className="bg-transparent text-xs font-bold text-[#6B46C1] focus:outline-none cursor-pointer"
              >
                <option value="10">Top 10 Tenders</option>
                <option value="25">Top 25 Tenders</option>
                <option value="50">Top 50 Tenders</option>
                <option value="100">Top 100 Tenders</option>
                {unextractedTotal > 100 && (
                  <option value="250">Top 250 Tenders</option>
                )}
                {unextractedTotal > 0 && (
                  <option value="all">All {unextractedTotal.toLocaleString()} Remaining Tenders</option>
                )}
                <option value="custom">Custom Number...</option>
              </select>
            </div>

            {/* Custom Number Input when 'custom' is selected */}
            {extractSelection === 'custom' && (
              <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-xl border border-[#D8BFD8]">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, unextractedTotal)}
                  value={customExtractCount}
                  onChange={(e) => setCustomExtractCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={extracting}
                  className="w-16 text-xs font-bold text-[#6B46C1] text-center focus:outline-none"
                  placeholder="Count"
                />
                <span className="text-[10px] text-[#8C82A0]">of {unextractedTotal}</span>
              </div>
            )}

            {/* Run Extraction Button */}
            <button
              onClick={handleBatchExtract}
              disabled={extracting || unextractedTotal === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6B46C1] to-[#805AD5] hover:from-[#553C9A] hover:to-[#6B46C1] text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              {extracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting ({effectiveBatchCount} Notices)...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Extract Buyer Emails Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Background Progress Bar Banner */}
        {extracting && extractProgress && (
          <div className="p-3 bg-white/90 rounded-xl border border-[#D8BFD8] space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1E182B] flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-[#6B46C1] animate-spin" />
                {extractProgress.current_task || 'Parsing notices...'}
              </span>
              <span className="font-mono font-bold text-[#6B46C1]">
                {extractProgress.progress}% ({extractProgress.processed} / {extractProgress.target})
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-[#E2DEEC] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA] h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, extractProgress.progress))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#584E6B]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Discovered: <strong className="text-emerald-700">{extractProgress.discovered_emails} genuine buyer emails</strong>
              </span>
              {extractProgress.latest_email && (
                <span className="font-mono text-[10px] text-[#6B46C1] truncate max-w-xs">
                  Latest: {extractProgress.latest_email}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Key Metrics Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E2DEEC] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8C82A0] uppercase tracking-wider">Unique Companies</span>
            <Building2 className="w-4 h-4 text-[#6B46C1]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1E182B] mt-1 font-mono">{stats.total_companies.toLocaleString()}</p>
          <p className="text-[10px] text-[#584E6B] mt-0.5">Strictly consolidated entities</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2DEEC] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8C82A0] uppercase tracking-wider">With Buyer Emails</span>
            <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#2E7D32] mt-1 font-mono">{stats.with_emails.toLocaleString()}</p>
          <p className="text-[10px] text-[#584E6B] mt-0.5">
            {stats.without_emails} waiting for notice extract
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2DEEC] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8C82A0] uppercase tracking-wider">Parsed Notices</span>
            <FileText className="w-4 h-4 text-[#6B46C1]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#553C9A] mt-1 font-mono">{stats.parsed_tenders.toLocaleString()}</p>
          <p className="text-[10px] text-[#584E6B] mt-0.5">{unextractedTotal} unextracted remaining</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2DEEC] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8C82A0] uppercase tracking-wider">Source Fidelity</span>
            <Sparkles className="w-4 h-4 text-[#FFDAB9]" />
          </div>
          <div className="flex items-center space-x-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-bold text-[#1E182B]">100% Portal Notices</p>
          </div>
          <p className="text-[10px] text-[#584E6B] mt-0.5">Saved permanently in PostgreSQL</p>
        </div>
      </div>

      {/* 4. Search and Filters Toolbar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#E2DEEC] shadow-2xs flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative min-w-0">
          <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by company name, email address, portal, or tender ID..."
            className="w-full pl-9 pr-8 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder-[#8C82A0] focus:outline-none focus:border-[#6B46C1] focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C82A0] hover:text-[#1E182B]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Portal Filter */}
          <select
            value={portal}
            onChange={(e) => {
              setPortal(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs font-semibold text-[#584E6B] focus:outline-none focus:border-[#6B46C1] cursor-pointer"
          >
            <option value="all">All Portals</option>
            <option value="gem">GeM BidPlus</option>
            <option value="central">CPPP / Central</option>
            <option value="rail">RailTel</option>
          </select>

          {/* Sort By Filter */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs font-semibold text-[#584E6B] focus:outline-none focus:border-[#6B46C1] cursor-pointer"
          >
            <option value="tender_count">Sort: Most Bids / Tenders</option>
            <option value="company">Sort: Company Name (A-Z)</option>
            <option value="email">Sort: Has Email Available</option>
            <option value="latest_date">Sort: Latest Deadline</option>
          </select>

          {/* Only with Email Toggle */}
          <label className="flex items-center space-x-1.5 px-3 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs font-semibold text-[#553C9A] cursor-pointer hover:bg-[#E6E6FA] transition select-none">
            <input
              type="checkbox"
              checked={hasEmailOnly}
              onChange={(e) => {
                setHasEmailOnly(e.target.checked);
                setPage(1);
              }}
              className="w-3.5 h-3.5 accent-[#6B46C1] rounded"
            />
            <span>With Email Only</span>
          </label>
        </div>
      </div>

      {/* 5. Table of Unique Company Contacts */}
      <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9FD] border-b border-[#E2DEEC] text-[#584E6B] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Company / Organisation</th>
                <th className="py-3 px-4">Official Contact Email</th>
                <th className="py-3 px-3 text-center">Bids / Tenders</th>
                <th className="py-3 px-3">Portals</th>
                <th className="py-3 px-3">Latest Deadline</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DEEC]/70">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-xs text-[#8C82A0]">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#6B46C1]" />
                      <span>Loading company email directory...</span>
                    </div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center">
                    <Building2 className="w-8 h-8 text-[#8C82A0] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-[#1E182B]">No company contacts found</p>
                    <p className="text-[11px] text-[#8C82A0] mt-0.5">Try clearing filters or running a notice extraction.</p>
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="mt-3 px-3 py-1 bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] rounded-lg text-xs font-semibold text-[#6B46C1]"
                      >
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const companyInitials = (c.company_name || 'C')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map(w => w.charAt(0).toUpperCase())
                    .join('');

                  const hasOfficerEmails = c.officer_emails && c.officer_emails.length > 0;
                  const isOfficerExpanded = !!expandedOfficers[c.id];
                  const isThisCompanyExtracting = extractingCompany === c.company_name;

                  // Source badge styling
                  let sourceBadgeColor = "bg-[#FAF5FF] text-[#6B46C1] border-[#E9D8FD]";
                  let sourceLabel = c.email_source || "Notice PDF";
                  if (c.email_source === "Dynamic Portal Extract") {
                    sourceBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    sourceLabel = "Live Notice Extract";
                  } else if (c.email_source === "User Custom Override") {
                    sourceBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                    sourceLabel = "Custom";
                  } else if (c.email_source === "CRM Contact") {
                    sourceBadgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                    sourceLabel = "CRM Contact";
                  }

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#FAF9FD]/80 transition group"
                    >
                      {/* Company Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-start space-x-2.5 max-w-sm">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6B46C1] to-[#9F7AEA] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 shadow-2xs">
                            {companyInitials || 'C'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#1E182B] text-xs leading-snug break-words">
                              {c.company_name}
                            </p>
                            {c.latest_tender_title && (
                              <p className="text-[10px] text-[#8C82A0] truncate max-w-xs mt-0.5" title={c.latest_tender_title}>
                                {c.latest_tender_title}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Official Contact Email */}
                      <td className="py-3 px-4">
                        {c.email ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center space-x-1.5 bg-[#FAF5FF] border border-[#E9D8FD] px-2.5 py-1 rounded-lg">
                              <Mail className="w-3.5 h-3.5 text-[#6B46C1] shrink-0" />
                              <a
                                href={`mailto:${c.email}?subject=Inquiry regarding active tender notice`}
                                className="font-mono text-xs font-semibold text-[#553C9A] hover:underline"
                                title="Click to compose email"
                              >
                                {c.email}
                              </a>
                              <button
                                onClick={() => handleCopy(c.email, 'Email')}
                                className="p-0.5 text-[#8C82A0] hover:text-[#6B46C1] rounded transition cursor-pointer"
                                title="Copy email to clipboard"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(c)}
                                className="p-0.5 text-[#8C82A0] hover:text-[#6B46C1] rounded transition cursor-pointer"
                                title="Edit or override email"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {c.primary_detail?.doc_url && (
                                <a
                                  href={c.primary_detail.doc_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-0.5 text-[#8C82A0] hover:text-[#6B46C1] rounded transition cursor-pointer"
                                  title="Open official GeM Bid Specification PDF to verify primary email source"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {/* Source badge */}
                              <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${sourceBadgeColor}`}>
                                {sourceLabel}
                              </span>

                              {/* Tender ID Mentioned Against Primary Email */}
                              {(c.primary_tender_id || c.primary_detail?.tender_id || (c.tender_ids && c.tender_ids[0])) && (
                                <button
                                  onClick={() => openTenderDrawer({ tender_id: c.primary_tender_id || c.primary_detail?.tender_id || c.tender_ids[0] })}
                                  className="inline-flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-[#553C9A] border border-purple-200 hover:bg-purple-100 hover:border-[#6B46C1] transition cursor-pointer"
                                  title={`Source Tender ID: ${c.primary_tender_id || c.primary_detail?.tender_id || c.tender_ids[0]}`}
                                >
                                  <FileText className="w-2.5 h-2.5 text-[#6B46C1]" />
                                  <span className="font-semibold text-[#6B46C1]">Tender:</span>
                                  <span className="font-bold">{c.primary_tender_id || c.primary_detail?.tender_id || c.tender_ids[0]}</span>
                                </button>
                              )}

                              {/* Officer emails expansion pill */}
                              {hasOfficerEmails && (
                                <button
                                  onClick={() => toggleOfficerDropdown(c.id)}
                                  className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-[#E6E6FA] text-[#553C9A] border border-[#D8BFD8] hover:bg-[#D8BFD8] transition cursor-pointer"
                                  title="Click to view additional officer emails"
                                >
                                  +{c.officer_emails.length} Officer Email{c.officer_emails.length > 1 ? 's' : ''}
                                </button>
                              )}
                            </div>

                            {/* Expanded Officer Emails List with Complete Credibility Context */}
                            {hasOfficerEmails && isOfficerExpanded && (
                              <div className="mt-2 p-3 bg-white border border-[#E2DEEC] rounded-xl shadow-md space-y-2 text-xs animate-in fade-in duration-150 max-w-md">
                                <div className="flex items-center justify-between border-b border-[#E2DEEC]/70 pb-1.5">
                                  <div className="flex items-center space-x-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-[#6B46C1]" />
                                    <span className="text-[10px] font-bold text-[#553C9A] uppercase tracking-wider">
                                      Discovered Notice Contacts ({c.officer_emails.length})
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#8C82A0] italic">GeM Bid Specifications</span>
                                </div>

                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                  {(c.officer_details || c.officer_emails.map(e => ({ email: e }))).map((off) => {
                                    const offEmail = typeof off === 'string' ? off : off.email;
                                    const offRole = off.role || 'Officer Contact';
                                    const offUnit = off.org_unit;
                                    const offTenderId = off.tender_id;
                                    const offTitle = off.tender_title;
                                    const offDocUrl = off.doc_url;

                                    return (
                                      <div key={offEmail} className="p-2 bg-[#FAF9FD] rounded-lg border border-[#E2DEEC] space-y-1 hover:border-[#6B46C1]/40 transition">
                                        {/* Row 1: Email, Role, Copy */}
                                        <div className="flex items-center justify-between gap-1.5">
                                          <div className="flex items-center space-x-1.5 min-w-0">
                                            <Mail className="w-3 h-3 text-[#6B46C1] shrink-0" />
                                            <a
                                              href={`mailto:${offEmail}`}
                                              className="font-mono text-[11px] font-semibold text-[#553C9A] hover:underline truncate"
                                              title="Click to compose email"
                                            >
                                              {offEmail}
                                            </a>
                                          </div>
                                          <div className="flex items-center space-x-1 shrink-0">
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                                              offRole.includes('HOD')
                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            }`}>
                                              {offRole}
                                            </span>
                                            <button
                                              onClick={() => handleCopy(offEmail, 'Officer Email')}
                                              className="p-0.5 text-[#8C82A0] hover:text-[#6B46C1] cursor-pointer"
                                              title="Copy email"
                                            >
                                              <Copy className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Row 2: Tender ID Mentioned Against This Email */}
                                        {offTenderId && (
                                          <div className="flex items-center justify-between gap-1 bg-white px-2 py-0.5 rounded border border-[#E2DEEC] text-[10px]">
                                            <div className="flex items-center space-x-1.5 min-w-0">
                                              <span className="text-[#8C82A0] font-sans font-medium">Tender ID:</span>
                                              <button
                                                onClick={() => openTenderDrawer({ tender_id: offTenderId })}
                                                className="font-mono font-bold text-[#6B46C1] hover:underline truncate cursor-pointer"
                                                title={`Inspect tender ${offTenderId}`}
                                              >
                                                {offTenderId}
                                              </button>
                                            </div>
                                            {offDocUrl && (
                                              <a
                                                href={offDocUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center space-x-0.5 text-[#6B46C1] hover:text-[#553C9A] font-semibold hover:underline shrink-0"
                                                title="Open official GeM Bid Specification PDF to verify source"
                                              >
                                                <span>GeM Notice</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                              </a>
                                            )}
                                          </div>
                                        )}

                                        {/* Row 3: Sub-unit / Department & Title */}
                                        {(offUnit || offTitle) && (
                                          <div className="flex items-center space-x-1 text-[10px] text-[#8C82A0] truncate">
                                            {offUnit && <span className="text-[#6B46C1] font-semibold">{offUnit}</span>}
                                            {offUnit && offTitle && <span>•</span>}
                                            {offTitle && <span className="truncate">{offTitle}</span>}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[#8C82A0] bg-[#FAF9FD] px-2 py-0.5 rounded border border-[#E2DEEC] flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                              <span>Notice Not Parsed Yet</span>
                            </span>

                            {/* Single-Click Extract Button for this specific Company */}
                            <button
                              onClick={() => handleExtractForCompany(c.company_name)}
                              disabled={isThisCompanyExtracting || extracting}
                              className="px-2 py-0.5 bg-[#FAF5FF] hover:bg-[#E6E6FA] border border-[#E9D8FD] text-[#6B46C1] rounded text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
                              title={`Download and parse tender notices for ${c.company_name}`}
                            >
                              {isThisCompanyExtracting ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Extracting...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span>Extract Emails</span>
                                </>
                              )}
                            </button>

                            {/* Manual Edit Shortcut */}
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-1 text-[#8C82A0] hover:text-[#6B46C1] rounded cursor-pointer"
                              title="Enter email manually"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Total Bids / Tenders */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#E6E6FA] text-[#553C9A] border border-[#D8BFD8]">
                            {c.tender_count} {c.tender_count === 1 ? 'Bid' : 'Bids'}
                          </span>

                          {/* Quick clickable preview of primary tender */}
                          {c.tender_ids && c.tender_ids.length > 0 && (
                            <button
                              onClick={() => openTenderDrawer({ tender_id: c.tender_ids[0] })}
                              className="text-[9px] font-mono text-[#6B46C1] hover:underline mt-1 truncate max-w-[100px] cursor-pointer"
                              title={`Inspect tender ${c.tender_ids[0]}`}
                            >
                              {c.tender_ids[0]}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Portals */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[130px]">
                          {(c.portals || []).map((p) => (
                            <span
                              key={p}
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FAF9FD] border border-[#E2DEEC] text-[#584E6B] truncate"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Latest Deadline */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1 text-[#584E6B] text-[11px]">
                          <Clock className="w-3 h-3 text-[#8C82A0] shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {c.latest_closing_date || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {c.email && (
                            <a
                              href={`mailto:${c.email}?subject=Inquiry regarding active procurement tenders`}
                              className="p-1.5 bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] text-[#6B46C1] rounded-lg transition cursor-pointer"
                              title={`Send email to ${c.email}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] text-[#584E6B] rounded-lg transition cursor-pointer"
                            title="Edit contact email"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick navigate to All Tenders for this company */}
                          <button
                            onClick={() => {
                              setCurrentTab('tenders');
                              if (c.tender_ids && c.tender_ids[0]) {
                                openTenderDrawer({ tender_id: c.tender_ids[0] });
                              }
                            }}
                            className="p-1.5 bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] text-[#584E6B] rounded-lg transition cursor-pointer"
                            title="Inspect company tenders"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Bar */}
        <div className="px-4 py-3 bg-[#FAF9FD] border-t border-[#E2DEEC] flex items-center justify-between text-xs text-[#584E6B]">
          <div>
            Showing <span className="font-semibold text-[#1E182B]">{contacts.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-semibold text-[#1E182B]">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-semibold text-[#1E182B]">{total.toLocaleString()}</span> unique company contacts
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[#E2DEEC] bg-white text-[#584E6B] hover:bg-[#FAF9FD] disabled:opacity-40 transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-semibold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[#E2DEEC] bg-white text-[#584E6B] hover:bg-[#FAF9FD] disabled:opacity-40 transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Edit / Add Email Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF5FF] border border-[#E9D8FD] flex items-center justify-center text-[#6B46C1]">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1E182B] text-sm">Update Official Contact Email</h3>
                  <p className="text-[11px] text-[#8C82A0]">Set persistent email for this company across all bids</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="p-1 text-[#8C82A0] hover:text-[#1E182B] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#584E6B] block mb-1">Company / Organisation</label>
                <input
                  type="text"
                  disabled
                  value={editingCompany.company_name}
                  className="w-full px-3 py-2 bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl text-xs font-semibold text-[#1E182B] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#584E6B] block mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={editEmailValue}
                  onChange={(e) => setEditEmailValue(e.target.value)}
                  placeholder="e.g. officer.name@gov.in"
                  className="w-full px-3 py-2 bg-white border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder-[#8C82A0] focus:outline-none focus:border-[#6B46C1] transition"
                  autoFocus
                />
              </div>

              <div className="p-2.5 bg-[#FAF5FF] border border-[#E9D8FD] rounded-xl flex items-start space-x-2 text-[11px] text-[#553C9A]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#6B46C1]" />
                <span>This email will be applied to all {editingCompany.tender_count} active bids for this company and saved permanently to PostgreSQL.</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2DEEC]">
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="px-3.5 py-2 rounded-xl border border-[#E2DEEC] text-xs font-semibold text-[#584E6B] hover:bg-[#FAF9FD] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEmail}
                disabled={savingEdit || !editEmailValue.trim()}
                className="px-4 py-2 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {savingEdit ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyContactsView;
