import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CheckCircle2, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  ExternalLink,
  Target,
  Building2
} from 'lucide-react';
import { tenderApi, exportApi } from '../../utils/api';
import { ContractDocuments } from '../../components/common/TenderBackground';
import { IndiaMap } from '../../components/common/IndiaMap';

export const DashboardView = () => {
  const { stats, setCurrentTab, openTenderDrawer } = useApp();
  const [urgentTenders, setUrgentTenders] = useState([]);
  const [highFitTenders, setHighFitTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true);
      try {
        const [urgentRes, fitRes] = await Promise.all([
          tenderApi.getTenders({ page: 1, limit: 5, sort_by: 'closing_date', sort_desc: false }),
          tenderApi.getTenders({ page: 1, limit: 5, eligibility: 'direct fit', sort_by: 'fit_score', sort_desc: true })
        ]);
        setUrgentTenders(urgentRes.data.items || []);
        setHighFitTenders(fitRes.data.items || []);
      } catch (e) {
        console.error('Failed to load dashboard highlights', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHighlights();
  }, []);

  // Sync dashboard cards when a tender is updated
  useEffect(() => {
    const handleUpdate = (e) => {
      const updated = e.detail;
      if (updated?.id) {
        setUrgentTenders((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
        setHighFitTenders((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      }
    };
    window.addEventListener('tender:updated', handleUpdate);
    return () => window.removeEventListener('tender:updated', handleUpdate);
  }, []);

  const cleanOrg = (org) => {
    if (!org) return 'Central Government Ministry';
    const primary = org.split('/')[0].split('-')[0].trim();
    return primary.length > 3 ? primary : org.split('/')[0].trim();
  };

  const formatClosing = (rawDate) => {
    if (!rawDate) return { date: 'Open', time: 'Active' };
    const parts = rawDate.split(' ');
    const dateStr = parts[0].replace(/-/g, ' ');
    const timeStr = parts.slice(1).join(' ');
    return { date: dateStr, time: timeStr };
  };

  return (
    <div className="space-y-4">
      {/* Top Banner - Executive Deep Navy with Stacked Contracts */}
      <div className="bg-gradient-to-r from-[#091b36] via-[#0d2a52] to-[#143d73] border border-blue-400/25 shadow-xl rounded-2xl p-5 text-white relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Banner Left Content */}
        <div className="relative z-10 max-w-2xl space-y-2.5">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI &amp; Government Tender Intelligence</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            BitVivid Opportunity Pipeline
          </h1>

          <p className="text-blue-100/90 text-xs leading-relaxed max-w-xl">
            Continuously discovering tenders across GeM BidPlus, CPPP, State Portals, and RailTel with automated
            eligibility matching against BitVivid's past projects &amp; certifications.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setCurrentTab('tenders')}
              className="px-3.5 py-2 bg-gradient-to-r from-[#b45309] to-[#d97706] hover:from-[#92400e] hover:to-[#b45309] text-white rounded-lg text-xs font-bold shadow-md shadow-amber-950/40 transition inline-flex items-center space-x-2"
            >
              <span>Explore All Tenders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <a
              href={exportApi.getExcelUrl()}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-lg text-xs font-semibold border border-slate-600/60 shadow-xs transition"
              download
            >
              Export Excel Report
            </a>
          </div>
        </div>

        {/* Banner Right: Official India Map alongside Stacked Contract Pages */}
        <div className="relative z-10 hidden md:flex items-center space-x-4 shrink-0 -my-3 pr-2">
          {/* Official Pan-India Procurement Radar Map */}
          <IndiaMap className="h-48 w-auto aspect-[612/696] drop-shadow-2xl" />

          {/* Stacked Official Contract Documents with Golden Seal */}
          <ContractDocuments className="h-44 w-auto aspect-[280/260] drop-shadow-xl" />
        </div>
      </div>

      {/* 4 Colored Glossy KPI Cards (Royal Blue, Emerald, Warm Amber, Midnight Navy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Tracked Tenders (Royal Blue) */}
        <div className="bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#1e40af] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-blue-900/25 flex items-center justify-between relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-blue-100/80">Tracked Tenders</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats?.total_tenders || 351}</h3>
            <p className="text-[11px] text-blue-100/70 mt-0.5">Across 8+ portals</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Potential Direct Fit (Emerald Green) */}
        <div className="bg-gradient-to-br from-[#065f46] via-[#0d766e] to-[#047857] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-emerald-950/25 flex items-center justify-between relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-100/80">Potential Direct Fit</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats?.direct_fit_count || 331}</h3>
            <p className="text-[11px] text-emerald-100/70 mt-0.5">High technical synergy</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: SI / OEM Route (Warm Amber / Gold) */}
        <div className="bg-gradient-to-br from-[#854d0e] via-[#b45309] to-[#d97706] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-amber-950/25 flex items-center justify-between relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-amber-100/80">SI / OEM Route</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats?.partner_route_count || 0}</h3>
            <p className="text-[11px] text-amber-100/70 mt-0.5">Consortium or OEM tie-up</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Deadlines < 7 Days (Glossy Crimson / Rose Red) */}
        <div className="bg-gradient-to-br from-[#991b1b] via-[#dc2626] to-[#b91c1c] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-rose-950/25 flex items-center justify-between relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-100/90">Deadlines &lt; 7 Days</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats?.closing_soon_7d || 44}</h3>
            <p className="text-[11px] text-rose-100/80 mt-0.5">{stats?.closing_soon_48h || 15} closing in 48h</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Direct Fits & Urgent Bids (Symmetrical, High Precision Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        
        {/* Direct Fit Opportunities Card */}
        <div className="bg-white/75 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/40 p-5 space-y-3.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">Top Direct Fit Opportunities</h2>
                <p className="text-[11px] text-slate-400 font-medium">Ranked by BitVivid technical capability synergy</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentTab('tenders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-blue-50/80 transition"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {highFitTenders.length > 0 ? (
              highFitTenders.map((t) => {
                const closing = formatClosing(t.closing_date);
                return (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="group p-3 rounded-xl bg-slate-50/60 hover:bg-white border border-slate-200/60 hover:border-blue-300 hover:shadow-xs transition duration-150 cursor-pointer flex items-center justify-between gap-3 h-[72px]"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                          {t.tender_id}
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                          {t.portal}
                        </span>
                      </div>
                      <h4 className="text-[12.5px] font-semibold text-slate-900 group-hover:text-blue-700 transition truncate mt-1">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate flex items-center space-x-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </p>
                    </div>

                    {/* Symmetrical Fixed-Width Status Column */}
                    <div className="w-28 shrink-0 text-right flex flex-col items-end justify-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full font-bold text-xs shadow-2xs">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>{t.fit_score}% Fit</span>
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-medium mt-1 truncate">
                        Closes {closing.date}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">No direct fit tenders found.</p>
            )}
          </div>
        </div>

        {/* Approaching Submission Deadlines Card */}
        <div className="bg-white/75 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/40 p-5 space-y-3.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">Approaching Submission Deadlines</h2>
                <p className="text-[11px] text-slate-400 font-medium">Priority bids closing in the next 7 days</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentTab('tenders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-blue-50/80 transition"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {urgentTenders.length > 0 ? (
              urgentTenders.map((t) => {
                const closing = formatClosing(t.closing_date);
                return (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="group p-3 rounded-xl bg-slate-50/60 hover:bg-white border border-slate-200/60 hover:border-rose-300 hover:shadow-xs transition duration-150 cursor-pointer flex items-center justify-between gap-3 h-[72px]"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                          {t.tender_id}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                          {t.portal}
                        </span>
                      </div>
                      <h4 className="text-[12.5px] font-semibold text-slate-900 group-hover:text-rose-700 transition truncate mt-1">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate flex items-center space-x-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </p>
                    </div>

                    {/* Symmetrical Fixed-Width Status Column */}
                    <div className="w-28 shrink-0 text-right flex flex-col items-end justify-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200/80 rounded-full font-bold text-xs shadow-2xs">
                        <Clock className="w-3 h-3 text-rose-600" />
                        <span>{closing.date}</span>
                      </span>
                      <span className="text-[10.5px] text-rose-600 font-semibold mt-1 truncate">
                        {closing.time || 'Closing Soon'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">No upcoming deadlines found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
