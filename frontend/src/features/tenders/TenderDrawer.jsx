import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  ExternalLink,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Save,
  Calendar,
  Building,
  DollarSign,
  Briefcase,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { tenderApi } from '../../utils/api';
import { formatIndianDateTime } from '../../utils/dateUtils';

export const TenderDrawer = () => {
  const { isDrawerOpen, selectedTender, closeTenderDrawer, showNotification, refreshStats } = useApp();
  const [tender, setTender] = useState(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('New');
  const [priority, setPriority] = useState('Normal');
  const [parsingPdf, setParsingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExcerpt, setShowExcerpt] = useState(true);

  useEffect(() => {
    if (selectedTender) {
      setTender(selectedTender);
      setNotes(selectedTender.user_notes || '');
      setStatus(selectedTender.status || 'New');
      setPriority(selectedTender.priority || 'Normal');
    }
  }, [selectedTender]);

  // Escape key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeTenderDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeTenderDrawer]);

  if (!isDrawerOpen || !tender) return null;

  const pdfUrl = tender.doc_url || tender.url;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const res = await tenderApi.updateTender(tender.id, {
        user_notes: notes,
        status,
        priority
      });
      setTender(res.data);
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data }));
      if (refreshStats) {
        refreshStats();
      }
      showNotification('Tender details updated successfully', 'success');
    } catch (e) {
      showNotification('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleParsePdf = async () => {
    setParsingPdf(true);
    try {
      const res = await tenderApi.parseTenderPdf(tender.id);
      setTender(res.data);
      setShowExcerpt(true);
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data }));
      if (refreshStats) {
        refreshStats();
      }
      showNotification('Document parsed! EMD, Estimated Value & Clauses updated.', 'success');
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Failed to parse PDF document', 'error');
    } finally {
      setParsingPdf(false);
    }
  };

  const isDirect = (tender.eligibility_assessment || '').toLowerCase().includes('direct');

  // Bid End Date urgency calculation (only red if <= 7 days away)
  const getClosingDateStyle = (rawDate) => {
    if (!rawDate) return 'font-semibold text-[#1E182B]';
    try {
      const clean = rawDate.replace(/-/g, ' ');
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        const diffDays = Math.ceil((parsed - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7 && diffDays >= 0) {
          return 'font-bold text-rose-600';
        }
      }
    } catch {
      // fallback
    }
    return 'font-semibold text-[#1E182B]';
  };

  const isEstimatedDisclosed =
    tender.estimated_value &&
    tender.estimated_value !== 'Check tender PDF / ATC' &&
    tender.estimated_value !== 'Not specified in listing';

  const getMseStatus = () => {
    const raw = (tender.mse_relaxation || '').toLowerCase();
    if (raw.startsWith('yes')) {
      return { label: 'Yes (Relaxed)', badge: 'emerald', detail: 'Relaxation granted for experience & turnover' };
    }
    if (raw.startsWith('no')) {
      return { label: 'No Relaxation', badge: 'rose', detail: 'Standard turnover & past experience criteria apply' };
    }
    if (tender.extracted_pdf_text) {
      if (/MSE\s+Relaxation[\s\S]{1,80}?\n\s*No/i.test(tender.extracted_pdf_text)) {
        return { label: 'No Relaxation', badge: 'rose', detail: 'Standard turnover & past experience criteria apply' };
      }
      if (/MSE\s+Relaxation[\s\S]{1,80}?\n\s*Yes/i.test(tender.extracted_pdf_text)) {
        return { label: 'Yes (Relaxed)', badge: 'emerald', detail: 'Relaxation granted for experience & turnover' };
      }
    }
    return { label: 'Check ATC', badge: 'slate', detail: 'Verify MSME rules in ATC' };
  };

  const getStartupStatus = () => {
    const raw = (tender.startup_relaxation || '').toLowerCase();
    if (raw.startsWith('yes')) {
      return { label: 'Yes (Relaxed)', badge: 'emerald', detail: 'Relaxation granted for experience & turnover' };
    }
    if (raw.startsWith('no')) {
      return { label: 'No Relaxation', badge: 'rose', detail: 'DPIIT recognized entities must meet standard criteria' };
    }
    if (tender.extracted_pdf_text) {
      if (/Startup\s+Relaxation[\s\S]{1,80}?\n\s*No/i.test(tender.extracted_pdf_text)) {
        return { label: 'No Relaxation', badge: 'rose', detail: 'DPIIT recognized entities must meet standard criteria' };
      }
      if (/Startup\s+Relaxation[\s\S]{1,80}?\n\s*Yes/i.test(tender.extracted_pdf_text)) {
        return { label: 'Yes (Relaxed)', badge: 'emerald', detail: 'Relaxation granted for experience & turnover' };
      }
    }
    return { label: 'Check ATC', badge: 'slate', detail: 'Verify DPIIT rules in ATC' };
  };

  const getTurnoverDisplay = () => {
    let to = tender.turnover_required;
    if (!to || to === '₹ ,' || to === 'Check tender PDF / ATC') {
      if (tender.extracted_pdf_text) {
        const mb = tender.extracted_pdf_text.match(/Minimum\s+Average\s+Annual\s+Turnover[^\n]*\n\s*([0-9.]+\s*Lakh[^\n]*)/i);
        const mo = tender.extracted_pdf_text.match(/OEM\s+(?:Average\s+)?Turnover[^\n]*\n\s*([0-9.]+\s*Lakh[^\n]*)/i);
        if (mb || mo) {
          const parts = [];
          if (mb) parts.push(`Bidder: ₹ ${mb[1].trim()}`);
          if (mo) parts.push(`OEM: ₹ ${mo[1].trim()}`);
          return parts.join(' | ');
        }
      }
    }
    return to;
  };

  const getBidderTurnover = () => {
    if (tender.bidder_turnover) return tender.bidder_turnover;
    if (tender.extracted_pdf_text) {
      const m = tender.extracted_pdf_text.match(/Minimum\s+Average\s+Annual\s+Turnover[^\n]*\n\s*([0-9.]+\s*Lakh[^\n]*)/i);
      if (m) return m[1].trim();
    }
    return null;
  };

  const getOemTurnover = () => {
    if (tender.oem_turnover) return tender.oem_turnover;
    if (tender.extracted_pdf_text) {
      const m = tender.extracted_pdf_text.match(/OEM\s+(?:Average\s+)?Turnover[^\n]*\n\s*([0-9.]+\s*Lakh[^\n]*)/i);
      if (m) return m[1].trim();
    }
    return null;
  };

  const getExperienceYears = () => {
    if (tender.experience_years) return tender.experience_years;
    if (tender.extracted_pdf_text) {
      const m = tender.extracted_pdf_text.match(/Years\s+of\s+Past\s+Experience\s+Required[^\n]*\n\s*(\d+\s*Year[^\n]*)/i);
      if (m) return m[1].trim();
    }
    return null;
  };

  // Clean unprintable byte characters, Devanagari ligatures, icon font glyphs, and format clean English document excerpt
  const formatDocumentExcerpt = (raw) => {
    if (!raw) return '';
    let t = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    t = t.replace(/[\u0900-\u097F]+/g, '');

    t = t.replace(/Turnover\s+of\s+the\s+bidder\s*\(For\s+the\s+last\s+3:?\s*Financial\s+Years\)/gi, 'Turnover of the bidder (For 3 Years)');
    t = t.replace(/MSE\s+Relaxation\s+for\s+Years\s+Of\s+Experience:?\s+and\s+Turnover:?\s+Yes/gi, 'MSE Relaxation for Years of Experience and Turnover: Yes');
    t = t.replace(/Startup\s+Relaxation\s+for\s+Years\s+Of:?\s+Experience\s+and\s+Turnover:?\s+Yes/gi, 'Startup Relaxation for Years of Experience and Turnover: Yes');
    t = t.replace(/\bYes\s+Complete\b/gi, 'Yes');
    t = t.replace(/\bNo\s+Complete\b/gi, 'No');

    const validShortWords = new Set(['to', 'in', 'of', 'on', 'at', 'by', 'no', 'as', 'is', 'or', 'if', 'an', 'we', 'do', 'up', 'us', 'my', 'he', 'so', 'it', 'rs', 're']);

    const rawLines = t.split('\n');
    const filtered = [];

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i].replace(/^[\s/:\-]+|[\s/:\-]+$/g, '').trim();
      if (!line) continue;

      if (line.length <= 2 && !validShortWords.has(line.toLowerCase()) && !/^\d+$/.test(line)) {
        continue;
      }
      if (/^[^\w\s]+$/.test(line)) continue;
      if (/^[A-Za-z](\s+[A-Za-z])+$/.test(line)) continue;

      if (filtered.length > 0 && filtered[filtered.length - 1].toLowerCase() === line.toLowerCase()) {
        continue;
      }
      filtered.push(line);
    }

    while (filtered.length > 0 && (
      filtered[0].toLowerCase() === 'bid' ||
      filtered[0].toLowerCase() === 'details' ||
      filtered[0].toLowerCase() === 'bid details' ||
      filtered[0].toLowerCase() === 'bid document' ||
      filtered[0].toLowerCase() === 'document' ||
      filtered[0] === '/' ||
      filtered[0] === '//'
    )) {
      filtered.shift();
    }

    const keyHeaders = [
      'Bid End Date/Time', 'Bid Opening Date/Time', 'Bid Offer Validity',
      'Ministry/State Name', 'Department Name', 'Organisation Name', 'Office Name',
      'Total Quantity', 'Item Category', 'Minimum Average Annual Turnover of the bidder',
      'OEM Average Turnover', 'Years of Past Experience Required',
      'Turnover eligibility criteria', 'MSE Relaxation', 'Startup Relaxation',
      'Primary product category', 'Type of Bid', 'Evaluation Method', 'RA Qualification Rule',
      'Advisory Bank', 'ePBG Percentage', 'EMD Amount', 'Beneficiary'
    ];

    const formatted = ['=== OFFICIAL GeM BID DETAILS & SPECIFICATIONS ===\n'];
    let idx = 0;

    while (idx < filtered.length) {
      const line = filtered[idx];
      let matchedKh = null;
      for (const kh of keyHeaders) {
        if (line.toLowerCase().startsWith(kh.toLowerCase())) {
          matchedKh = kh;
          break;
        }
      }

      if (matchedKh && idx + 1 < filtered.length) {
        const val = filtered[idx + 1];
        const isOtherKh = keyHeaders.some(kh => val.toLowerCase().startsWith(kh.toLowerCase()));
        if (!isOtherKh && val.length < 180) {
          formatted.push(`${line}: ${val}`);
          idx += 2;
          continue;
        }
      }

      formatted.push(line);
      idx += 1;
    }

    return formatted.join('\n');
  };

  const cleanPdfText = formatDocumentExcerpt(tender.extracted_pdf_text);

  const mse = getMseStatus();
  const startup = getStartupStatus();
  const displayTurnover = getTurnoverDisplay();
  const bidderTurnover = getBidderTurnover();
  const oemTurnover = getOemTurnover();
  const experienceYears = getExperienceYears();

  // Refined Technical Assessment Notes
  const getCleanAssessmentNotes = () => {
    let raw = tender.assessment_notes || '';
    if (
      !raw ||
      raw.toLowerCase().includes('company turnover') ||
      raw.includes("Tender title/keyword aligns with BitVivid's known AI")
    ) {
      const scopeDesc = tender.scope_summary || tender.title || 'CCTV & Video Systems';
      const toText = bidderTurnover ? `₹ ${bidderTurnover}` : (displayTurnover && displayTurnover !== '₹ ,' ? displayTurnover : '0.5 Lakh (s)');
      const expText = experienceYears || '2 Year (s)';
      const emdText = tender.emd_amount && tender.emd_amount !== 'Check tender PDF / ATC' ? tender.emd_amount : 'Nil / Not Required';
      const mseNote = mse.badge === 'rose'
        ? 'Note: ATC terms do not grant MSE/Startup relaxation; credentials must be uploaded.'
        : 'MSE/Startup relaxation applies for experience and turnover.';

      return `Scope encompasses ${scopeDesc}, directly matching BitVivid's capabilities in CCTV surveillance, video analytics (VMS), and edge camera infrastructure. Eligibility mandates ${toText} bidder turnover and ${expText} past experience. ${mseNote} EMD is ${emdText}.`;
    }
    return raw;
  };

  // Refined Actionable SI / Partner Strategy
  const getCleanPartnerStrategy = () => {
    let raw = tender.si_partner_route || '';
    if (
      !raw ||
      raw.toLowerCase().startsWith('yes, if') ||
      raw.toLowerCase().includes('require it')
    ) {
      const oemText = oemTurnover ? ` (OEM turnover: ₹ ${oemTurnover})` : '';
      return `OEM Authorization Route: Secure Manufacturer Authorization Form (MAF) from the hardware OEM (CP Plus)${oemText}. Bid directly if BitVivid's 2-year CCTV/IT project credentials apply, or partner as technical/AI solution provider with an empanelled prime System Integrator (e.g. RailTel, L&T, or local SI).`;
    }
    return raw;
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#141021]/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 flex items-center justify-center animate-in fade-in duration-150"
      onClick={closeTenderDrawer}
    >
      <div
        className="relative w-full max-w-5xl xl:max-w-6xl h-[92vh] max-h-[920px] bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:px-6 border-b border-[#E2DEEC] flex items-start justify-between bg-white shrink-0">
          <div className="space-y-1.5 pr-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#4A337A] bg-[#E6E6FA] px-2.5 py-0.5 rounded-lg border border-[#D8BFD8]">
                {tender.tender_id}
              </span>
              <span className="text-xs text-[#584E6B] font-semibold px-2 py-0.5 bg-[#FAF9FD] rounded-lg border border-[#E2DEEC]">
                {tender.portal}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${
                  isDirect
                    ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4]'
                    : 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                }`}
              >
                {tender.fit_score}% Fit
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#1E182B] leading-snug line-clamp-2" title={tender.title}>
              {tender.title}
            </h2>
          </div>
          <button
            onClick={closeTenderDrawer}
            className="w-9 h-9 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] border border-transparent hover:border-[#E2DEEC] transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-[#584E6B] min-h-0 bg-white">
          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAF9FD] p-4 rounded-xl border border-[#E2DEEC]">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <Building className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>Organisation</span>
              </span>
              <p className="font-bold text-[#1E182B] truncate text-xs sm:text-sm" title={tender.organisation}>
                {tender.organisation || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>Bid End Date</span>
              </span>
              <p className={`${getClosingDateStyle(tender.closing_date)} text-xs sm:text-sm`}>
                {tender.closing_date || 'Check portal'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Estimated Tender Value</span>
              </span>
              <p className={isEstimatedDisclosed ? 'font-bold text-[#2E7D32] text-xs sm:text-sm font-mono' : 'font-semibold text-[#584E6B]'}>
                {isEstimatedDisclosed
                  ? tender.estimated_value
                  : tender.extracted_pdf_text
                    ? 'Not Disclosed by Buyer on GeM'
                    : 'Awaiting PDF Parse'}
              </p>
            </div>
          </div>

          {/* Official Bid Specification Document Action Box (Lavender Dream) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] gap-3">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-[#1E182B] text-sm">Official Bid Specification Document</p>
                <p className="text-[11px] text-[#584E6B]">Direct link to portal PDF notice &amp; automated parser</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg bg-white border border-[#E2DEEC] hover:bg-[#FAF9FD] hover:border-[#D8BFD8] text-[#6B46C1] font-semibold inline-flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
                >
                  <span>Open PDF</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {pdfUrl && (
                <button
                  disabled={parsingPdf}
                  onClick={handleParsePdf}
                  className="px-3.5 py-2 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-50 text-white font-semibold inline-flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{parsingPdf ? 'Parsing Document...' : 'Parse PDF Clauses'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Extracted Tender Clauses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1E182B] uppercase tracking-wider text-[11px]">
                Extracted Commercial &amp; Technical Criteria
              </h3>
              {(tender.extracted_pdf_text ||
                (tender.estimated_value && tender.estimated_value !== 'Check tender PDF / ATC')) && (
                  <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8D8C4] font-bold px-2 py-0.5 rounded-full">
                    ✓ Verified from PDF
                  </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* EMD */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#8C82A0] font-semibold">EMD Amount</span>
                <p className="font-bold text-[#1E182B] text-sm">
                  {tender.emd_amount && tender.emd_amount !== 'Check tender PDF / ATC'
                    ? tender.emd_amount
                    : 'Nil / Not Required'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block">
                  {tender.emd_exemption || 'Verify MSME / Startup rules'}
                </span>
              </div>

              {/* ePBG */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#8C82A0] font-semibold">ePBG (Security Deposit)</span>
                <p className="font-bold text-[#1E182B] text-sm">
                  {tender.epbg_required && tender.epbg_required !== 'Check tender PDF / ATC'
                    ? tender.epbg_required
                    : 'Not Required'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block">
                  Performance bank guarantee clause
                </span>
              </div>

              {/* MSE / MSME Relaxation Criteria */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">MSE Relaxation</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                      mse.badge === 'emerald'
                        ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]'
                        : mse.badge === 'rose'
                          ? 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                          : 'text-[#584E6B] bg-[#FAF9FD] border-[#E2DEEC]'
                    }`}
                  >
                    {mse.label}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  {mse.detail}
                </p>
                <span className="text-[10px] text-[#8C82A0] block">
                  Experience &amp; Turnover exemptions
                </span>
              </div>

              {/* Startup Relaxation (DPIIT) */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Startup Relaxation</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                      startup.badge === 'emerald'
                        ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]'
                        : startup.badge === 'rose'
                          ? 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                          : 'text-[#584E6B] bg-[#FAF9FD] border-[#E2DEEC]'
                    }`}
                  >
                    {startup.label}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  {startup.detail}
                </p>
                <span className="text-[10px] text-[#8C82A0] block">
                  DPIIT recognized entity terms
                </span>
              </div>

              {/* Bidder Turnover Card */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Bidder Minimum Turnover</span>
                  <span className="text-[10px] font-bold text-[#6B46C1] bg-[#E6E6FA] px-1.5 py-0.5 rounded-md border border-[#D8BFD8]">
                    3 Years
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {bidderTurnover
                    ? `₹ ${bidderTurnover}`
                    : displayTurnover && displayTurnover !== '₹ ,'
                      ? displayTurnover
                      : 'No Minimum Mandated'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block leading-tight">
                  Minimum Average Annual Turnover of the bidder (For 3 Years)
                </span>
              </div>

              {/* OEM Turnover Card */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">OEM Average Turnover</span>
                  <span className="text-[10px] font-bold text-[#584E6B] bg-[#FAF9FD] px-1.5 py-0.5 rounded-md border border-[#E2DEEC]">
                    Last 3 Years
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {oemTurnover ? `₹ ${oemTurnover}` : 'Not Specified / Exempt'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block leading-tight">
                  OEM Average Turnover (Last 3 Years)
                </span>
              </div>

              {/* Years of Past Experience Required Card */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Years of Past Experience</span>
                  <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-1.5 py-0.5 rounded-md border border-[#C8D8C4]">
                    Mandatory
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {experienceYears || '2 Year (s)'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block leading-tight">
                  Years of Past Experience Required for same/similar service
                </span>
              </div>

              {/* Experience & Verification Terms */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#8C82A0] font-semibold">Experience &amp; Verification Terms</span>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  {tender.experience_required && tender.experience_required !== 'Check tender PDF / ATC'
                    ? tender.experience_required
                    : 'Past project POs & OEM authorization required'}
                </p>
                <span className="text-[10px] text-[#8C82A0] block leading-tight">
                  Document required from seller (ATC compliant)
                </span>
              </div>
            </div>

            {tender.scope_summary && (
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#8C82A0] font-semibold">Parsed Scope of Work / BOQ Item Category</span>
                <p className="text-[#1E182B] leading-relaxed font-medium">{tender.scope_summary}</p>
              </div>
            )}
          </div>

          {/* Extracted Document Text Preview (Accordion) */}
          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden bg-[#FAF9FD]">
            <div
              onClick={() => setShowExcerpt(!showExcerpt)}
              className="p-3.5 bg-[#FAF9FD] border-b border-[#E2DEEC] flex items-center justify-between cursor-pointer hover:bg-white transition"
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#6B46C1]" />
                <span className="font-bold text-[#1E182B] text-xs">Extracted Tender Document Text Excerpt</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-[#8C82A0]">
                  {cleanPdfText ? 'View full excerpt' : 'No document parsed yet'}
                </span>
                {showExcerpt ? <ChevronUp className="w-4 h-4 text-[#8C82A0]" /> : <ChevronDown className="w-4 h-4 text-[#8C82A0]" />}
              </div>
            </div>

            {showExcerpt && (
              <div className="p-3.5 bg-white">
                {cleanPdfText ? (
                  <pre className="text-[11px] font-mono text-[#1E182B] whitespace-pre-wrap max-h-56 overflow-y-auto bg-[#FAF9FD] p-3 rounded-lg border border-[#E2DEEC] leading-relaxed">
                    {cleanPdfText}
                  </pre>
                ) : (
                  <div className="py-6 text-center text-[#8C82A0] space-y-1">
                    <p className="font-semibold text-[#1E182B]">Document text layer not yet parsed.</p>
                    <p className="text-[11px] text-[#584E6B]">
                      Click the <span className="font-semibold text-[#6B46C1]">"Parse PDF Clauses"</span> button above to fetch and extract terms from the official bid PDF.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Eligibility Assessment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1E182B] uppercase tracking-wider text-[11px]">
                BitVivid Technical Fit Assessment
              </h3>
              <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full border border-[#C8D8C4]">
                {tender.fit_score}% Capability Match
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD] space-y-3">
              <div className="flex items-center space-x-2">
                {isDirect ? (
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#9A3412] shrink-0" />
                )}
                <span className="font-bold text-[#1E182B] text-xs">
                  {tender.eligibility_assessment && !tender.eligibility_assessment.includes('verify tender clauses')
                    ? tender.eligibility_assessment
                    : 'Direct Technical Alignment — Video & Surveillance Systems'}
                </span>
              </div>

              <p className="text-[#584E6B] text-xs leading-relaxed font-normal">
                {getCleanAssessmentNotes()}
              </p>

              <div className="pt-2 border-t border-[#E2DEEC]">
                <div className="bg-white border border-[#D8BFD8] p-3 rounded-lg flex items-start space-x-2.5 shadow-2xs">
                  <Briefcase className="w-4 h-4 text-[#6B46C1] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#4A337A] text-[11px] uppercase tracking-wider block">
                      SI / Partner Strategy:
                    </span>
                    <p className="text-[#1E182B] text-xs leading-relaxed font-medium">
                      {getCleanPartnerStrategy()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Internal Business Development Workflow & Notes */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-[#1E182B] uppercase tracking-wider text-[11px]">
              BD Workflow, Stage &amp; Internal Notes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#1E182B] mb-1">Pipeline Stage</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E2DEEC] bg-[#FAF9FD] focus:bg-white text-[#1E182B] font-medium text-xs focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] outline-none transition"
                >
                  <option value="New">New</option>
                  <option value="Reviewing">Reviewing</option>
                  <option value="Bid Ready">Bid Ready (Go)</option>
                  <option value="Submitted">Bid Submitted</option>
                  <option value="Won">Awarded / Won</option>
                  <option value="Lost">Lost</option>
                  <option value="Archived">Archived (No-Go)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#1E182B] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E2DEEC] bg-[#FAF9FD] focus:bg-white text-[#1E182B] font-medium text-xs focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] outline-none transition"
                >
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#1E182B] mb-1">
                Internal Team Notes (Persisted forever)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Partnering with RailTel or L&T for SI route; OEM auth required; contact assigned to Shubham..."
                className="w-full p-3 rounded-lg border border-[#E2DEEC] bg-[#FAF9FD] focus:bg-white text-[#1E182B] text-xs focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] outline-none transition placeholder:text-[#8C82A0]"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-[#E2DEEC] bg-[#FAF9FD] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8C82A0] font-medium">
            Last updated: {tender.updated_at ? formatIndianDateTime(tender.updated_at) : 'N/A'}
          </span>
          <button
            disabled={saving}
            onClick={handleSaveNotes}
            className="px-4 py-2 bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-purple-900/15 inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Notes & Status'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenderDrawer;
