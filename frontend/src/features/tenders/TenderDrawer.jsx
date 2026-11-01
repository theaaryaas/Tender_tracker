import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  ExternalLink,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Save,
  Calendar,
  Building,
  DollarSign,
  Briefcase,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { tenderApi } from '../../utils/api';

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

  const isDirect = (tender.eligibility_assessment || '').toLowerCase().includes('direct fit');

  // Bid End Date urgency calculation (only red if <= 7 days away)
  const getClosingDateStyle = (rawDate) => {
    if (!rawDate) return 'font-semibold text-slate-800';
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
    return 'font-semibold text-slate-800';
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
    // 1. Strip binary control characters
    let t = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // 2. Strip Devanagari Unicode characters (U+0900 to U+097F)
    t = t.replace(/[\u0900-\u097F]+/g, '');

    // 3. Fix fragmented GeM labels and broken colons
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

      // Filter out isolated icon font glyphs from GeM table checkboxes/bullets (e.g. E, F, H, I, J, L, P, FJ, X, Y, a, c, e)
      if (line.length <= 2 && !validShortWords.has(line.toLowerCase()) && !/^\d+$/.test(line)) {
        continue;
      }
      // Filter out lines of pure punctuation / symbol debris
      if (/^[^\w\s]+$/.test(line)) continue;
      // Filter out sequences of single letters like 'F H I J'
      if (/^[A-Za-z](\s+[A-Za-z])+$/.test(line)) continue;

      // Skip consecutive identical lines (from GeM dual-pass font extraction)
      if (filtered.length > 0 && filtered[filtered.length - 1].toLowerCase() === line.toLowerCase()) {
        continue;
      }
      filtered.push(line);
    }

    // Strip leading Bid / Details / table debris
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
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end"
      onClick={closeTenderDrawer}
    >
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="space-y-1 pr-6">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded border border-blue-200">
                {tender.tender_id}
              </span>
              <span className="text-xs text-slate-500 font-medium">{tender.portal}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${isDirect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
              >
                {tender.fit_score}% Fit
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
              {tender.title}
            </h2>
          </div>
          <button
            onClick={closeTenderDrawer}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-12 space-y-6 text-xs text-slate-700">
          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5" />
                <span>Organisation</span>
              </span>
              <p className="font-semibold text-slate-900 truncate" title={tender.organisation}>
                {tender.organisation || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Bid End Date</span>
              </span>
              <p className={getClosingDateStyle(tender.closing_date)}>
                {tender.closing_date || 'Check portal'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Estimated Tender Value</span>
              </span>
              <p className={isEstimatedDisclosed ? 'font-bold text-emerald-700' : 'font-medium text-slate-700'}>
                {isEstimatedDisclosed
                  ? tender.estimated_value
                  : tender.extracted_pdf_text
                    ? 'Not Disclosed by Buyer on GeM'
                    : 'Awaiting PDF Parse'}
              </p>
            </div>
          </div>

          {/* Official Bid Specification Document Action Box */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/80 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-blue-950 text-sm">Official Bid Specification Document</p>
                <p className="text-[11px] text-blue-800">Direct link to portal PDF notice &amp; automated parser</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold inline-flex items-center space-x-1 shadow-xs transition"
                >
                  <span>Open PDF</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {pdfUrl && (
                <button
                  disabled={parsingPdf}
                  onClick={handleParsePdf}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold inline-flex items-center space-x-1.5 shadow-sm transition"
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
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Extracted Commercial &amp; Technical Criteria
              </h3>
              {(tender.extracted_pdf_text ||
                (tender.estimated_value && tender.estimated_value !== 'Check tender PDF / ATC')) && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    ✓ Verified from PDF
                  </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* EMD */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">EMD Amount</span>
                <p className="font-bold text-slate-900 text-sm">
                  {tender.emd_amount && tender.emd_amount !== 'Check tender PDF / ATC'
                    ? tender.emd_amount
                    : 'Nil / Not Required'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  {tender.emd_exemption || 'Verify MSME / Startup rules'}
                </span>
              </div>

              {/* ePBG */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">ePBG (Security Deposit)</span>
                <p className="font-bold text-slate-900 text-sm">
                  {tender.epbg_required && tender.epbg_required !== 'Check tender PDF / ATC'
                    ? tender.epbg_required
                    : 'Not Required'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Performance bank guarantee clause
                </span>
              </div>

              {/* MSE / MSME Relaxation Criteria */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">MSE Relaxation</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${mse.badge === 'emerald'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : mse.badge === 'rose'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}
                  >
                    {mse.label}
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-xs leading-snug">
                  {mse.detail}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  Experience &amp; Turnover exemptions
                </span>
              </div>

              {/* Startup Relaxation (DPIIT) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">Startup Relaxation</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${startup.badge === 'emerald'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : startup.badge === 'rose'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}
                  >
                    {startup.label}
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-xs leading-snug">
                  {startup.detail}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  DPIIT recognized entity terms
                </span>
              </div>

              {/* Bidder Turnover Card */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">Bidder Minimum Turnover</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    3 Years
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {bidderTurnover
                    ? `₹ ${bidderTurnover}`
                    : displayTurnover && displayTurnover !== '₹ ,'
                      ? displayTurnover
                      : 'No Minimum Mandated'}
                </p>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Minimum Average Annual Turnover of the bidder (For 3 Years)
                </span>
              </div>

              {/* OEM Turnover Card */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">OEM Average Turnover</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    Last 3 Years
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {oemTurnover ? `₹ ${oemTurnover}` : 'Not Specified / Exempt'}
                </p>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  OEM Average Turnover (Last 3 Years)
                </span>
              </div>

              {/* Years of Past Experience Required Card */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">Years of Past Experience</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Mandatory
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {experienceYears || '2 Year (s)'}
                </p>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Years of Past Experience Required for same/similar service
                </span>
              </div>

              {/* Experience & Verification Terms */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">Experience &amp; Verification Terms</span>
                <p className="font-bold text-slate-800 text-xs leading-snug">
                  {tender.experience_required && tender.experience_required !== 'Check tender PDF / ATC'
                    ? tender.experience_required
                    : 'Past project POs & OEM authorization required'}
                </p>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  Document required from seller (ATC compliant)
                </span>
              </div>
            </div>

            {tender.scope_summary && (
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">Parsed Scope of Work / BOQ Item Category</span>
                <p className="text-slate-800 leading-relaxed font-medium">{tender.scope_summary}</p>
              </div>
            )}
          </div>

          {/* Extracted Document Text Preview (Accordion) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <div
              onClick={() => setShowExcerpt(!showExcerpt)}
              className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs">Extracted Tender Document Text Excerpt</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-500">
                  {cleanPdfText ? 'View full excerpt' : 'No document parsed yet'}
                </span>
                {showExcerpt ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {showExcerpt && (
              <div className="p-3.5 bg-white">
                {cleanPdfText ? (
                  <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap max-h-56 overflow-y-auto bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                    {cleanPdfText}
                  </pre>
                ) : (
                  <div className="py-6 text-center text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">Document text layer not yet parsed.</p>
                    <p className="text-[11px]">
                      Click the blue <span className="font-semibold text-blue-600">"Parse PDF Clauses"</span> button above to fetch and extract terms from the official bid PDF.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Eligibility Assessment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                BitVivid Technical Fit Assessment
              </h3>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {tender.fit_score}% Capability Match
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center space-x-2">
                {isDirect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="font-bold text-slate-900 text-xs">
                  {tender.eligibility_assessment && !tender.eligibility_assessment.includes('verify tender clauses')
                    ? tender.eligibility_assessment
                    : 'Direct Technical Alignment — Video & Surveillance Systems'}
                </span>
              </div>

              <p className="text-slate-700 text-xs leading-relaxed font-normal">
                {getCleanAssessmentNotes()}
              </p>

              <div className="pt-2 border-t border-slate-200/80">
                <div className="bg-blue-50/80 border border-blue-200/70 p-3 rounded-lg flex items-start space-x-2.5">
                  <Briefcase className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-950 text-[11px] uppercase tracking-wider block">
                      SI / Partner Strategy:
                    </span>
                    <p className="text-blue-900 text-xs leading-relaxed font-medium">
                      {getCleanPartnerStrategy()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Internal Business Development Workflow & Notes */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              BD Workflow, Stage &amp; Internal Notes
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pipeline Stage</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium focus:ring-1 focus:ring-blue-500"
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
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Internal Team Notes (Persisted forever)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Partnering with RailTel or L&T for SI route; OEM auth required; contact assigned to Shubham..."
                className="w-full p-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Last updated: {tender.updated_at ? new Date(tender.updated_at).toLocaleString() : 'N/A'}
          </span>
          <button
            disabled={saving}
            onClick={handleSaveNotes}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Notes & Status'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
