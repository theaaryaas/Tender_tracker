import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { copyTenderLinkToClipboard, getAnalysisUrl } from '../../utils/navigation';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  Cpu,
  Boxes,
  Package,
  Layers,
  Filter,
  Download,
  UploadCloud,
  RefreshCw,
  Share2,
  Printer,
  ArrowLeft,
  Search,
  ExternalLink,
  Info,
  Calendar,
  IndianRupee,
  MapPin,
  Clock,
  Sparkles,
  FileSpreadsheet,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Users,
  Award,
  Scale,
  Briefcase,
  FileCheck
} from 'lucide-react';

export const TenderAnalysisPage = () => {
  const { selectedTender, setCurrentTab, showNotification, isSuperAdmin, user } = useApp();

  const [tender, setTender] = useState(selectedTender || null);
  const [analysis, setAnalysis] = useState(selectedTender?.deep_analysis || null);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boqSearch, setBoqSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showBoqTable, setShowBoqTable] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragActivePdf, setDragActivePdf] = useState(false);
  const [dragActiveExcel, setDragActiveExcel] = useState(false);

  const pdfInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const modalPdfInputRef = useRef(null);
  const modalExcelInputRef = useRef(null);

  // Load deep analysis if tender is selected
  useEffect(() => {
    if (selectedTender) {
      setTender(selectedTender);
      if (selectedTender.deep_analysis) {
        setAnalysis(selectedTender.deep_analysis);
      } else {
        fetchDeepAnalysis(selectedTender.tender_id || selectedTender.id);
      }
    }
  }, [selectedTender]);

  const fetchDeepAnalysis = async (tenderId) => {
    setLoading(true);
    try {
      const res = await tenderApi.getDeepAnalysis(tenderId);
      setAnalysis(res.data);
    } catch (err) {
      console.warn('Could not load deep analysis', err);
      showNotification('Could not load cached analysis. Click Re-Analyze or Upload Document.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleForceReanalyze = async () => {
    if (!tender) return;
    setReanalyzing(true);
    try {
      const targetId = tender.id || tender.tender_id;
      const res = await tenderApi.forceDeepAnalyze(targetId);
      setAnalysis(res.data);
      showNotification('Deep eligibility analysis successfully refreshed!', 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to re-analyze tender', 'error');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleFileUpload = async (file, isExcel = false) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (tender?.id || tender?.tender_id) {
        const targetId = tender.id || tender.tender_id;
        const res = await tenderApi.uploadDocumentAndAnalyze(targetId, formData);
        setAnalysis(res.data);
        showNotification(`${isExcel ? 'BOQ Excel' : 'Document'} "${file.name}" uploaded & analyzed!`, 'success');
      } else {
        const res = await tenderApi.analyzeAdHoc(formData);
        setAnalysis(res.data);
        setTender({
          tender_id: res.data?.tender_id || 'Uploaded Document',
          title: res.data?.title || file.name,
          organisation: res.data?.organisation || 'Direct Upload',
          deep_analysis: res.data
        });
        showNotification(`${isExcel ? 'BOQ Excel' : 'Document'} "${file.name}" analyzed successfully!`, 'success');
      }
      setShowUploadModal(false);
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to analyze uploaded file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePasteAnalyze = async () => {
    if (!pasteText.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('raw_text', pasteText);

    try {
      const res = await tenderApi.analyzeAdHoc(formData);
      setAnalysis(res.data);
      setTender({
        tender_id: res.data?.tender_id || 'Pasted Document',
        title: res.data?.title || 'Pasted Tender Specification',
        organisation: res.data?.organisation || 'Direct Input',
        deep_analysis: res.data
      });
      showNotification('Pasted tender document text analyzed successfully!', 'success');
      setShowUploadModal(false);
      setPasteText('');
    } catch (err) {
      showNotification('Failed to analyze pasted text', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleChecklist = (itemNo) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemNo]: !prev[itemNo]
    }));
  };

  const handleCopyLink = async () => {
    const code = tender?.tender_id || tender?.id || '';
    if (!code) {
      navigator.clipboard.writeText(window.location.href);
      showNotification('Analysis page link copied to clipboard!', 'success');
      return;
    }
    const url = getAnalysisUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      showNotification(`Analysis link copied: ${url}`, 'success');
    } catch {
      showNotification('Failed to copy link', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const verdict = analysis?.overall_verdict || {};
  const criteria = analysis?.criteria_checks || {};
  const sixPillars = analysis?.six_pillars || {};
  const stats = analysis?.core_stats || {};
  const checklist = analysis?.mandatory_documents_checklist || [];
  const boqList = analysis?.boq_items || [];
  const deliverables = analysis?.deliverables_summary || criteria.hardware_scope?.deliverables_summary || {};
  const categoryBreakdown = deliverables.category_breakdown || {};

  // Pillars Data
  const certsPillar = sixPillars.corporate_certifications || criteria.corporate_certifications || {};
  const legalPillar = sixPillars.legal_registration || criteria.legal_registration || {};
  const financePillar = sixPillars.financial_criteria || criteria.financial_criteria || {};
  const expPillar = sixPillars.experience_criteria || criteria.experience_criteria || {};
  const workforcePillar = sixPillars.workforce_criteria || criteria.workforce_criteria || {};

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  const filteredBoq = boqList.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
      return false;
    }
    if (!boqSearch.trim()) return true;
    const q = boqSearch.toLowerCase();
    return (
      (item.description || '').toLowerCase().includes(q) ||
      (item.product || '').toLowerCase().includes(q) ||
      (item.make || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.tier || '').toLowerCase().includes(q) ||
      (item.item_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Hidden file inputs for direct one-click upload buttons */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0], false);
          }
        }}
      />
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0], true);
          }
        }}
      />

      {/* Top Header & Breadcrumbs */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#E2DEEC] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setCurrentTab('tenders')}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#6B46C1] hover:text-[#553C9A] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Tenders</span>
            </button>
            <span className="text-[#8C82A0] text-xs">•</span>
            <span className="text-xs text-[#8C82A0] font-medium">6-Pillar Tender Eligibility &amp; Compliance Report</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#553C9A] to-[#805AD5] text-white flex items-center justify-center font-bold shadow-xs">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1E182B] tracking-tight">
                {tender?.title || stats.title || 'Tender Eligibility & Scope Deep Analysis Report'}
              </h1>
              <p className="text-xs text-[#6B5E82] flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="font-semibold text-[#1E182B]">ID: {tender?.tender_id || stats.tender_id || 'N/A'}</span>
                <span>•</span>
                <span>{tender?.organisation || stats.organisation || 'Govt Department / Buyer'}</span>
                {tender?.portal && (
                  <>
                    <span>•</span>
                    <span className="bg-[#FAF9FD] text-[#6B46C1] px-2 py-0.5 rounded-md border border-[#E2DEEC] font-semibold text-[10px]">
                      {tender.portal}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
          {/* Upload PDF Button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => pdfInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] hover:border-[#D8BFD8] text-[#6B46C1] font-semibold text-xs inline-flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            title="Upload tender PDF document for deep eligibility analysis"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#6B46C1]" />
            <span>Upload PDF</span>
          </button>

          {/* Upload Excel Button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => excelInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 font-semibold text-xs inline-flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            title="Upload Bill of Quantities (BOQ) or Manpower Rate Schedule in Excel (.xlsx, .xls) or CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Upload Excel</span>
          </button>

          {/* Re-Analyze Button */}
          <button
            type="button"
            disabled={reanalyzing || loading || uploading}
            onClick={handleForceReanalyze}
            className="px-3.5 py-2 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs inline-flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
            title="Re-run deep analysis on document"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
            <span>{reanalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] text-[#6B5E82] hover:text-[#1E182B] transition cursor-pointer"
            title="Print or Save PDF report"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Share Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] text-[#6B5E82] hover:text-[#1E182B] transition cursor-pointer"
            title="Copy shareable report link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E2DEEC]">
          <RefreshCw className="w-8 h-8 mx-auto text-[#6B46C1] animate-spin mb-3" />
          <p className="text-sm font-bold text-[#1E182B]">Generating Deep Eligibility Analysis...</p>
          <p className="text-xs text-[#8C82A0] mt-1">Evaluating the 6 Eligibility Pillars: Certifications, Gumasta &amp; Constitution, Financials, Experience, Workforce, and Checklist.</p>
        </div>
      )}

      {/* Main Content Area when Analysis is Available */}
      {analysis && !loading && (
        <>
          {/* Executive Verdict Banner */}
          <div className={`p-5 sm:p-6 rounded-2xl border transition shadow-sm ${
            verdict.badge === 'emerald'
              ? 'bg-gradient-to-r from-[#F0FDF4] to-[#DCFCE7] border-[#86EFAC]'
              : verdict.badge === 'rose'
              ? 'bg-gradient-to-r from-[#FFF5F5] to-[#FEE2E2] border-[#FCA5A5]'
              : 'bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] border-[#FCD34D]'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border shadow-2xs ${
                    verdict.badge === 'emerald'
                      ? 'bg-white text-[#15803D] border-[#86EFAC]'
                      : verdict.badge === 'rose'
                      ? 'bg-white text-[#B91C1C] border-[#FCA5A5]'
                      : 'bg-white text-[#B45309] border-[#FCD34D]'
                  }`}>
                    {verdict.title || 'Eligibility Verdict'}
                  </span>
                  <span className="text-xs font-bold text-[#4B3E60]">
                    Compliance Score: <b>{verdict.score || 70}%</b>
                  </span>
                </div>

                <p className="text-sm sm:text-base font-semibold text-[#1E182B] leading-relaxed">
                  {verdict.summary}
                </p>

                {/* Key Alerts */}
                {verdict.key_alerts && verdict.key_alerts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {verdict.key_alerts.map((alert, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs font-semibold text-rose-900 bg-white/80 p-2 rounded-lg border border-rose-200">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Score Dial Badge */}
              <div className="shrink-0 flex md:flex-col items-center justify-center p-4 bg-white/90 rounded-2xl border border-black/5 shadow-xs">
                <div className={`text-3xl sm:text-4xl font-black ${
                  verdict.badge === 'emerald' ? 'text-emerald-600' : verdict.badge === 'rose' ? 'text-rose-600' : 'text-amber-600'
                }`}>
                  {verdict.score || 70}%
                </div>
                <div className="text-[11px] font-bold text-[#6B5E82] uppercase tracking-wider mt-0.5 ml-2 md:ml-0">
                  Fit Score
                </div>
              </div>
            </div>
          </div>

          {/* Core Financials & Stats Overview Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-[#6B46C1]" /> Estimated Value
              </span>
              <p className="text-sm font-bold text-[#1E182B] truncate">{stats.estimated_value || 'Not Disclosed'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> EMD Amount
              </span>
              <p className="text-sm font-bold text-[#1E182B] truncate flex items-center justify-between">
                <span>{stats.emd_amount || 'Check PDF'}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  criteria.msme_relaxation?.emd_exempt ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {criteria.msme_relaxation?.emd_exempt ? 'MSE Exempt' : 'Mandatory'}
                </span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#6B46C1]" /> Tender Fee
              </span>
              <p className="text-sm font-bold text-[#1E182B] truncate">{stats.tender_fee || 'Nil / Exempt'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-600" /> Bid Due Date
              </span>
              <p className="text-xs sm:text-sm font-bold text-rose-600 truncate">{stats.due_date || 'Check Portal'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#6B46C1]" /> Bid Opening Date
              </span>
              <p className="text-xs sm:text-sm font-bold text-[#1E182B] truncate">{stats.opening_date || 'Check Portal'}</p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SCOPE OF WORK & TENDER DELIVERABLES (WHAT NEEDS TO BE DELIVERED) */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs overflow-hidden space-y-0">
            {/* Header */}
            <div
              className="p-4 sm:p-5 border-b border-[#E2DEEC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-[#FAF9FD]"
              onClick={() => setShowBoqTable(!showBoqTable)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6B46C1] border border-purple-200 flex items-center justify-center font-bold shrink-0">
                  <Package className="w-5 h-5 text-[#6B46C1]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      Scope of Work &amp; Tender Deliverables (What Needs to be Delivered)
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-[#6B46C1] border border-purple-200">
                      Mandatory Supply
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B5E82] mt-0.5">
                    Official bill of materials, equipment specifications, and turnkey installation scope required for this tender.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 self-end sm:self-center">
                {boqList.length > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {analysis.total_boq_count || boqList.length} Items Parsed
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    excelInputRef.current?.click();
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] text-[#6B46C1] inline-flex items-center space-x-1.5 transition cursor-pointer"
                  title="Upload separate Excel or CSV BOQ schedule"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload BOQ Excel</span>
                </button>
                <button
                  type="button"
                  className="p-1 text-[#8C82A0] hover:text-[#1E182B]"
                >
                  {showBoqTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Collapsible Content */}
            {showBoqTable && (
              <div className="p-4 sm:p-5 space-y-4">
                {/* Executive Scope Narrative Banner */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#FAF9FD] via-[#F5F2FC] to-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E182B] flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#6B46C1]" />
                      <span>Executive Scope &amp; Deployment Summary</span>
                    </span>
                    <span className="text-[10px] text-[#8C82A0]">
                      Location / Buyer: <b className="text-[#4B3E60]">{analysis.organisation || 'Buyer Site'}</b>
                    </span>
                  </div>
                  <p className="text-[#4B3E60] leading-relaxed">
                    {deliverables.scope_overview ||
                      `Supply, installation, testing, commissioning, and AMC maintenance of Integrated Infrastructure at ${analysis.organisation || 'buyer premises'}. Deliverables comprise itemized BOQ components across multiple hardware and service categories.`}
                  </p>
                </div>

                {/* Category Count Badges Strip */}
                {Object.keys(categoryBreakdown).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#8C82A0]">
                      <span className="font-semibold uppercase tracking-wider">Equipment Category Breakdown:</span>
                      <span>Click a category to filter table</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                          selectedCategory === 'ALL'
                            ? 'bg-[#6B46C1] text-white border-[#6B46C1] shadow-xs'
                            : 'bg-white text-[#4B3E60] border-[#E2DEEC] hover:bg-[#FAF9FD]'
                        }`}
                      >
                        All Categories ({boqList.length})
                      </button>
                      {Object.entries(categoryBreakdown).map(([cat, count]) => {
                        const isSelected = selectedCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center space-x-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-[#6B46C1] text-white border-[#6B46C1] shadow-xs'
                                : 'bg-[#FAF9FD] text-[#4B3E60] border-[#E2DEEC] hover:bg-white hover:border-[#6B46C1]'
                            }`}
                          >
                            <span>{cat}</span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-[#6B46C1]'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items Table or Upload Callout */}
                {boqList.length > 0 ? (
                  <div className="space-y-3">
                    {/* Search & Filter Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                      <div className="relative max-w-sm w-full">
                        <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={boqSearch}
                          onChange={(e) => setBoqSearch(e.target.value)}
                          placeholder="Search items by name, make (Bosch, Seagate, LG, etc.)..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E2DEEC] text-xs focus:ring-1 focus:ring-[#6B46C1] focus:outline-none bg-white"
                        />
                      </div>
                      <span className="text-xs text-[#8C82A0] font-semibold self-end sm:self-center">
                        Showing <b>{filteredBoq.length}</b> of <b>{boqList.length}</b> deliverables
                      </span>
                    </div>

                    {/* Interactive BOQ Deliverables Table */}
                    <div className="overflow-x-auto border border-[#E2DEEC] rounded-xl max-h-[460px] shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9FD] text-[#4B3E60] uppercase text-[10px] tracking-wider border-b border-[#E2DEEC] sticky top-0 z-10 bg-white">
                          <tr>
                            <th className="py-2.5 px-3.5 w-16">Item #</th>
                            <th className="py-2.5 px-3.5">Equipment Deliverable &amp; Technical Specifications</th>
                            <th className="py-2.5 px-3.5 w-48">Approved Make / Brand</th>
                            <th className="py-2.5 px-3.5 w-40">Category</th>
                            <th className="py-2.5 px-3.5 w-24 text-right">Quantity</th>
                            <th className="py-2.5 px-3.5 w-20">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0EDF6]">
                          {filteredBoq.map((item, idx) => (
                            <tr key={idx} className="hover:bg-[#FAF9FD] transition">
                              <td className="py-2.5 px-3.5 font-mono text-[#8C82A0] font-bold">
                                {item.item_no}
                              </td>
                              <td className="py-2.5 px-3.5 text-[#1E182B]">
                                <div className="font-bold text-[13px] text-[#1E182B]">
                                  {item.product || item.description?.split('-')[0]?.trim()}
                                </div>
                                <div className="text-[11px] text-[#584E6B] leading-relaxed mt-0.5">
                                  {item.description}
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5">
                                {item.make ? (
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-[#6B46C1] border border-purple-200 inline-block">
                                    {item.make}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-[#8C82A0]">As per RFP specs</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9FD] border border-[#E2DEEC] text-[#4B3E60]">
                                  {item.category || 'General Scope'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-extrabold text-[#1E182B] text-sm font-mono">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3.5 text-[#6B5E82] font-semibold">
                                {item.unit || 'Nos'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-xl border border-dashed border-[#D1CCE0] bg-[#FAF9FD] space-y-3">
                    <FileSpreadsheet className="w-8 h-8 text-[#8C82A0] mx-auto" />
                    <div>
                      <h4 className="font-bold text-sm text-[#1E182B]">
                        Itemized BOQ Defined in Separate Tender Spreadsheet
                      </h4>
                      <p className="text-xs text-[#6B5E82] max-w-md mx-auto mt-1">
                        The buyer mentions an attached BOQ schedule (e.g. 1794571035.xlsx). Upload the Excel or CSV file to view full item-level quantities, approved makes, and specifications.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-[#6B46C1] hover:bg-[#5B36B1] text-white text-xs font-bold inline-flex items-center space-x-2 shadow-xs transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Upload BOQ Excel (.xlsx, .xls)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* THE 6 COMPREHENSIVE ELIGIBILITY PILLARS                    */}
          {/* ========================================================= */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#1E182B] flex items-center space-x-2">
                <Award className="w-5 h-5 text-[#6B46C1]" />
                <span>6 Comprehensive Eligibility Pillars</span>
              </h2>
              <span className="text-xs font-semibold text-[#8C82A0]">
                Strict Evaluation against Bidder Credentials
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* PILLAR 1: Corporate & Technical Certifications */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 text-[#6B46C1] flex items-center justify-center font-bold">
                      <Cpu className="w-4 h-4 text-[#6B46C1]" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      1. Corporate Certifications &amp; Standards
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-[#6B46C1] border-purple-200">
                    {certsPillar.total_certs_mandated || 0} Mandated
                  </span>
                </div>

                {/* ISO & CMMI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  {/* ISO 9001 */}
                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.iso_9001?.required ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B]'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">ISO 9001:2015</span>
                    <span className="text-[11px] font-bold mt-0.5 block">
                      {certsPillar.iso_9001?.required ? 'Mandatory' : 'Not Required'}
                    </span>
                  </div>

                  {/* ISO 27001 */}
                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.iso_27001?.required ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B]'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">ISO 27001:2022</span>
                    <span className="text-[11px] font-bold mt-0.5 block">
                      {certsPillar.iso_27001?.required ? 'Mandatory' : 'Not Required'}
                    </span>
                  </div>

                  {/* ISO 20000-1 */}
                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.iso_20000_1?.required ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B]'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">ISO 20000-1</span>
                    <span className="text-[11px] font-bold mt-0.5 block">
                      {certsPillar.iso_20000_1?.required ? 'Mandatory' : 'Not Required'}
                    </span>
                  </div>

                  {/* CMMI */}
                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.cmmi?.required ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold' : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B]'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">CMMI Level</span>
                    <span className="text-[11px] font-bold mt-0.5 block">
                      {certsPillar.cmmi?.required ? certsPillar.cmmi?.level || 'Level 3+' : 'Not Required'}
                    </span>
                  </div>
                </div>

                {/* STQC, ONVIF, CERT-In Triad */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.stqc?.badge === 'rose'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : certsPillar.stqc?.badge === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                  }`}>
                    <span className="block text-[10px] uppercase font-bold tracking-wider">STQC</span>
                    <span className="text-xs font-bold block mt-0.5">
                      {certsPillar.stqc?.label || 'None Required'}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.onvif?.badge === 'rose'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                  }`}>
                    <span className="block text-[10px] uppercase font-bold tracking-wider">ONVIF</span>
                    <span className="text-xs font-bold block mt-0.5">
                      {certsPillar.onvif?.label || 'None Required'}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${
                    certsPillar.cert_in?.badge === 'rose'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : certsPillar.cert_in?.badge === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                  }`}>
                    <span className="block text-[10px] uppercase font-bold tracking-wider">CERT-In</span>
                    <span className="text-xs font-bold block mt-0.5">
                      {certsPillar.cert_in?.label || 'None Required'}
                    </span>
                  </div>
                </div>

                {certsPillar.cmmi?.verification_url && certsPillar.cmmi?.required && (
                  <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200 text-[11px] text-[#4B3E60] flex items-center justify-between">
                    <span>Appraisal Directory Verification:</span>
                    <a
                      href={certsPillar.cmmi.verification_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#6B46C1] hover:underline inline-flex items-center space-x-1"
                    >
                      <span>CMMI Directory Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* PILLAR 2: Legal Constitution & Gumasta Applicability */}
              <div className={`p-5 sm:p-6 bg-white rounded-2xl border shadow-xs space-y-4 ${
                legalPillar.gumasta_mandate_scope === 'MUNICIPAL_ALL_BIDDERS'
                  ? 'border-rose-300 ring-2 ring-rose-100'
                  : 'border-[#E2DEEC]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                      <Scale className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      2. Legal Constitution &amp; Gumasta Applicability
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    legalPillar.gumasta_badge === 'rose'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {legalPillar.gumasta_title || 'Legal Criteria'}
                  </span>
                </div>

                {/* Prominent Gumasta Reassurance Banner */}
                <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  legalPillar.gumasta_mandate_scope === 'SOLE_PROPRIETORSHIP_ONLY'
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : legalPillar.gumasta_mandate_scope === 'MUNICIPAL_ALL_BIDDERS'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#1E182B]'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {legalPillar.pvt_ltd_eligible_without_gumasta ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>Gumasta Applicability:</span>
                    </span>
                    <span className={legalPillar.pvt_ltd_eligible_without_gumasta ? 'text-emerald-800' : 'text-rose-700'}>
                      {legalPillar.pvt_ltd_eligible_without_gumasta ? '✓ Not Required for Pvt Ltd / LLP' : '⚠️ Strict Municipal Mandate'}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed">
                    {legalPillar.gumasta_explanation}
                  </p>
                </div>

                {/* Constitution Details */}
                <div className="space-y-1.5 text-xs text-[#584E6B]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC]">
                    <span className="font-semibold text-[#1E182B]">Presence Requirement:</span>
                    <span>{legalPillar.presence_requirement || '> 5 Years in India (CA Cert with UDIN)'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC]">
                    <span className="font-semibold text-[#1E182B]">Consortium / JV Policy:</span>
                    <span className="font-bold text-[#6B46C1]">{legalPillar.consortium_status || 'Sole Prime Bidder Only'}</span>
                  </div>
                </div>
              </div>

              {/* PILLAR 3: Financial & Scale Criteria */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                      <IndianRupee className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      3. Financial &amp; Scale Criteria
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Turnover &amp; Net Worth
                  </span>
                </div>

                {/* Turnover Slabs */}
                <div className="space-y-2">
                  {(financePillar.turnover_slabs || []).map((slab, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#1E182B] block">{slab.tier} Annual IT Turnover:</span>
                        <span className="text-[11px] text-[#6B5E82]">{slab.description}</span>
                      </div>
                      <span className="font-extrabold text-[#6B46C1] text-sm shrink-0 ml-3">
                        {slab.annual_turnover}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Hardware Turnover Exclusion Rule */}
                {financePillar.hardware_turnover_excluded && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] font-semibold text-amber-900 flex items-start space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{financePillar.hardware_exclusion_rule}</span>
                  </div>
                )}

                {/* Net Worth & EMD Concession */}
                <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#1E182B]">
                    <span>Net Worth Mandate:</span>
                    <span className="text-emerald-700">Positive Net Worth Required</span>
                  </div>
                  <p className="text-[11px] text-[#584E6B]">
                    {financePillar.net_worth?.description}
                  </p>
                </div>
              </div>

              {/* PILLAR 4: Past Project Experience */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      4. Past Project Experience &amp; Capability
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                    Govt / PSU Experience
                  </span>
                </div>

                {/* Experience Slabs */}
                <div className="space-y-2">
                  {(expPillar.experience_slabs || []).map((slab, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#1E182B]">{slab.tier} Track Record:</span>
                        <span className="text-[#6B46C1]">{slab.requirement}</span>
                      </div>
                      <p className="text-[11px] text-[#6B5E82]">
                        {slab.scope_type} • <i>{slab.date_window}</i>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Eligible Clients & Formats */}
                <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-1">
                  <span className="font-semibold text-[#1E182B]">Eligible Clients &amp; Submission:</span>
                  <p className="text-[11px] text-[#584E6B] leading-relaxed">
                    {expPillar.eligible_clients} Max 10 projects listed in order of preference (Annexure-14 &amp; 15).
                  </p>
                </div>

                {/* Exclusions Notice */}
                <div className="text-[11px] text-[#6B5E82] bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                  <b>Excluded from Value:</b> Hardware supply, commercial license reseller sales, and data entry staff are strictly excluded from eligible IT project value.
                </div>
              </div>

              {/* PILLAR 5: Workforce & Payroll Headcount */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4 text-teal-600" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      5. Workforce &amp; Payroll Headcount
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    workforcePillar.manpower_mandated
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {workforcePillar.manpower_mandated ? 'Payroll Manpower' : 'Not Mandated / Equipment Scope'}
                  </span>
                </div>

                {workforcePillar.manpower_mandated ? (
                  <>
                    {/* Headcount Slabs */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(workforcePillar.headcount_slabs || []).map((slab, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-center">
                          <span className="text-[10px] uppercase font-bold text-[#8C82A0] block">{slab.tier}</span>
                          <span className="text-xs font-extrabold text-[#1E182B] block mt-0.5">{slab.headcount}</span>
                        </div>
                      ))}
                    </div>

                    {/* 70% MMR Fixed Remuneration Mandate */}
                    {workforcePillar.mmr_70_percent_rule?.mandated && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs space-y-1">
                        <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>70% Minimum Assured Fixed Monthly Remuneration (MMR)</span>
                        </div>
                        <p className="text-[11px] text-rose-950 leading-relaxed">
                          {workforcePillar.mmr_70_percent_rule.explanation}
                        </p>
                      </div>
                    )}

                    {/* Resource Qualifications */}
                    {workforcePillar.resource_qualifications?.length > 0 && (
                      <div className="space-y-1.5 text-xs">
                        <span className="font-semibold text-[#1E182B]">Prescribed Minimum Qualifications:</span>
                        {workforcePillar.resource_qualifications.map((q, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-[11px]">
                            <span className="font-bold text-[#6B46C1]">{q.code}:</span> {q.qualifications}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs space-y-2">
                    <div className="flex items-center space-x-1.5 font-bold text-[#15803D]">
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                      <span>No Dedicated Software Manpower Slabs Mandated</span>
                    </div>
                    <p className="text-[11px] text-[#14532D] leading-relaxed">
                      {workforcePillar.explanation ||
                        '✓ Scope is strictly focused on equipment supply, hardware deployment, and maintenance. No software developer headcount, monthly manpower rate (MMR) schedules, or role-specific qualification criteria are mandated.'}
                    </p>
                    <div className="pt-1 text-[11px] text-[#166534]">
                      Support Team: <b>Standard qualified technicians &amp; engineers on company payroll</b>
                    </div>
                  </div>
                )}
              </div>

              {/* PILLAR 6: Mandatory Submissions Overview Card */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#6B46C1] text-white flex items-center justify-center font-bold">
                      <FileCheck className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      6. Mandatory Bid Documents Checklist
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-[#6B46C1] border-purple-200">
                    {checklist.length} Documents
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-[#1E182B]">
                    <span>Submission Readiness:</span>
                    <span className="text-[#6B46C1]">{checkedCount} of {checklist.length} Verified</span>
                  </div>
                  <div className="w-full bg-[#E2DEEC] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#6B46C1] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${checklist.length > 0 ? (checkedCount / checklist.length) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#584E6B]">
                    Cover 1 (Technical &amp; Fee Submission) + Cover 2 (Item Rate BOQ in Excel template).
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-[#584E6B]">
                  <div className="p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] flex items-center justify-between">
                    <span className="font-semibold text-[#1E182B]">Power of Attorney (Annexure-4):</span>
                    <span>₹500 Non-Judicial Stamp Paper</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] flex items-center justify-between">
                    <span className="font-semibold text-[#1E182B]">RTPP Act Declaration (Annexure-7):</span>
                    <span>₹100 Non-Judicial Stamp Paper</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] flex items-center justify-between">
                    <span className="font-semibold text-[#1E182B]">Cover 2 Financial Bid:</span>
                    <span>Original BoQ1/BoQ2 Excel file</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================= */}
          {/* MANDATORY DOCUMENTS INTERACTIVE CHECKLIST                 */}
          {/* ========================================================= */}
          {checklist.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs overflow-hidden">
              <div
                className="p-4 sm:p-5 border-b border-[#E2DEEC] flex items-center justify-between cursor-pointer bg-[#FAF9FD]"
                onClick={() => setShowChecklist(!showChecklist)}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-2xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      Exhaustive Bid Submission Checklist ({checklist.length} Documents)
                    </h3>
                    <p className="text-[11px] text-[#6B5E82]">
                      Click checkboxes as documents are verified and attached to bid envelope.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-[#6B46C1] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                    {checkedCount} / {checklist.length} Completed
                  </span>
                  {showChecklist ? <ChevronUp className="w-4 h-4 text-[#8C82A0]" /> : <ChevronDown className="w-4 h-4 text-[#8C82A0]" />}
                </div>
              </div>

              {showChecklist && (
                <div className="divide-y divide-[#F0EDF6]">
                  {checklist.map((item, idx) => {
                    const isChecked = Boolean(checkedItems[item.item_no]);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleChecklist(item.item_no)}
                        className={`p-3.5 sm:p-4 flex items-start space-x-3 transition cursor-pointer ${
                          isChecked ? 'bg-[#F0FDF4]/50' : 'hover:bg-[#FAF9FD]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 w-4 h-4 rounded border-[#D8BFD8] text-[#6B46C1] focus:ring-[#6B46C1] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className={`text-xs font-bold ${isChecked ? 'line-through text-[#8C82A0]' : 'text-[#1E182B]'}`}>
                              #{item.item_no} — {item.document_name}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.requirement_type.includes('MANDATORY')
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {item.requirement_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#584E6B] mt-0.5">
                            {item.details}
                          </p>
                          {item.clause_reference && (
                            <span className="text-[10px] text-[#8C82A0] font-mono mt-0.5 block">
                              Ref: {item.clause_reference} • {item.cover || 'Cover 1'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


        </>
      )}

      {/* Upload Modal (with separate PDF & Excel dropzones) */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] max-w-2xl w-full p-6 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2.5">
                <UploadCloud className="w-5 h-5 text-[#6B46C1]" />
                <h3 className="font-bold text-base text-[#1E182B]">
                  Upload Tender Notice or BOQ Spreadsheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Upload Zones: PDF and Excel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PDF Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActivePdf(true); }}
                onDragLeave={() => setDragActivePdf(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActivePdf(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0], false);
                  }
                }}
                onClick={() => modalPdfInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                  dragActivePdf ? 'border-[#6B46C1] bg-[#FAF9FD]' : 'border-[#D8BFD8] hover:border-[#6B46C1] hover:bg-[#FAF9FD]/50'
                }`}
              >
                <input
                  ref={modalPdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0], false);
                    }
                  }}
                />
                <UploadCloud className="w-8 h-8 mx-auto text-[#6B46C1] mb-2" />
                <p className="font-bold text-xs sm:text-sm text-[#1E182B]">
                  Upload Tender PDF
                </p>
                <p className="text-[11px] text-[#8C82A0] mt-1">
                  NIT, RFP, Corrigendum, ATC
                </p>
              </div>

              {/* Excel Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActiveExcel(true); }}
                onDragLeave={() => setDragActiveExcel(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActiveExcel(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0], true);
                  }
                }}
                onClick={() => modalExcelInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                  dragActiveExcel ? 'border-emerald-500 bg-emerald-50/50' : 'border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/30'
                }`}
              >
                <input
                  ref={modalExcelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0], true);
                    }
                  }}
                />
                <FileSpreadsheet className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                <p className="font-bold text-xs sm:text-sm text-[#1E182B]">
                  Upload BOQ Excel
                </p>
                <p className="text-[11px] text-[#8C82A0] mt-1">
                  Item Rate BOQ (.xls, .xlsx, .csv)
                </p>
              </div>
            </div>

            {/* Direct Text Paste Option */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#4B3E60] flex items-center justify-between">
                <span>Or Paste Tender Document / Clause Text:</span>
                <span className="text-[10px] text-[#8C82A0] font-normal">Hindi &amp; English supported</span>
              </label>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste tender specifications, rules, clauses, or BOQ text here..."
                className="w-full p-3 rounded-xl border border-[#E2DEEC] text-xs focus:ring-1 focus:ring-[#6B46C1] focus:outline-none"
              />
              <button
                type="button"
                disabled={!pasteText.trim() || uploading}
                onClick={handlePasteAnalyze}
                className="w-full py-2.5 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer"
              >
                {uploading ? 'Analyzing...' : 'Analyze Pasted Text'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderAnalysisPage;