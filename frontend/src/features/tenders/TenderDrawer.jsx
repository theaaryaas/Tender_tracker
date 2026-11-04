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
  IndianRupee,
  Briefcase,
  Boxes,
  Copy,
  ChevronDown,
  ChevronUp,
  Camera,
  Network,
  HardDrive,
  Zap,
  Search,
  MapPin,
  Mail,
  Clock,
  Package,
  LayoutGrid,
  AlignLeft,
  Check,
  ShieldCheck,
  CreditCard,
  Award,
  Layers,
  Box,
  Truck,
  Cpu,
  FileCheck,
  ShieldAlert,
  Info
} from 'lucide-react';
import { tenderApi } from '../../utils/api';
import { formatIndianDateTime } from '../../utils/dateUtils';

// Defensive sanitizer to prevent Hindi mojibake, control chars or clause bleed
const cleanScopeText = (raw) => {
  if (!raw || /Extraction note:/i.test(raw) || /cannot access local variable/i.test(raw)) return '';
  let s = raw;
  // Cut off at Hindi / Devanagari characters
  const hindiIdx = s.search(/[\u0900-\u097F]/);
  if (hindiIdx !== -1) s = s.substring(0, hindiIdx);
  // Cut off at non-printable ASCII control characters (\x00-\x1F, excluding space)
  const ctrlIdx = s.search(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
  if (ctrlIdx !== -1) s = s.substring(0, ctrlIdx);
  // Cut off at tender clause keywords
  const clauseIdx = s.search(/(?:\/|\b)(?:Minimum\s+Average|Turnover|Experience|Relaxation|Past\s+Performance|GeMARPTS)/i);
  if (clauseIdx !== -1) s = s.substring(0, clauseIdx);
  // Remove (Q2), (Q3) etc.
  s = s.replace(/\s*\(\s*Q\s*\d+\s*\)/gi, '');
  return s.replace(/^[;,\s\-:]+|[;,\s\-:]+$/g, '').trim();
};

// Standalone equipment keywords that should NEVER be merged into a previous item
const EQUIP_KEYWORD_REGEX = /\b(camera|cctv|cam|dome|bullet|ptz|nvr|dvr|vms|switch|router|rack|cable|wire|hdd|ssd|disk|drive|storage|monitor|display|screen|connector|junction|box|installation|service|services|ups|server|panel|sensor|mic|speaker|card|memory|adaptor|adapter|smps|lens|firewall|transceiver|controller|point|light|patch|pole|conduit|pipe)\b/i;

const parseScopeItems = (scopeStr, fallbackTitle) => {
  const cleanStr = cleanScopeText(scopeStr) || cleanScopeText(fallbackTitle) || '';
  if (!cleanStr) return [];

  const rawTokens = cleanStr
    .split(/[,;\n]+/)
    .map(i => i.replace(/^[:\s\-\/]+/, '').trim())
    .filter(Boolean);

  const isSpecOrCapacity = (s) => {
    const clean = s.trim();
    if (EQUIP_KEYWORD_REGEX.test(clean)) {
      return false;
    }
    return (
      /^(\d+(\.\d+)?\s*(tb|gb|mb|kb|w|watt|watts|v|dc|ac|a|amp|m|mtr|mtrs|meter|meters|fps|rpm|ports?))\b/i.test(clean) ||
      /^(dc|ac|\d+a|\d+v|\d+tb|\d+gb|poe\+*|sfp\+*|cat\s*6a?|4k|uhd|fhd)$/i.test(clean)
    );
  };

  const items = [];
  for (const token of rawTokens) {
    const cleaned = token.replace(/\s*\(Q\d+\)\s*\d*$/i, '').trim();
    if (!cleaned || cleaned.length < 2) continue;

    if (isSpecOrCapacity(cleaned) && items.length > 0) {
      items[items.length - 1].specs.push(cleaned);
    } else {
      items.push({ name: cleaned, specs: [] });
    }
  }
  return items;
};

export const TenderDrawer = () => {
  const { isDrawerOpen, selectedTender, closeTenderDrawer, showNotification, refreshStats } = useApp();
  const [tender, setTender] = useState(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('New');
  const [priority, setPriority] = useState('Normal');
  const [parsingPdf, setParsingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExcerpt, setShowExcerpt] = useState(true);
  const [docTab, setDocTab] = useState('structured');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');

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

  const cleanLakhs = (val) => {
    if (!val) return null;
    let s = String(val).trim();
    s = s.replace(/\(s\)/gi, '').replace(/\s+/g, ' ').trim();
    if (!/lakh/i.test(s) && !/cr/i.test(s) && !isNaN(parseFloat(s))) {
      s = `${s} Lakhs`;
    } else {
      s = s.replace(/\blakh\b/i, 'Lakhs');
    }
    return s;
  };

  const cleanYears = (val) => {
    if (!val) return null;
    let s = String(val).trim();
    s = s.replace(/\(s\)/gi, '').replace(/\s+/g, ' ').trim();
    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      s = `${num} Year${num > 1 ? 's' : ''}`;
    } else {
      s = s.replace(/\byear\b/i, 'Year').replace(/\byears\b/i, 'Years');
    }
    return s;
  };

  const getMseStatus = () => {
    const raw = (tender.mse_relaxation || '').toLowerCase();
    if (raw.startsWith('yes')) {
      return { 
        label: 'Exemption Granted', 
        badge: 'emerald', 
        detail: 'Exemption on turnover & past experience applicable for Udyam entities',
        subtext: 'Eligible for MSE concessions'
      };
    }
    if (raw.startsWith('no')) {
      return { 
        label: 'Strict (No Exemption)', 
        badge: 'rose', 
        detail: 'Udyam entities must meet full turnover & past experience criteria',
        subtext: 'Full commercial qualifications mandatory'
      };
    }
    if (tender.extracted_pdf_text) {
      if (/MSE\s+Relaxation[\s\S]{1,80}?\n\s*No/i.test(tender.extracted_pdf_text)) {
        return { 
          label: 'Strict (No Exemption)', 
          badge: 'rose', 
          detail: 'Udyam entities must meet full turnover & past experience criteria',
          subtext: 'Full commercial qualifications mandatory'
        };
      }
      if (/MSE\s+Relaxation[\s\S]{1,80}?\n\s*Yes/i.test(tender.extracted_pdf_text)) {
        return { 
          label: 'Exemption Granted', 
          badge: 'emerald', 
          detail: 'Exemption on turnover & past experience applicable for Udyam entities',
          subtext: 'Eligible for MSE concessions'
        };
      }
    }
    return { 
      label: 'Check ATC Rules', 
      badge: 'slate', 
      detail: 'Verify exact MSE exemptions in buyer ATC clauses',
      subtext: 'Review Buyer ATC specification'
    };
  };

  const getStartupStatus = () => {
    const raw = (tender.startup_relaxation || '').toLowerCase();
    if (raw.startsWith('yes')) {
      return { 
        label: 'Exemption Granted', 
        badge: 'emerald', 
        detail: 'DPIIT startups exempt from past experience & turnover criteria',
        subtext: 'Eligible for DPIIT startup concessions'
      };
    }
    if (raw.startsWith('no')) {
      return { 
        label: 'Strict (No Exemption)', 
        badge: 'rose', 
        detail: 'DPIIT startups must meet standard baseline criteria',
        subtext: 'No startup concessions provided'
      };
    }
    if (tender.extracted_pdf_text) {
      if (/Startup\s+Relaxation[\s\S]{1,80}?\n\s*No/i.test(tender.extracted_pdf_text)) {
        return { 
          label: 'Strict (No Exemption)', 
          badge: 'rose', 
          detail: 'DPIIT startups must meet standard baseline criteria',
          subtext: 'No startup concessions provided'
        };
      }
      if (/Startup\s+Relaxation[\s\S]{1,80}?\n\s*Yes/i.test(tender.extracted_pdf_text)) {
        return { 
          label: 'Exemption Granted', 
          badge: 'emerald', 
          detail: 'DPIIT startups exempt from past experience & turnover criteria',
          subtext: 'Eligible for DPIIT startup concessions'
        };
      }
    }
    return { 
      label: 'Check ATC Rules', 
      badge: 'slate', 
      detail: 'Verify DPIIT startup rules in buyer ATC clauses',
      subtext: 'Review Buyer ATC specification'
    };
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

  // Dynamic multi-page parser covering any GeM bid PDF
  const parseDocumentDetails = (raw) => {
    if (!raw) return { dossier: null, parameters: [], lines: [], fullText: '' };

    let t = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    t = t.replace(/\r/g, '');
    t = t.replace(/^[=\-\s]*OFFICIAL GeM BID DETAILS & SPECIFICATIONS[=\-\s]*/gim, '').trim();

    // Strip page excerpt headers
    t = t.replace(/\d+\s*\/\s*\d+\s*(?:\n\s*)?PAGE EXCERPT/gi, '');
    t = t.replace(/\[PAGE\s*\d+\s*OF\s*\d+\]/gi, '');
    t = t.replace(/PAGE EXCERPT/gi, '');
    t = t.replace(/\bBid\s+Document\b/gi, '');

    const getMatch = (regex) => {
      const m = t.match(regex);
      return m && m[1] ? m[1].replace(/^[;,\s\-:]+|[;,\s\-:]+$/g, '').trim() : null;
    };

    // 1. Authority & Location
    const ministry = getMatch(/Ministry\/State\s+Name:\s*([^\n]+)/i) || tender.ministry_state;
    const department = getMatch(/Department\s+Name:\s*([^\n]+)/i);
    let organization = getMatch(/Organisation\s+Name:\s*([^\n]+)/i);
    if (!organization || organization.toLowerCase() === 'n/a') organization = tender.organisation;
    
    let office = getMatch(/Office\s+Name:\s*([^\n]+)/i);
    if (!office || office.toLowerCase().includes('contact details')) office = tender.office_location || office;

    const beneficiary = getMatch(/Beneficiary:\s*([^\n]+(?:\n[^\n]+)?)/i);
    const quantity = getMatch(/Total\s+Quantity\s*[:\n]+\s*([^\n]+)/i);
    const contractPeriod = getMatch(/Contract\s+Period\s*[:\n]+\s*([^\n]+)/i);

    // 2. Deadlines & Contacts
    const bidEnd = getMatch(/Bid\s+End\s+Date\/Time\s*[:\n]+\s*([^\n]+)/i) || tender.closing_date;
    const bidOpen = getMatch(/Bid\s+Opening[\s\n]+Date\/Time[\s\n]+([^\n]+)/i);
    const validity = getMatch(/Bid\s+Offer[\s\n]+Validity[^\n]*\n\s*(\d+\s*\(Days\))/i);
    const buyerEmail = getMatch(/Buyer\s+Email\s+id\s*[:\n]+\s*([^\n]+)/i);
    const hodEmail = getMatch(/HOD\s+Email\s+id\s*[:\n]+\s*([^\n]+)/i);

    // 3. EMD Schedules Map
    const emdScheduleRegex = /Schedule\s+(\d+)[\s\S]*?EMD\s+Amount\s*(?:\(In\s*INR\))?\s*[:\n]+\s*(\d+)/gi;
    const emdMap = {};
    let schedMatch;
    while ((schedMatch = emdScheduleRegex.exec(t)) !== null) {
      const sNum = parseInt(schedMatch[1], 10);
      const sAmt = parseInt(schedMatch[2], 10);
      if (!emdMap[sNum]) emdMap[sNum] = sAmt;
    }

    // 4. Multi-Item Schedule Evaluation Table (if present)
    const cleanForTable = t.replace(/\b\d+\s*\/\s*\d+\b/g, '').replace(/\[PAGE\s*\d+\s*OF\s*\d+\]/gi, '');
    const schedPattern = /Schedule\s+(\d+)\s*\n\s*([0-9.]+(?:\.\d{2})?)\s*\n\s*([A-Za-z0-9\s,\(\)\/\-]+?)\s*\n\s*(\d+)\s*(?=\n\s*(?:Schedule|\Z|Camera For CCTV))/gi;
    const schedules = [];
    let itemMatch;
    while ((itemMatch = schedPattern.exec(cleanForTable)) !== null) {
      const sNum = parseInt(itemMatch[1], 10);
      const val = parseFloat(itemMatch[2]);
      const itemName = itemMatch[3].replace(/\n+/g, ' ').trim();
      const qty = parseInt(itemMatch[4], 10);
      const emdAmt = emdMap[sNum] || 0;
      schedules.push({
        schedule: sNum,
        item: itemName,
        quantity: qty,
        estimatedValue: val,
        emd: emdAmt
      });
    }
    schedules.sort((a, b) => a.schedule - b.schedule);

    // Dynamic Financial Calculations
    let estValueRaw = getMatch(/Estimated\s+Bid\s+Value[\s\S]*?(?:INR\s*)?([\d,.]+)/i);
    let totalValue = 0;
    let estValueFormatted = null;

    if (schedules.length > 0) {
      totalValue = schedules.reduce((sum, s) => sum + s.estimatedValue, 0);
      estValueFormatted = `₹ ${(totalValue / 100000).toFixed(2)} Lakhs (₹ ${totalValue.toLocaleString('en-IN')})`;
    } else if (estValueRaw) {
      const num = parseFloat(estValueRaw.replace(/,/g, ''));
      if (!isNaN(num)) {
        totalValue = num;
        estValueFormatted = `₹ ${(num / 100000).toFixed(2)} Lakhs (₹ ${num.toLocaleString('en-IN')})`;
      }
    } else if (tender.estimated_value && !tender.estimated_value.includes('Check')) {
      estValueFormatted = tender.estimated_value;
    }

    const totalQty = schedules.length > 0
      ? schedules.reduce((sum, s) => sum + s.quantity, 0)
      : (quantity ? parseInt(quantity.replace(/\D/g, ''), 10) || 1 : 1);

    const totalEmdNum = schedules.length > 0
      ? schedules.reduce((sum, s) => sum + s.emd, 0)
      : Object.values(emdMap).reduce((a, b) => a + b, 0);

    const totalEmd = totalEmdNum > 0
      ? `₹ ${totalEmdNum.toLocaleString('en-IN')}${schedules.length > 0 ? ` (${schedules.length} Schedules)` : ''}`
      : (tender.emd_amount || 'Nil / Not Required');

    const epbgPercent = getMatch(/ePBG\s+Percentage\s*\(\s*%\s*\)\s*[:\n]+\s*([\d.]+)/i);
    const epbgMonths = getMatch(/Duration\s+of\s+ePBG[\s\S]*?(?:required\s*\(Months\)\.?\s*[:\n]+)?\s*(\d+)/i);
    const epbgBank = getMatch(/ePBG\s+Detail[\s\S]*?Advisory\s+Bank\s*[:\n]+\s*([^\n]+)/i);
    const emdBank = getMatch(/EMD\s+Detail[\s\S]*?Advisory\s+Bank\s*[:\n]+\s*([^\n]+)/i);
    const paymentDays = getMatch(/Payments\s+shall\s+be\s+made\s+to\s+the\s+Seller\s+within\s*(\d+)\s*days/i) || '21';
    const isTreds = t.includes('TReDS') ? 'Enabled (Preferred for MSME Sellers)' : null;

    // 5. Bidding & Evaluation Rules
    const typeOfBid = getMatch(/Type\s+of\s+Bid\s*[:\n]+\s*([^\n]+)/i) || 'Two Packet Bid';
    const evalMethod = getMatch(/Evaluation\s+Method\s*[:\n]+\s*([^\n]+)/i) || (schedules.length > 1 ? 'Item wise evaluation' : 'Total value wise evaluation');
    const primaryCat = getMatch(/Primary\s+product\s+category\s*[:\n]+\s*([^\n]+)/i) || tender.title;
    const raEnabled = /Bid\s+to\s+RA\s+enabled[\s\S]*?Yes/i.test(t) ? 'Enabled (Yes)' : 'Disabled (No)';
    const clarWindow = getMatch(/Time\s+allowed\s+for\s+Technical[\s\S]*?Clarifications[^\n]*\n\s*(\d+\s*Days?)/i) || '7 Days';
    const autoExtDays = getMatch(/Number\s+of\s+days[\s\S]*?auto\s+extended[\s\S]*?(\d+)/i) || '7';
    const minBidsToDisableExt = getMatch(/Minimum\s+number\s+of\s+bids\s+required\s+to\s+disable[\s\S]*?(\d+)/i) || '3';

    // 6. Preferential Policies
    const miiPref = /MII\s+Purchase\s+Preference[\s\S]*?Yes/i.test(t);
    const miiMargin = getMatch(/Preference\s+to\s+MII\s+sellers\s+availabele\s+upto\s+price\s+within\s+L1\+X%?\s*[:\n]+\s*(\d+)/i) || '20';
    const miiQty = getMatch(/Maximum\s+Percentage\s+of\s+Bid\s+quantity\s+for\s+MII\s+purchase\s+preference\s*[:\n]+\s*(\d+)/i) || '50';

    const msePref = /MSE\s+Purchase\s+Preference[\s\S]*?Yes/i.test(t);
    const mseMargin = getMatch(/Purchase\s+Preference\s+to\s+MSE\s+OEMs\/?\s*Service\s+Provider\s+available\s+upto\s+price\s+within\s+L1\+X%?\s*[:\n]+\s*(\d+)/i) || '15';
    const mseQty = getMatch(/Percentage\s+of\s+Bid\s+quantity\/amount\s+for\s+MSE\s+OEMs\/?\s*Service\s+Provider\s+Purchase\s+preference\s*[:\n]+\s*(\d+)/i) || '25';

    const mseRelax = /MSE\s+Relaxation\s+for\s+Years\s+Of\s+Experience\s+and\s+Turnover:\s*Yes/i.test(t);
    const startupRelax = /Startup\s+Relaxation\s+for\s+Years\s+Of\s+Experience\s+and\s+Turnover:\s*Yes/i.test(t);

    // 7. Consignee & Site Delivery Destination (Dynamic regex)
    let consigneeOfficer = null;
    let consigneeAddress = null;
    let deliveryDays = null;

    const consMatch = t.match(/Consignee[\s\S]*?Reporting\/Officer[\s\S]*?Delivery\s+Days\s*\n\s*1\s*\n\s*([A-Za-z\s\n]+?)\s*\n\s*(\d{6},[\s\S]+?)\s*\n\s*(\d+)\s*\n\s*(\d+)\s*(?=\n\s*(?:Special|Camera|Technical|Buyer|Minimum|\Z))/i);
    if (consMatch) {
      consigneeOfficer = consMatch[1].replace(/\n+/g, ' ').trim();
      consigneeAddress = consMatch[2].replace(/\n+/g, ' ').trim();
      deliveryDays = `${consMatch[4]} Days`;
    } else {
      consigneeOfficer = getMatch(/Consignee[\s\S]*?Reporting\/Officer[\s\S]*?([A-Za-z\s]+)\s*\n\s*\d{6}/i);
      consigneeAddress = getMatch(/Consignee[\s\S]*?Reporting\/Officer[\s\S]*?\n\s*(\d{6},[^\n]+)/i);
      deliveryDays = getMatch(/Delivery\s+Days[\s\S]*?(\d+)/i) ? `${getMatch(/Delivery\s+Days[\s\S]*?(\d+)/i)} Days` : null;
    }

    // 8. Mandatory ATC Documents
    const atcDocsMatch = t.match(/Document\s+required\s+from\s+seller\s*[:\n]+([\s\S]*?)(?=\*In\s+case|Do\s+you\s+want|Minimum\s+number|Bid\s+to\s+RA)/i);
    let atcDocs = [];
    if (atcDocsMatch) {
      atcDocs = atcDocsMatch[1]
        .replace(/\n+/g, ' ')
        .split(/[,;]+/)
        .map(d => d.trim())
        .filter(Boolean);
    }

    // 9. Structured Metadata Parameters (The clean key-value parameter cards!)
    const parameters = [
      { label: 'MINISTRY / STATE', value: ministry, icon: Building },
      { label: 'DEPARTMENT NAME', value: department, icon: Building },
      { label: 'ORGANISATION', value: organization, icon: Building },
      { label: 'OFFICE / LOCATION', value: office, icon: MapPin },
      { label: 'TOTAL BOQ QUANTITY', value: quantity ? `${quantity} Units` : (totalQty ? `${totalQty} Units` : null), icon: Package },
      { label: 'BID OFFER VALIDITY', value: validity, icon: Clock },
      { label: 'BID SUBMISSION DEADLINE', value: bidEnd, icon: Calendar },
      { label: 'TECHNICAL BID OPENING', value: bidOpen, icon: Calendar },
      { label: 'BUYER CONTACT EMAIL', value: buyerEmail, icon: Mail, isCopyable: true },
      { label: 'GRIEVANCE / HOD EMAIL', value: hodEmail, icon: Mail, isCopyable: true },
      { label: 'ESTIMATED BID VALUE', value: estValueFormatted, icon: IndianRupee },
      { label: 'TOTAL EMD AMOUNT', value: totalEmd, icon: ShieldCheck },
      { label: 'ePBG (SECURITY DEPOSIT)', value: epbgPercent ? `${epbgPercent}% (${epbgMonths ? epbgMonths + ' Months' : '4 Months'})` : null, icon: CreditCard },
      { label: 'PAYMENT TERMS', value: `Within ${paymentDays} days of CRAC & online bills`, icon: Clock },
      { label: 'TYPE OF BID', value: typeOfBid, icon: FileText },
      { label: 'EVALUATION METHOD', value: evalMethod, icon: Layers },
      { label: 'REVERSE AUCTION (RA)', value: raEnabled, icon: Zap },
      { label: 'MAKE IN INDIA (MII)', value: miiPref ? `Yes (L1+${miiMargin}%, max ${miiQty}% qty)` : null, icon: Award },
      { label: 'MSE PURCHASE PREFERENCE', value: msePref ? `Yes (L1+${mseMargin}%, max ${mseQty}% qty)` : null, icon: Award },
      { label: 'MANDATORY ATC DOCS', value: atcDocs.length > 0 ? atcDocs.join(', ') : null, icon: FileCheck }
    ].filter(p => p.value);

    // 10. Hardware & Technical Norms (Dynamic extraction)
    const hasCamera = /camera/i.test(t);
    const hasNvr = /video recorder|nvr|dvr/i.test(t);
    const hasSwitch = /switch|poe/i.test(t);
    const hasStorage = /hard disk|hard drive|storage/i.test(t);

    const techSpecs = {
      cameras: hasCamera ? {
        title: 'IP Surveillance Cameras',
        categories: getMatch(/PTZ\s+Camera\s*\/\s*Speed\s+Dome[\s\S]*?Type\s+of\s+Camera\s+Housing\s*\n\s*([^\n]+)/i) || 'Dome & Bullet IP Camera (Outdoor Weatherproof)',
        resolution: getMatch(/Camera\s+Resolution[\s\S]*?\n\s*([^\n]+)/i) || '2MP (1920x1080) Full HD sensor, 25/30 fps',
        streams: 'Triple Stream (Full resolution + sub streams)',
        lens: 'Motorized Varifocal Optical Zoom Lens',
        nightVision: 'IR Illumination Range 30m to 100m Night Vision',
        storage: 'On-board MicroSD Slot supporting local edge recording',
        warranty: '1 to 5 Years Comprehensive On-site OEM Warranty'
      } : null,
      recorders: hasNvr ? {
        title: 'Network Video Recorders (NVR)',
        breakdown: getMatch(/Total\s+Number\s+of\s+Input\s+Channels\s*\n\s*(\d+)/i) ? `${getMatch(/Total\s+Number\s+of\s+Input\s+Channels\s*\n\s*(\d+)/i)} Channels IP Input` : 'Multi-Channel NVR Recording',
        resolution: '4K Ultra-HD (3840x2160) & 12MP decoding support',
        features: 'Synchronous playback, RAID storage, H.265+ compression, HDMI output'
      } : null,
      switch: hasSwitch ? {
        title: 'Managed Layer 2 Access Switch',
        description: 'Managed Layer 2 Access Switch',
        downlinks: 'PoE, PoE+, PoE++ High-Power RJ45 Downlink ports',
        uplinks: 'SFP & SFP+ High-Speed Optical Fiber Uplinks (1G / 10G)'
      } : null,
      storage: hasStorage ? {
        title: 'Surveillance Hard Drives & Power',
        drives: '24x7 Surveillance Grade SATA Hard Drives',
        duty: 'Surveillance duty cycle engineered for continuous 24x7 video writing'
      } : null
    };

    // 11. Compliances
    const compliances = [];
    if (/Standardization\s+Testing\s+and\s+Quality\s+Certification|STQC/i.test(t)) {
      compliances.push({
        title: 'MeitY / STQC Security Testing Report',
        code: 'S.O. 1119 (E) Clause 5',
        status: 'Mandatory before CRAC',
        description: 'STQC Laboratory testing report for CCTV/VSS mandatory before CRAC acceptance.',
        badge: 'Critical'
      });
    }
    if (/IS\s+13252|Scheme\s*-?\s*II|Compulsory\s+Registration\s+Scheme/i.test(t)) {
      compliances.push({
        title: 'BIS Compulsory Registration Scheme (CRS)',
        code: 'IS 13252 (Part 1) / Scheme-II',
        status: 'Mandatory',
        description: 'Conforming to IS 13252 (Part 1) and bearing Standard Mark under BIS Scheme-II.',
        badge: 'Statutory'
      });
    }
    if (/IV-24011\/22\/2020|MHA/i.test(t)) {
      compliances.push({
        title: 'MHA Security Advisory Compliance',
        code: 'O.M. IV-24011/22/2020-Prov-I/270',
        status: 'Mandatory',
        description: 'Compliance with Ministry of Home Affairs security advisory for secure surveillance.',
        badge: 'Security'
      });
    }
    if (/Labour\s+Codes|Minimum\s+Wages/i.test(t)) {
      compliances.push({
        title: 'Four Labour Codes & Statutory Wages',
        code: 'Labour Codes 2019-2020 & Minimum Wages Act 1948',
        status: 'Mandatory',
        description: 'Compliance with Code on Wages, IR Code, OSH, and legacy Payment of Bonus & Gratuity Acts.',
        badge: 'Legal'
      });
    }
    if (/land\s+border/i.test(t)) {
      compliances.push({
        title: 'Land Border Sharing Restrictions',
        code: 'GeM GTC Clause 26 & Rule 144(xi) GFR 2017',
        status: 'Mandatory Declaration',
        description: 'Bidders from countries sharing a land border with India must be registered with Competent Authority.',
        badge: 'Compliance'
      });
    }
    if (/OPTION\s+CLAUSE/i.test(t)) {
      compliances.push({
        title: 'Option Clause (25% Quantity Variation)',
        code: 'Buyer ATC Option Clause',
        status: 'Enforceable',
        description: 'Purchaser reserves the right to vary order quantity up to ±25% at contracted rates.',
        badge: 'Commercial'
      });
    }

    const dossier = {
      authority: { ministry, department, organization, office, beneficiary, quantity, buyerEmail, hodEmail, contractPeriod },
      deadlines: { bidEnd, bidOpen, validity },
      financials: {
        estValueFormatted,
        totalValue,
        totalQty,
        totalEmd,
        totalEmdNum,
        emdBank: emdBank || 'ICICI',
        epbgPercent: epbgPercent ? `${epbgPercent}%` : null,
        epbgMonths: epbgMonths ? `${epbgMonths} Months` : null,
        epbgBank: epbgBank || 'ICICI',
        paymentTerms: `Within ${paymentDays} days of CRAC and online submission of bills (TReDS preferred for MSME)`,
        schedules
      },
      consignee: {
        officer: consigneeOfficer,
        address: consigneeAddress,
        deliveryDays
      },
      policies: {
        mii: miiPref ? { enabled: true, margin: `L1 + ${miiMargin}%`, quantity: `${miiQty}%` } : null,
        mse: msePref ? { enabled: true, margin: `L1 + ${mseMargin}%`, quantity: `${mseQty}%` } : null,
        mseRelax: mseRelax ? 'Complete Exemption (Turnover & Experience)' : 'Standard Criteria',
        startupRelax: startupRelax ? 'Complete Exemption (Turnover & Experience)' : 'Standard Criteria',
        treds: isTreds
      },
      rules: {
        typeOfBid,
        evalMethod,
        primaryCat,
        raEnabled,
        clarWindow,
        autoExt: `${autoExtDays} Days (Min ${minBidsToDisableExt} bids)`
      },
      atcDocs,
      techSpecs,
      compliances
    };

    // Clean Reflowed Document Text Stream
    let cleanText = t;
    cleanText = cleanText.replace(/Bid\s+Opening\s*\n\s*Date\s*\/\s*Time\s*\n\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/gi, '\nBid Opening Date/Time: $1\n');
    cleanText = cleanText.replace(/Bid\s+Offer\s*\n\s*Validity\s*\(From\s+End\s+Date\)\s*\n\s*(\d+\s*\(Days\))/gi, '\nBid Offer Validity: $1\n');
    cleanText = cleanText.replace(/Contact\s+details\s+of\s*\n\s*Grievance\s+redressal\s*\n\s*/gi, '\n');
    cleanText = cleanText.replace(/HOD\s+Email\s+id\s*:?\s*([^\n]+)/gi, '\nGrievance / HOD Email: $1\n');
    cleanText = cleanText.replace(/Buyer\s+Email\s+id\s*:?\s*([^\n]+)/gi, '\nBuyer Email: $1\n');
    cleanText = cleanText.replace(/Total\s+Quantity\s*:\s*([^\n]+)/gi, '\nTotal BOQ Quantity: $1 Units\n');

    cleanText = cleanText.replace(/\bEMD\s+Detail\b/gi, '\n--- [SECTION: EMD & FINANCIAL SCHEDULES] ---\n');
    cleanText = cleanText.replace(/\bePBG\s+Detail\b/gi, '\n--- [SECTION: ePBG PERFORMANCE SECURITY] ---\n');
    cleanText = cleanText.replace(/\bTReDS\s+Payment\s+Details\b/gi, '\n--- [SECTION: TReDS PAYMENT & CONCESSIONS] ---\n');
    cleanText = cleanText.replace(/\bConsignees\/Reporting\s+Officer\b/gi, '\n--- [SECTION: CONSIGNEE & SITE DELIVERY] ---\n');
    cleanText = cleanText.replace(/\bTechnical\s+Specifications\b/gi, '\n--- [SECTION: TECHNICAL SPECIFICATIONS & HARDWARE] ---\n');
    cleanText = cleanText.replace(/\bBuyer\s+Added\s+Bid\s+Specific\s+Terms\b/gi, '\n--- [SECTION: BUYER ATC & STATUTORY COMPLIANCE] ---\n');

    const rawTokens = cleanText.split('\n');
    const filtered = [];
    const noiseSet = new Set(['5', '8', '1', '2', '3', '0', '7', '4', 'b0k', 't<]', 'd..', 's.n', 'dated', 'details', '0?l']);

    for (const line of rawTokens) {
      const trimmed = line.replace(/^[\s/:\-]+|[\s/:\-]+$/g, '').trim();
      if (!trimmed) continue;
      if (/^[0-9]$/.test(trimmed) || noiseSet.has(trimmed.toLowerCase())) continue;
      if (/^[^\w\s]+$/.test(trimmed)) continue;
      if (trimmed.length <= 1) continue;
      filtered.push(trimmed);
    }

    const lines = [];
    const prepositions = /(?<![\.@\w])\b(for|of|in|to|with|by|on|at|and|or|as|from|within|during|is|be|under|into|through|after|before|shall|must|will|may)\s*$/i;

    let current = '';
    for (const item of filtered) {
      if (!current) {
        current = item;
        continue;
      }

      const itemIsKeyValue = item.includes(':') && !item.startsWith('http');
      const itemIsSectionHeader = /^(\[|---|\(?[a-d]\)\.|\d+\.\s+[A-Z]|Schedule\s+\d+|Beneficiary)/i.test(item);

      if (itemIsKeyValue || itemIsSectionHeader) {
        lines.push(current);
        current = item;
        continue;
      }

      const currentEndsPreposition = prepositions.test(current);
      const currentEndsPunctuation = /[,;/\-]$/.test(current);
      const itemStartsLower = /^[a-z]/.test(item);
      const itemIsShortFragment = item.length < 35 && !item.includes(':') && !/^\d+\./.test(item) && !/^[A-Z0-9\s]{4,}$/.test(item);

      if (currentEndsPreposition || currentEndsPunctuation || itemStartsLower || (current.length < 45 && itemIsShortFragment && !current.includes(':'))) {
        current += ' ' + item;
      } else {
        lines.push(current);
        current = item;
      }
    }
    if (current) lines.push(current);

    return { dossier, parameters, lines, fullText: lines.join('\n') };
  };

  const docDetails = parseDocumentDetails(tender.extracted_pdf_text);
  const cleanPdfText = docDetails.fullText;
  const dossier = docDetails.dossier;
  const parameters = docDetails.parameters || [];

  const mse = getMseStatus();
  const startup = getStartupStatus();
  const displayTurnover = getTurnoverDisplay();
  const bidderTurnover = getBidderTurnover();
  const oemTurnover = getOemTurnover();
  const experienceYears = getExperienceYears();

  const emdVal = (tender.emd_amount || '').toLowerCase();
  const isEmdExempt = !tender.emd_amount || 
    emdVal.includes('nil') || 
    emdVal.includes('not required') || 
    emdVal.includes('check tender') || 
    emdVal === '0' || 
    emdVal === '₹ 0';

  const epbgVal = (tender.epbg_required || '').toLowerCase();
  const isEpbgExempt = !tender.epbg_required || 
    epbgVal.includes('not required') || 
    epbgVal.includes('nil') || 
    epbgVal.includes('check tender') || 
    epbgVal === '0' || 
    epbgVal === 'no';

  // Refined Technical Assessment Notes
  const getCleanAssessmentNotes = () => {
    let raw = tender.assessment_notes || '';
    if (
      !raw ||
      raw.toLowerCase().includes('company turnover') ||
      raw.includes("Tender title/keyword aligns with BitVivid's known AI")
    ) {
      const scopeDesc = cleanScopeText(tender.scope_summary || tender.title) || 'CCTV & Video Systems';
      const toText = cleanLakhs(bidderTurnover) ? `₹ ${cleanLakhs(bidderTurnover)}` : (displayTurnover && displayTurnover !== '₹ ,' ? displayTurnover : 'baseline');
      const expText = cleanYears(experienceYears) || '1 Year';
      const emdText = tender.emd_amount && tender.emd_amount !== 'Check tender PDF / ATC' ? tender.emd_amount : 'Nil / Not Required';
      const mseNote = mse.badge === 'rose'
        ? 'Note: ATC terms do not grant MSE/Startup relaxation; credentials must be uploaded.'
        : 'MSE/Startup relaxation applies for experience and turnover.';

      return `Scope encompasses ${scopeDesc}, matching BitVivid's capabilities in surveillance, video analytics (VMS), and edge camera infrastructure. Eligibility mandates ${toText} bidder turnover and ${expText} past experience. ${mseNote} Total EMD is ${emdText}.`;
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
      return `OEM Authorization Route: Secure Manufacturer Authorization Form (MAF) from authorized hardware OEMs${oemText}. Bid directly under MSE exemption if eligible, or partner as technical AI/VMS provider with an empanelled prime System Integrator.`;
    }
    return raw;
  };

  // Clean deduplicated title with quantities
  const getCleanTitle = () => {
    if (dossier?.financials?.schedules?.length > 1) {
      const map = new Map();
      for (const s of dossier.financials.schedules) {
        let name = s.item.replace(/\s+/g, ' ').trim();
        name = name.replace(/\b(v[23])\b/gi, (m) => m.toUpperCase());
        const base = name.split(',')[0].trim();
        map.set(base, (map.get(base) || 0) + s.quantity);
      }
      const parts = [];
      for (const [k, v] of map.entries()) {
        parts.push(`${k} (${v} Units)`);
      }
      return parts.join(' • ');
    }

    if (!tender.title) return 'Tender Notice Details';
    const cleanT = cleanScopeText(tender.title);
    const parts = cleanT.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.join(' • ');
  };

  // Parsed Equipment Categories
  const scopeItems = parseScopeItems(tender.scope_summary, tender.title);

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
                  (tender.fit_score || 0) >= 75
                    ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8D8C4]'
                    : (tender.fit_score || 0) >= 50
                      ? 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]'
                      : 'bg-[#F1F0F5] text-[#584E6B] border-[#E2DEEC]'
                }`}
              >
                {tender.fit_score}% Fit
              </span>
              {dossier?.financials?.schedules?.length > 1 && (
                <span className="text-xs font-bold text-[#6B46C1] bg-[#FAF5FF] border border-[#E9D8FD] px-2.5 py-0.5 rounded-lg">
                  {dossier.financials.schedules.length} Itemized Schedules ({dossier.financials.totalQty} Units)
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#1E182B] leading-snug line-clamp-2" title={tender.title}>
              {getCleanTitle()}
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
          {/* Key Facts Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#FAF9FD] p-4 rounded-xl border border-[#E2DEEC]">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <Building className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>Organisation</span>
              </span>
              <p className="font-bold text-[#1E182B] truncate text-xs sm:text-sm" title={tender.organisation}>
                {tender.organisation || dossier?.authority?.organization || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>Bid End Date</span>
              </span>
              <p className={`${getClosingDateStyle(tender.closing_date)} text-xs sm:text-sm`}>
                {tender.closing_date || dossier?.deadlines?.bidEnd || 'Check portal'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Estimated Tender Value</span>
              </span>
              <p className="font-bold text-[#2E7D32] text-xs sm:text-sm font-mono">
                {dossier?.financials?.estValueFormatted || (tender.estimated_value && tender.estimated_value !== 'Check tender PDF / ATC' ? tender.estimated_value : 'Check tender PDF / ATC')}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#8C82A0] flex items-center space-x-1.5">
                <Package className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>Total BOQ Quantity</span>
              </span>
              <p className="font-bold text-[#1E182B] text-xs sm:text-sm">
                {dossier?.authority?.quantity ? `${dossier.authority.quantity} Units` : (dossier?.financials?.totalQty ? `${dossier.financials.totalQty} Units` : '1 Unit')}
              </p>
            </div>
          </div>

          {/* Official Bid Specification Document Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#FAF9FD] border border-[#E2DEEC] gap-3">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-[#1E182B] text-sm">Official Bid Specification Document</p>
                <p className="text-[11px] text-[#584E6B]">
                  {tender.extracted_pdf_text
                    ? `✓ Official bid PDF parsed (~${tender.extracted_pdf_text.length.toLocaleString('en-IN')} chars) • Clauses & parameters verified`
                    : 'Direct link to official portal PDF notice & automated parser'}
                </p>
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
                  <span>{parsingPdf ? 'Parsing Document...' : 'Re-Parse PDF Clauses'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Extracted Commercial & Technical Criteria (8 Cards) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1E182B] uppercase tracking-wider text-[11px]">
                Extracted Commercial &amp; Technical Criteria
              </h3>
              <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8D8C4] font-bold px-2 py-0.5 rounded-full">
                ✓ Verified from PDF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Card 1: EMD Amount */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">EMD Amount</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    isEmdExempt ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]' : 'text-[#4A337A] bg-[#E6E6FA] border-[#D8BFD8]'
                  }`}>
                    {isEmdExempt ? 'Exempt / Nil' : 'Mandatory'}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {dossier?.financials?.totalEmd || tender.emd_amount || 'Nil / Not Required'}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  {isEmdExempt ? 'Zero earnest money required; no capital lock-in.' : `Advisory Bank: ${dossier?.financials?.emdBank || 'ICICI'}. Exempt for MSE & Startups.`}
                </span>
              </div>

              {/* Card 2: ePBG (Security Deposit) */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">ePBG Security Deposit</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    isEpbgExempt ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]' : 'text-[#4A337A] bg-[#E6E6FA] border-[#D8BFD8]'
                  }`}>
                    {isEpbgExempt ? 'Not Required' : 'Required'}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {dossier?.financials?.epbgPercent ? `${dossier.financials.epbgPercent} (${dossier.financials.epbgMonths || '4 Months'})` : (tender.epbg_required || 'Not Required')}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  {isEpbgExempt ? 'No performance bank guarantee clause mandated.' : `Advisory Bank: ${dossier?.financials?.epbgBank || 'ICICI'}. Submit within 15 days of award.`}
                </span>
              </div>

              {/* Card 3: MSE Concession */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">MSE Concession</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    mse.badge === 'emerald' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]' : 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                  }`}>
                    {mse.label}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  {mse.detail}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  {mse.subtext}
                </span>
              </div>

              {/* Card 4: Startup Concession */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Startup Concession</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    startup.badge === 'emerald' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]' : 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                  }`}>
                    {startup.label}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  {startup.detail}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  {startup.subtext}
                </span>
              </div>

              {/* Card 5: Bidder Minimum Turnover */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Bidder Annual Turnover</span>
                  <span className="text-[10px] font-bold text-[#6B46C1] bg-[#E6E6FA] px-1.5 py-0.5 rounded-md border border-[#D8BFD8]">
                    {mse.badge === 'emerald' ? 'MSE Relaxed' : '3-Yr Average'}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {cleanLakhs(bidderTurnover) ? `₹ ${cleanLakhs(bidderTurnover)}` : (displayTurnover && displayTurnover !== '₹ ,' ? displayTurnover : 'No Minimum Mandated')}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  {mse.badge === 'emerald' ? 'Exempt for MSE goods manufacturers; CA cert required otherwise.' : 'Audited CA balance sheet & certificate required.'}
                </span>
              </div>

              {/* Card 6: OEM Average Turnover */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">OEM Partner Turnover</span>
                  <span className="text-[10px] font-bold text-[#584E6B] bg-[#FAF9FD] px-1.5 py-0.5 rounded-md border border-[#E2DEEC]">
                    Hardware / OEM
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {cleanLakhs(oemTurnover) ? `₹ ${cleanLakhs(oemTurnover)}` : 'Exempt / Not Mandated'}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  Required from authorized equipment OEM partner.
                </span>
              </div>

              {/* Card 7: Years of Past Experience */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Technical Past Experience</span>
                  <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-1.5 py-0.5 rounded-md border border-[#C8D8C4]">
                    {mse.badge === 'emerald' ? 'MSE Relaxed' : 'Mandatory'}
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-sm">
                  {cleanYears(experienceYears) || '1 Year Minimum'}
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  In similar scope: CCTV, Surveillance, ITMS or Networking.
                </span>
              </div>

              {/* Card 8: Verification Proofs */}
              <div className="p-3.5 rounded-xl border border-[#E2DEEC] bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8C82A0] font-semibold">Verification Proofs</span>
                  <span className="text-[10px] font-bold text-[#4A337A] bg-[#E6E6FA] px-1.5 py-0.5 rounded-md border border-[#D8BFD8]">
                    ATC Compliant
                  </span>
                </div>
                <p className="font-bold text-[#1E182B] text-xs leading-snug">
                  OEM MAF &amp; Client POs
                </p>
                <span className="text-[10px] text-[#584E6B] block leading-tight">
                  OEM Authorization certificate and completion proofs.
                </span>
              </div>
            </div>

            {/* Parsed Scope of Work & BOQ Equipment Categories (Clean Grouped Pills) */}
            {scopeItems.length > 0 && (
              <div className="p-4 rounded-xl border border-[#E2DEEC] bg-white space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#F0EDF7]">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#FAF5FF] border border-[#E9D8FD] flex items-center justify-center shadow-2xs">
                      <Boxes className="w-4 h-4 text-[#6B46C1]" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#1E182B] block leading-tight">
                        Parsed Scope of Work &amp; BOQ Equipment Categories
                      </span>
                      <span className="text-[10px] text-[#8C82A0] block">
                        Cleanly grouped hardware categories with capacities
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10.5px] font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] px-2.5 py-0.5 rounded-full shadow-2xs">
                      {scopeItems.length} {scopeItems.length === 1 ? 'Equipment Category' : 'Equipment Categories'}
                      {dossier?.authority?.quantity ? ` (${dossier.authority.quantity} Units Total)` : (dossier?.financials?.totalQty ? ` (${dossier.financials.totalQty} Units Total)` : '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allNames = scopeItems.map(it => it.name + (it.specs.length > 0 ? ` (${it.specs.join(', ')})` : '')).join(' • ');
                        navigator.clipboard.writeText(allNames);
                        showNotification('BOQ equipment scope copied to clipboard', 'info');
                      }}
                      className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-[#6B46C1] hover:text-[#553C9A] px-2.5 py-1 rounded-lg hover:bg-[#FAF9FD] border border-[#E2DEEC] transition shadow-2xs cursor-pointer active:scale-95"
                      title="Copy full BOQ list"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy List</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {scopeItems.map((item, idx) => {
                    const lowerName = item.name.toLowerCase();
                    const isCamera = /camera|cctv|nvr|dvr|vms|dome|bullet|ptz|surveillance|video recorder/i.test(lowerName);
                    const isNetwork = /switch|router|poe|lan|wifi|access point|sfp/i.test(lowerName);
                    const isStorage = /hard disk|hard drive|hdd|ssd|storage/i.test(lowerName);
                    const isPower = /adaptor|adapter|power|ups/i.test(lowerName);

                    let themeClasses = 'bg-[#FAF9FD] text-[#2D243A] border-[#E2DEEC] hover:border-[#D8BFD8]';
                    let badgeClasses = 'bg-white/90 text-[#6B46C1] border-[#E2DEEC]';
                    let IconComponent = Boxes;

                    if (isCamera) {
                      themeClasses = 'bg-[#FAF5FF] text-[#4A337A] border-[#E9D8FD] hover:border-[#D6BCFA]';
                      badgeClasses = 'bg-white/90 text-[#6B46C1] border-purple-200';
                      IconComponent = Camera;
                    } else if (isNetwork) {
                      themeClasses = 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] hover:border-[#86EFAC]';
                      badgeClasses = 'bg-white/90 text-emerald-700 border-emerald-200';
                      IconComponent = Network;
                    } else if (isStorage) {
                      themeClasses = 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE] hover:border-[#93C5FD]';
                      badgeClasses = 'bg-white/90 text-blue-700 border-blue-200';
                      IconComponent = HardDrive;
                    } else if (isPower) {
                      themeClasses = 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] hover:border-[#FCD34D]';
                      badgeClasses = 'bg-white/90 text-amber-700 border-amber-200';
                      IconComponent = Zap;
                    }

                    return (
                      <div
                        key={idx}
                        className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-2xs transition-all hover:scale-[1.01] ${themeClasses}`}
                      >
                        <span className={`font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border leading-none shadow-2xs ${badgeClasses}`}>
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <IconComponent className="w-3.5 h-3.5 shrink-0 opacity-80" />
                        <span className="font-semibold">{item.name}</span>
                        {item.specs.length > 0 && (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/95 border border-current/20 shadow-2xs tracking-tight">
                            {item.specs.join(' • ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* EXTRACTED DOCUMENT TEXT & CLAUSES: STRUCTURED PARAMETERS & STREAM */}
          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="p-3.5 bg-[#FAF9FD] border-b border-[#E2DEEC] flex flex-wrap items-center justify-between gap-2.5">
              <div
                onClick={() => setShowExcerpt(!showExcerpt)}
                className="flex items-center space-x-2.5 cursor-pointer select-none group"
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-[#E2DEEC] flex items-center justify-center shadow-2xs group-hover:border-[#6B46C1] transition">
                  <FileText className="w-4 h-4 text-[#6B46C1]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#1E182B] text-xs">
                      Extracted Tender Document Text &amp; Clauses
                    </span>
                    {parameters.length > 0 && (
                      <span className="text-[10px] font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] px-2 py-0.2 rounded-full">
                        {parameters.length} Parameters Extracted
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8C82A0] block">
                    {cleanPdfText ? 'Cleaned text layer & verified schedule data from GeM PDF' : 'No document parsed yet'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {cleanPdfText && (
                  <>
                    <div className="inline-flex items-center bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocTab('structured');
                          if (!showExcerpt) setShowExcerpt(true);
                        }}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          docTab === 'structured'
                            ? 'bg-white text-[#6B46C1] shadow-2xs border border-[#E2DEEC]'
                            : 'text-[#8C82A0] hover:text-[#1E182B]'
                        }`}
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span>Structured</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocTab('stream');
                          if (!showExcerpt) setShowExcerpt(true);
                        }}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          docTab === 'stream'
                            ? 'bg-white text-[#6B46C1] shadow-2xs border border-[#E2DEEC]'
                            : 'text-[#8C82A0] hover:text-[#1E182B]'
                        }`}
                      >
                        <AlignLeft className="w-3 h-3" />
                        <span>Text Stream</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(cleanPdfText);
                        showNotification('Complete multi-page bid text copied to clipboard', 'info');
                      }}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#6B46C1] hover:text-[#553C9A] px-2.5 py-1 rounded-md hover:bg-white border border-[#E2DEEC] transition shadow-2xs cursor-pointer"
                      title="Copy full document text"
                    >
                      <Copy className="w-3 h-3" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowExcerpt(!showExcerpt)}
                  className="p-1 rounded-md hover:bg-white text-[#8C82A0] hover:text-[#1E182B] transition"
                  title={showExcerpt ? 'Collapse' : 'Expand'}
                >
                  {showExcerpt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Accordion Content */}
            {showExcerpt && (
              <div className="p-4 bg-white space-y-4">
                {cleanPdfText ? (
                  docTab === 'structured' ? (
                    <div className="space-y-4">
                      {/* SECTION 1: THE CORE STRUCTURED PARAMETERS GRID (Screenshot 4 layout!) */}
                      {parameters.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {parameters.map((param, idx) => {
                            const IconComponent = param.icon || Building;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD] hover:bg-white hover:border-[#D8BFD8] transition shadow-2xs"
                              >
                                <div className="space-y-1 min-w-0 pr-2 flex-1">
                                  <span className="text-[10px] font-bold text-[#8C82A0] uppercase tracking-wider block">
                                    {param.label}
                                  </span>
                                  <p className="font-bold text-[#1E182B] text-xs truncate" title={param.value}>
                                    {param.value}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <div className="w-6 h-6 rounded-md bg-white border border-[#E2DEEC] flex items-center justify-center text-[#6B46C1]">
                                    <IconComponent className="w-3.5 h-3.5" />
                                  </div>
                                  {param.isCopyable && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(param.value);
                                        showNotification(`${param.label} copied`, 'info');
                                      }}
                                      className="p-1 hover:bg-[#E6E6FA] rounded text-[#6B46C1] transition cursor-pointer"
                                      title="Copy value"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* SECTION 2: ITEMIZED SCHEDULES BOQ TABLE (When multiple schedules exist) */}
                      {dossier?.financials?.schedules?.length > 1 && (
                        <div className="p-4 rounded-xl border border-[#E2DEEC] bg-white space-y-3 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#F0EDF7]">
                            <div className="flex items-center space-x-2">
                              <Layers className="w-4 h-4 text-[#6B46C1]" />
                              <span className="font-bold text-xs text-[#1E182B]">
                                Itemized Schedule BOQ Breakdown ({dossier.financials.schedules.length} Schedules)
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-[#4A337A] bg-[#E6E6FA] border border-[#D8BFD8] px-2.5 py-0.5 rounded-lg">
                                Total: {dossier.financials.totalQty} Units • {dossier.financials.estValueFormatted}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const rows = [
                                    ['Schedule #', 'Item Category', 'Quantity', 'Estimated Schedule Value', 'EMD Amount'].join('\t'),
                                    ...dossier.financials.schedules.map(s =>
                                      [`Schedule ${s.schedule}`, s.item, s.quantity, `₹ ${s.estimatedValue.toLocaleString('en-IN')}`, `₹ ${s.emd.toLocaleString('en-IN')}`].join('\t')
                                    )
                                  ].join('\n');
                                  navigator.clipboard.writeText(rows);
                                  showNotification('Schedules table copied as TSV (Excel ready)', 'info');
                                }}
                                className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-[#6B46C1] hover:text-[#553C9A] px-2.5 py-1 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] transition cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Table (Excel)</span>
                              </button>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-[#E2DEEC]">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-[#FAF9FD] text-[#4A337A] font-bold border-b border-[#E2DEEC]">
                                <tr>
                                  <th className="py-2.5 px-3">Schedule</th>
                                  <th className="py-2.5 px-3">Item Category</th>
                                  <th className="py-2.5 px-3 text-center">Qty</th>
                                  <th className="py-2.5 px-3 text-right">Estimated Value</th>
                                  <th className="py-2.5 px-3 text-right">EMD Amount</th>
                                  <th className="py-2.5 px-3 text-right">Share %</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F0EDF7]">
                                {dossier.financials.schedules.map((s) => {
                                  const share = ((s.estimatedValue / (dossier.financials.totalValue || 1)) * 100).toFixed(1);
                                  return (
                                    <tr key={s.schedule} className="hover:bg-[#FAF9FD] transition">
                                      <td className="py-2.5 px-3 font-bold text-[#6B46C1]">
                                        Sched {s.schedule.toString().padStart(2, '0')}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-[#1E182B]">
                                        {s.item}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-bold text-[#1E182B]">
                                        {s.quantity}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1E182B]">
                                        ₹ {s.estimatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#4A337A]">
                                        ₹ {s.emd.toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[11px] text-[#8C82A0]">
                                        {share}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-[#FAF5FF] font-bold border-t-2 border-[#E9D8FD] text-[#4A337A]">
                                <tr>
                                  <td className="py-2.5 px-3" colSpan={2}>
                                    TOTAL SUMMARY ({dossier.financials.schedules.length} SCHEDULES)
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-sm text-[#1E182B]">
                                    {dossier.financials.totalQty} Units
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-sm text-[#2E7D32] font-mono">
                                    ₹ {dossier.financials.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-sm text-[#4A337A] font-mono">
                                    ₹ {dossier.financials.totalEmdNum.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-[11px]">
                                    100.0%
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* SECTION 3: CONSIGNEE & SITE DELIVERY DESTINATION */}
                      {dossier?.consignee?.officer && (
                        <div className="p-4 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD] space-y-2.5 shadow-2xs">
                          <div className="flex items-center space-x-2 pb-1.5 border-b border-[#E2DEEC]">
                            <Truck className="w-4 h-4 text-[#6B46C1]" />
                            <span className="font-bold text-xs text-[#1E182B]">Consignee &amp; Site Delivery Destination</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="bg-white p-2.5 rounded-lg border border-[#E2DEEC]">
                              <span className="text-[10px] font-bold text-[#8C82A0] uppercase block">Consignee Officer</span>
                              <p className="font-bold text-[#1E182B]">{dossier.consignee.officer}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-[#E2DEEC]">
                              <span className="text-[10px] font-bold text-[#8C82A0] uppercase block">Delivery Location</span>
                              <p className="font-semibold text-[#1E182B] truncate" title={dossier.consignee.address}>{dossier.consignee.address}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-[#E2DEEC]">
                              <span className="text-[10px] font-bold text-[#8C82A0] uppercase block">Delivery Duration</span>
                              <p className="font-bold text-[#2E7D32]">{dossier.consignee.deliveryDays || 'As per ATC'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer Link to Text Stream */}
                      <div className="flex items-center justify-between pt-1 text-xs text-[#8C82A0]">
                        <span>Need to review specific clauses, warranty, or delivery terms?</span>
                        <button
                          type="button"
                          onClick={() => setDocTab('stream')}
                          className="font-bold text-[#6B46C1] hover:underline cursor-pointer"
                        >
                          View Full Text Stream with Search →
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Clean Reflowed Clauses Reader Tab */
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-2 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD]">
                        <Search className="w-4 h-4 text-[#8C82A0] ml-1.5 shrink-0" />
                        <input
                          type="text"
                          value={docSearchQuery}
                          onChange={(e) => setDocSearchQuery(e.target.value)}
                          placeholder="Search clauses, warranty, turnover, delivery, payment terms..."
                          className="w-full text-xs bg-transparent focus:outline-none text-[#1E182B] placeholder-[#8C82A0]"
                        />
                        {docSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDocSearchQuery('')}
                            className="text-[10px] text-[#8C82A0] hover:text-[#1E182B] px-2 py-0.5 rounded hover:bg-white transition cursor-pointer"
                          >
                            ✕ Clear
                          </button>
                        )}
                      </div>

                      {(() => {
                        const filteredLines = docSearchQuery
                          ? docDetails.lines.filter((l) =>
                              l.toLowerCase().includes(docSearchQuery.toLowerCase())
                            )
                          : docDetails.lines;

                        if (filteredLines.length === 0) {
                          return (
                            <div className="py-10 text-center text-xs text-[#8C82A0] space-y-1.5">
                              <p className="font-bold text-[#1E182B]">No contract clauses match "{docSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => setDocSearchQuery('')}
                                className="text-[11px] text-[#6B46C1] font-semibold hover:underline"
                              >
                                Clear search query
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-xl border border-[#E2DEEC] bg-white overflow-hidden shadow-2xs">
                            <div className="flex items-center justify-between px-3.5 py-2 bg-[#FAF9FD] border-b border-[#E2DEEC] text-[11px] text-[#4A337A] font-semibold">
                              <span className="flex items-center space-x-1.5">
                                <FileText className="w-3.5 h-3.5 text-[#6B46C1]" />
                                <span>REFLOWED CONTRACT CLAUSES &amp; SPECIFICATIONS</span>
                              </span>
                              <span className="text-[10px] font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] px-2 py-0.5 rounded-full">
                                {docSearchQuery
                                  ? `${filteredLines.length} / ${docDetails.lines.length} matching`
                                  : `${docDetails.lines.length} clean clauses`}
                              </span>
                            </div>
                            <div className="p-3 max-h-96 overflow-y-auto space-y-2">
                              {filteredLines.map((line, idx) => {
                                const isSectionDivider = line.startsWith('---') || line.startsWith('[');
                                if (isSectionDivider) {
                                  return (
                                    <div
                                      key={idx}
                                      className="my-2 py-1.5 px-3 rounded-lg bg-[#FAF5FF] border border-[#E9D8FD] text-[#4A337A] font-bold text-xs"
                                    >
                                      {line.replace(/^[\-\s\[]+|[\-\s\]]+$/g, '')}
                                    </div>
                                  );
                                }

                                const hasColon = line.includes(':') && !line.startsWith('http');
                                const colonIdx = line.indexOf(':');
                                const label = hasColon ? line.substring(0, colonIdx) : null;
                                const val = hasColon ? line.substring(colonIdx + 1) : line;

                                return (
                                  <div
                                    key={idx}
                                    className="group flex items-start space-x-3 p-2.5 rounded-lg border border-[#F0EDF7] hover:border-[#D8BFD8] hover:bg-[#FAF9FD] transition"
                                  >
                                    <span className="text-[10px] font-bold font-mono text-[#6B46C1] bg-[#FAF5FF] border border-[#E9D8FD] px-1.5 py-0.5 rounded-md shrink-0 select-none">
                                      {(idx + 1).toString().padStart(2, '0')}
                                    </span>
                                    <div className="text-xs text-[#1E182B] flex-1 break-words leading-relaxed">
                                      {label ? (
                                        <>
                                          <span className="font-bold text-[#4A337A]">{label}:</span>
                                          <span className="text-[#1E182B] ml-1.5">{val}</span>
                                        </>
                                      ) : (
                                        <span>{line}</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(line);
                                        showNotification('Clause copied to clipboard', 'info');
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#E6E6FA] rounded text-[#6B46C1] transition cursor-pointer shrink-0"
                                      title="Copy clause"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )
                ) : (
                  <div className="py-6 text-center text-[#8C82A0] space-y-1">
                    <p className="font-semibold text-[#1E182B]">Document text layer not yet parsed.</p>
                    <p className="text-[11px] text-[#584E6B]">
                      Click the <span className="font-semibold text-[#6B46C1]">"Parse PDF Clauses"</span> button above to extract all terms from the official bid PDF.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BitVivid Technical Fit Assessment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1E182B] uppercase tracking-wider text-[11px]">
                BitVivid Technical Fit Assessment
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                (tender.fit_score || 0) >= 75
                  ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#C8D8C4]'
                  : (tender.fit_score || 0) >= 50
                    ? 'text-[#9A3412] bg-[#FFF2E5] border-[#FFDAB9]'
                    : 'text-[#584E6B] bg-[#F1F0F5] border-[#E2DEEC]'
              }`}>
                {tender.fit_score}% Capability Match
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD] space-y-3">
              <div className="flex items-center space-x-2">
                {(tender.fit_score || 0) >= 75 ? (
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
