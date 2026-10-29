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
  const { isDrawerOpen, selectedTender, closeTenderDrawer, showNotification } = useApp();
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

  if (!isDrawerOpen || !tender) return null;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const res = await tenderApi.updateTender(tender.id, {
        user_notes: notes,
        status,
        priority
      });
      setTender(res.data);
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
      showNotification('Document parsed! EMD, Estimated Value & Clauses updated.', 'success');
    } catch (e) {
      showNotification(e.response?.data?.detail || 'Failed to parse PDF document', 'error');
    } finally {
      setParsingPdf(false);
    }
  };

  const isDirect = (tender.eligibility_assessment || '').toLowerCase().includes('direct fit');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">

        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="space-y-1 pr-6">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded border border-blue-200">
                {tender.tender_id}
              </span>
              <span className="text-xs text-slate-500 font-medium">{tender.portal}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${isDirect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">

          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5" />
                <span>Organisation</span>
              </span>
              <p className="font-semibold text-slate-900 truncate" title={tender.organisation}>{tender.organisation || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Bid End Date</span>
              </span>
              <p className="font-bold text-rose-600">{tender.closing_date || 'Check portal'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Estimated Tender Value</span>
              </span>
              <p className="font-bold text-emerald-700">
                {tender.estimated_value && tender.estimated_value !== "Check tender PDF / ATC"
                  ? tender.estimated_value
                  : (tender.extracted_pdf_text ? "Not Disclosed by Buyer on GeM" : "Awaiting PDF Parse")}
              </p>
            </div>
          </div>

          {/* Unparsed notice if still pending */}
          {(!tender.extracted_pdf_text && (tender.turnover_required === "Check tender PDF / ATC" || tender.emd_amount === "Check tender PDF / ATC")) && (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>This tender's commercial clauses have not been extracted from the portal document yet.</span>
              </div>
              <button
                disabled={parsingPdf}
                onClick={handleParsePdf}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 transition"
              >
                {parsingPdf ? "Extracting..." : "Auto-Extract Now"}
              </button>
            </div>
          )}

          {/* Links & PDF Extraction Action */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/80 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-blue-950 text-sm">Official Bid Specification Document</p>
                <p className="text-[11px] text-blue-800">Direct link to portal PDF notice & automated parser</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {tender.url && (
                <a
                  href={tender.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold inline-flex items-center space-x-1"
                >
                  <span>Open PDF</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {tender.doc_url && (
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
                Extracted Commercial & Technical Criteria
              </h3>
              {(tender.extracted_pdf_text || (tender.estimated_value && tender.estimated_value !== "Check tender PDF / ATC")) && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                  ✓ Verified from PDF
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">EMD Amount</span>
                <p className="font-bold text-slate-900 text-sm">
                  {tender.emd_amount && tender.emd_amount !== "Check tender PDF / ATC" ? tender.emd_amount : "Nil / Not Required"}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  {tender.emd_exemption || "Verify MSME / Startup rules"}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold">ePBG (Security Deposit)</span>
                <p className="font-bold text-slate-900 text-sm">
                  {tender.epbg_required && tender.epbg_required !== "Check tender PDF / ATC" ? tender.epbg_required : "Not Required"}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1 col-span-2">
                <span className="text-[11px] text-slate-500 font-semibold">Turnover Criteria</span>
                {tender.turnover_required && tender.turnover_required !== "Check tender PDF / ATC" ? (
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    {tender.turnover_required.includes("No Minimum Turnover") ? (
                      <span className="inline-flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
                        <span>✓</span>
                        <span>{tender.turnover_required}</span>
                      </span>
                    ) : (
                      <span className="text-slate-900 font-bold">{tender.turnover_required}</span>
                    )}
                  </p>
                ) : (
                  <div className="flex items-center space-x-2 text-slate-500">
                    <span>Awaiting PDF clause extraction.</span>
                    <button onClick={handleParsePdf} className="text-blue-600 font-semibold hover:underline">
                      Extract clauses
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1 col-span-2">
                <span className="text-[11px] text-slate-500 font-semibold">Past Experience / Order Criteria</span>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {tender.experience_required && tender.experience_required !== "Check tender PDF / ATC"
                    ? tender.experience_required
                    : "Order thresholds / experience certificates required (Click 'Parse PDF' to extract)"}
                </p>
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
                  {tender.extracted_pdf_text ? 'View full excerpt' : 'No document parsed yet'}
                </span>
                {showExcerpt ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {showExcerpt && (
              <div className="p-3.5 bg-white">
                {tender.extracted_pdf_text ? (
                  <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap max-h-56 overflow-y-auto bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                    {tender.extracted_pdf_text}
                  </pre>
                ) : (
                  <div className="py-6 text-center text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">Document text layer not yet parsed.</p>
                    <p className="text-[11px]">Click the blue <span className="font-semibold text-blue-600">"Parse PDF Clauses"</span> button above to fetch and extract terms from the official bid PDF.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Eligibility Assessment */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              BitVivid Technical Fit Assessment
            </h3>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <div className="flex items-center space-x-2">
                {isDirect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-bold text-slate-900">{tender.eligibility_assessment}</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">{tender.assessment_notes}</p>

              <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">SI / Partner Strategy: </span>
                <span>{tender.si_partner_route}</span>
              </div>
            </div>
          </div>

          {/* Internal Business Development Workflow & Notes */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              BD Workflow, Stage & Internal Notes
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
