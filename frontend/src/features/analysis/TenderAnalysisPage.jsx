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
  ChevronUp
} from 'lucide-react';

export const TenderAnalysisPage = () => {
  const { selectedTender, setCurrentTab, showNotification, isSuperAdmin, user } = useApp();

  const [tender, setTender] = useState(selectedTender || null);
  const [analysis, setAnalysis] = useState(selectedTender?.deep_analysis || null);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boqSearch, setBoqSearch] = useState('');
  const [showBoqTable, setShowBoqTable] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

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
      showNotification('Could not load cached analysis. Click Re-Analyze to generate.', 'info');
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

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (tender?.id || tender?.tender_id) {
        const targetId = tender.id || tender.tender_id;
        const res = await tenderApi.uploadDocumentAndAnalyze(targetId, formData);
        setAnalysis(res.data);
        showNotification(`File "${file.name}" uploaded and analyzed successfully!`, 'success');
      } else {
        // Ad-hoc analysis without tender
        const res = await tenderApi.analyzeAdHoc(formData);
        setAnalysis(res.data);
        showNotification(`File "${file.name}" analyzed successfully!`, 'success');
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
  const stats = analysis?.core_stats || {};
  const checklist = analysis?.mandatory_documents_checklist || [];
  const boqList = analysis?.boq_items || [];

  const filteredBoq = boqList.filter((item) => {
    if (!boqSearch.trim()) return true;
    const q = boqSearch.toLowerCase();
    return (
      (item.description || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.item_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-200">
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
            <span className="text-xs text-[#8C82A0] font-medium">Deep Eligibility &amp; Scope Evaluation</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#553C9A] to-[#805AD5] text-white flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1E182B] tracking-tight">
                {tender?.title || stats.title || 'Tender Eligibility & Scope Deep Analysis Report'}
              </h1>
              <p className="text-xs text-[#6B5E82] flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="font-semibold text-[#1E182B]">ID: {tender?.tender_id || stats.tender_id || 'N/A'}</span>
                <span>•</span>
                <span>{tender?.organisation || stats.organisation || 'Govt Department / PSU'}</span>
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

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] text-[#6B46C1] font-semibold text-xs inline-flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            title="Upload an updated tender PDF, Corrigendum, or BOQ file"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#6B46C1]" />
            <span>Upload Document / BOQ</span>
          </button>

          <button
            type="button"
            disabled={reanalyzing || loading}
            onClick={handleForceReanalyze}
            className="px-3.5 py-2 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs inline-flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
            title="Re-run deep analysis on document"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
            <span>{reanalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] text-[#6B5E82] hover:text-[#1E182B] transition cursor-pointer"
            title="Print or Save PDF report"
          >
            <Printer className="w-4 h-4" />
          </button>

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
          <p className="text-xs text-[#8C82A0] mt-1">Evaluating MSME relaxations, STQC/ONVIF certifications, local office mandates, and BOQ.</p>
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
                    Fit Score: <b>{verdict.score || 70}%</b>
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
                  Capability Match
                </div>
              </div>
            </div>
          </div>

          {/* Core Stats Overview Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold">Estimated Value</span>
              <p className="text-sm font-bold text-[#1E182B] truncate">{stats.estimated_value || 'Not Disclosed'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold">EMD Amount</span>
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
              <span className="text-[11px] text-[#8C82A0] font-semibold">Tender Fee</span>
              <p className="text-sm font-bold text-[#1E182B] truncate">{stats.tender_fee || 'Nil'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold">Bid Due Date</span>
              <p className="text-xs sm:text-sm font-bold text-rose-600 truncate">{stats.due_date || 'Check Portal'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DEEC] shadow-2xs space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-[#8C82A0] font-semibold">Bid Opening Date</span>
              <p className="text-xs sm:text-sm font-bold text-[#1E182B] truncate">{stats.opening_date || 'Check Portal'}</p>
            </div>
          </div>

          {/* The 4 Golden Pillars of Eligibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pillar 1: MSME / Udyam Relaxation */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                    1. MSME / Udyam Relaxation
                  </h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  criteria.msme_relaxation?.badge === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : criteria.msme_relaxation?.badge === 'rose'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {criteria.msme_relaxation?.title || 'MSME Rules'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#6B5E82]">EMD Exemption:</span>
                    <span className={criteria.msme_relaxation?.emd_exempt ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                      {criteria.msme_relaxation?.emd_exempt ? '✓ Granted to Eligible MSEs' : '✕ No Exemption (Payable)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#584E6B] leading-relaxed">
                    {criteria.msme_relaxation?.summary}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#6B5E82]">Tender Fee:</span>
                    <span className="text-[#1E182B] font-bold">
                      {criteria.msme_relaxation?.fee_exempt ? 'Exempt' : 'Mandatory Payment'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#584E6B]">
                    {criteria.msme_relaxation?.fee_clause}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#6B5E82]">Turnover &amp; Experience Relaxation:</span>
                    <span className={criteria.msme_relaxation?.turnover_exempt ? 'text-emerald-700' : 'text-amber-700 font-bold'}>
                      {criteria.msme_relaxation?.turnover_exempt ? 'Exemption Applicable' : 'Check Mandatory Threshold'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#584E6B]">
                    {criteria.msme_relaxation?.turnover_detail}
                  </p>
                </div>
              </div>
            </div>

            {/* Pillar 2: Software Scope & Certifications */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 text-[#6B46C1] flex items-center justify-center font-bold">
                    <Cpu className="w-4 h-4 text-[#6B46C1]" />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                    2. Software Scope &amp; Certifications
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-[#6B46C1] border-purple-200">
                  {criteria.software_certifications?.software_type || 'Software / IT'}
                </span>
              </div>

              {/* Certifications Triad: STQC, ONVIF, CERT-In */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2.5 rounded-xl border text-center ${
                  criteria.software_certifications?.stqc?.required
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                }`}>
                  <span className="block text-[10px] uppercase font-bold tracking-wider">STQC</span>
                  <span className="text-xs font-bold block mt-0.5">
                    {criteria.software_certifications?.stqc?.required ? 'Mandatory' : 'None Required'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border text-center ${
                  criteria.software_certifications?.onvif?.required
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                }`}>
                  <span className="block text-[10px] uppercase font-bold tracking-wider">ONVIF</span>
                  <span className="text-xs font-bold block mt-0.5">
                    {criteria.software_certifications?.onvif?.required ? 'Mandatory' : 'None Required'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border text-center ${
                  criteria.software_certifications?.cert_in?.required
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
                }`}>
                  <span className="block text-[10px] uppercase font-bold tracking-wider">CERT-In</span>
                  <span className="text-xs font-bold block mt-0.5">
                    {criteria.software_certifications?.cert_in?.required ? 'Mandatory' : 'None Required'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-1">
                <span className="font-semibold text-[#1E182B]">Software Scope Description:</span>
                <p className="text-[11px] text-[#584E6B] leading-relaxed">
                  {criteria.software_certifications?.scope_description || 'Standard technical specifications apply.'}
                </p>
              </div>
            </div>

            {/* Pillar 3: Local Office & Jurisdiction */}
            <div className={`p-5 sm:p-6 bg-white rounded-2xl border shadow-xs space-y-4 ${
              criteria.local_office?.is_local_mandatory ? 'border-rose-300 ring-2 ring-rose-100' : 'border-[#E2DEEC]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    criteria.local_office?.is_local_mandatory
                      ? 'bg-rose-50 border border-rose-200 text-rose-600'
                      : 'bg-blue-50 border border-blue-200 text-blue-600'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                    3. Local Office &amp; Registration Mandate
                  </h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  criteria.local_office?.is_local_mandatory
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {criteria.local_office?.is_local_mandatory ? 'Strict Local Office' : 'Pan-India Open'}
                </span>
              </div>

              <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                criteria.local_office?.is_local_mandatory ? 'bg-rose-50/60 border-rose-200' : 'bg-[#FAF9FD] border-[#E2DEEC]'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[#1E182B]">Designated Jurisdiction:</span>
                  <span className={criteria.local_office?.is_local_mandatory ? 'text-rose-700' : 'text-[#6B46C1]'}>
                    {criteria.local_office?.jurisdiction || 'Open Pan-India'}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-[#4B3E60]">
                  {criteria.local_office?.impact}
                </p>

                {criteria.local_office?.gumasta_required && (
                  <div className="pt-1.5 border-t border-rose-200/60 flex items-center gap-1.5 text-[11px] font-semibold text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Valid Gumasta / Shop &amp; Establishment license required with technical bid.</span>
                  </div>
                )}
              </div>

              {criteria.local_office?.clause && (
                <div className="text-[11px] text-[#6B5E82] italic bg-[#FAF9FD] p-2.5 rounded-lg border border-[#E2DEEC]">
                  <b>NIT Citation:</b> {criteria.local_office.clause}
                </div>
              )}
            </div>

            {/* Pillar 4: Hardware Scope & BOQ */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-[#E2DEEC] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                    <Boxes className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                    4. Hardware Scope &amp; Bill of Materials
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  {criteria.hardware_scope?.hardware_mandatory ? 'Hardware Mandatory' : 'Services Only'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[#1E182B]">Total Bill of Quantities Items:</span>
                  <span className="text-[#6B46C1] font-bold">
                    {analysis.total_boq_count || boqList.length} Items Detected
                  </span>
                </div>
                <p className="text-[11px] text-[#584E6B] leading-relaxed">
                  {criteria.hardware_scope?.summary}
                </p>
              </div>

              {/* Hardware Categories Badges */}
              {criteria.hardware_scope?.categories && criteria.hardware_scope.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {criteria.hardware_scope.categories.map((cat, idx) => (
                    <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E2DEEC] text-[#584E6B]">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mandatory Documents Checklist */}
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
                      Mandatory Bid Submission Checklist ({checklist.length} Documents)
                    </h3>
                    <p className="text-[11px] text-[#6B5E82]">
                      Interactive checklist with required stamp paper values, CA certificates &amp; affidavits.
                    </p>
                  </div>
                </div>

                <button type="button" className="text-[#8C82A0] hover:text-[#1E182B] p-1">
                  {showChecklist ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {showChecklist && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9FD] text-[#4B3E60] uppercase text-[10px] tracking-wider border-b border-[#E2DEEC]">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Status</th>
                        <th className="py-3 px-4 w-16">Item</th>
                        <th className="py-3 px-4">Document / Proof Name</th>
                        <th className="py-3 px-4">Requirement Level</th>
                        <th className="py-3 px-4">Clause Reference</th>
                        <th className="py-3 px-4">Format / Stamp Denomination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EDF6]">
                      {checklist.map((item) => {
                        const isDone = !!checkedItems[item.item_no];
                        return (
                          <tr
                            key={item.item_no}
                            onClick={() => toggleChecklist(item.item_no)}
                            className={`hover:bg-[#FAF9FD] transition cursor-pointer ${isDone ? 'bg-[#F0FDF4]/50' : ''}`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => toggleChecklist(item.item_no)}
                                className="w-4 h-4 text-[#6B46C1] rounded border-[#D8BFD8] focus:ring-[#6B46C1] cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#8C82A0]">
                              {item.item_no}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#1E182B]">
                              <span className={isDone ? 'line-through text-[#8C82A0]' : ''}>
                                {item.document_name}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                item.requirement_type.includes('MANDATORY')
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {item.requirement_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#6B5E82] font-medium">
                              {item.clause_reference}
                            </td>
                            <td className="py-3 px-4 text-[#584E6B]">
                              {item.details}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Bill of Quantities (BOQ) Items Table */}
          {boqList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs overflow-hidden">
              <div
                className="p-4 sm:p-5 border-b border-[#E2DEEC] flex items-center justify-between cursor-pointer bg-[#FAF9FD]"
                onClick={() => setShowBoqTable(!showBoqTable)}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1E182B]">
                      Hardware Bill of Quantities (BOQ) — {boqList.length} Items Extracted
                    </h3>
                    <p className="text-[11px] text-[#6B5E82]">
                      Item-wise schedule for CCTV cameras, NVRs, PoE switches, racks, and network cabling.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button type="button" className="text-[#8C82A0] hover:text-[#1E182B] p-1">
                    {showBoqTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {showBoqTable && (
                <div className="p-4 space-y-3">
                  {/* Search BOQ */}
                  <div className="relative max-w-sm">
                    <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={boqSearch}
                      onChange={(e) => setBoqSearch(e.target.value)}
                      placeholder="Filter items by camera, switch, rack, etc..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E2DEEC] text-xs focus:ring-1 focus:ring-[#6B46C1] focus:outline-none"
                    />
                  </div>

                  <div className="overflow-x-auto border border-[#E2DEEC] rounded-xl max-h-96">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF9FD] text-[#4B3E60] uppercase text-[10px] tracking-wider border-b border-[#E2DEEC] sticky top-0 bg-white">
                        <tr>
                          <th className="py-2.5 px-3.5 w-16">Item #</th>
                          <th className="py-2.5 px-3.5">Description</th>
                          <th className="py-2.5 px-3.5 w-40">Category</th>
                          <th className="py-2.5 px-3.5 w-24 text-right">Qty</th>
                          <th className="py-2.5 px-3.5 w-24">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EDF6]">
                        {filteredBoq.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF9FD] transition">
                            <td className="py-2.5 px-3.5 font-mono text-[#8C82A0] font-semibold">
                              {item.item_no}
                            </td>
                            <td className="py-2.5 px-3.5 font-semibold text-[#1E182B]">
                              {item.description}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9FD] border border-[#E2DEEC] text-[#6B46C1]">
                                {item.category || 'Hardware'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-bold text-[#1E182B]">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#6B5E82]">
                              {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Upload & Ad-Hoc Analysis Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2.5">
                <UploadCloud className="w-5 h-5 text-[#6B46C1]" />
                <h3 className="font-bold text-base text-[#1E182B]">
                  Upload Tender Document or BOQ
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

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                dragActive ? 'border-[#6B46C1] bg-[#FAF9FD]' : 'border-[#D8BFD8] hover:border-[#6B46C1] hover:bg-[#FAF9FD]/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-10 h-10 mx-auto text-[#6B46C1] mb-2" />
              <p className="font-bold text-sm text-[#1E182B]">
                {uploading ? 'Processing & Extracting...' : 'Drop your Tender PDF, BOQ CSV, or Excel file here'}
              </p>
              <p className="text-xs text-[#8C82A0] mt-1">
                Supports PDF (Hindi &amp; English), BOQ CSV/Excel, and text files up to 25MB.
              </p>
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
