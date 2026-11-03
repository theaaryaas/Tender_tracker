import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CheckCircle2, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  Sparkles, 
  Building2
} from 'lucide-react';
import { tenderApi, exportApi } from '../../utils/api';
import { ContractDocuments } from '../../components/common/TenderBackground';
import { IndiaMap } from '../../components/common/IndiaMap';
import { UpcomingDeadlinesModal } from './UpcomingDeadlinesModal';
import { formatDeadline, sortTendersByDeadline } from '../../utils/dateUtils';

export const DashboardView = () => {
  const { stats, setCurrentTab, openTenderDrawer } = useApp();
  const [urgentTenders, setUrgentTenders] = useState([]);
  const [highFitTenders, setHighFitTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeadlinesModalOpen, setIsDeadlinesModalOpen] = useState(false);

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true);
      try {
        const [urgentRes, fitRes] = await Promise.all([
          tenderApi.getUpcomingDeadlines({ limit: 15, days: 7 }).catch(() => 
            tenderApi.getTenders({ page: 1, limit: 15, sort_by: 'closing_date', sort_desc: false })
          ),
          tenderApi.getTenders({ page: 1, limit: 5, eligibility: 'direct fit', sort_by: 'fit_score', sort_desc: true })
        ]);

        let deadlineList = [];
        if (urgentRes?.data?.items) {
          deadlineList = urgentRes.data.items.map(item => item.tender || item);
        }
        // Strictly sort chronologically so nearest deadline comes first
        deadlineList = sortTendersByDeadline(deadlineList, true).slice(0, 5);

        setUrgentTenders(deadlineList);
        setHighFitTenders(fitRes?.data?.items || []);
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
      {/* Top Banner - Lavender Dream Twilight with Stacked Contracts */}
      <div className="bg-gradient-to-r from-[#141021] via-[#241C3B] to-[#3B2961] border border-[#553C9A]/40 shadow-xl rounded-2xl p-6 text-white relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Banner Left Content */}
        <div className="relative z-10 max-w-2xl space-y-2.5">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-[#2E244D] text-[#D8BFD8] text-[11px] font-semibold border border-[#4E3D82]">
            <Sparkles className="w-3.5 h-3.5 text-[#FFDAB9]" />
            <span>AI &amp; Government Tender Intelligence</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            BitVivid Opportunity Pipeline
          </h1>

          <p className="text-[#E6E6FA]/90 text-xs leading-relaxed max-w-xl">
            Continuously discovering tenders across GeM BidPlus, CPPP, State Portals, and RailTel with automated
            eligibility matching against BitVivid's past projects &amp; certifications.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setCurrentTab('tenders')}
              className="px-3.5 py-2 bg-gradient-to-r from-[#6B46C1] to-[#805AD5] hover:from-[#553C9A] hover:to-[#6B46C1] text-white rounded-lg text-xs font-bold shadow-md shadow-purple-950/40 transition inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>Explore All Tenders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <a
              href={exportApi.getExcelUrl()}
              className="px-3.5 py-2 bg-[#26203A] hover:bg-[#322B4D] text-[#E6E6FA] rounded-lg text-xs font-semibold border border-[#3E355E] shadow-xs transition"
              download
            >
              Export Excel Report
            </a>
          </div>
        </div>

        {/* Banner Right: Official India Map alongside Stacked Contract Pages */}
        <div className="relative z-10 hidden md:flex items-center space-x-5 shrink-0 pr-3">
          {/* Official Pan-India Procurement Radar Map */}
          <IndiaMap className="h-44 w-auto aspect-[612/696] drop-shadow-2xl" />

          {/* Stacked Official Contract Documents with Golden Seal */}
          <ContractDocuments className="h-40 w-auto aspect-[280/260] drop-shadow-xl" />
        </div>
      </div>

      {/* 4 Colored KPI Cards (Lavender Dream Palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Tracked Tenders (Royal Iris / Lavender #E6E6FA) */}
        <div className="bg-gradient-to-br from-[#553C9A] via-[#6B46C1] to-[#7C3AED] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-purple-950/25 flex items-center justify-between h-[96px] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#E6E6FA]">Tracked Tenders</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5 leading-none">{stats?.total_tenders || 351}</h3>
            <p className="text-[11px] text-[#E6E6FA]/80 mt-1">Across 8+ portals</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Potential Direct Fit (Sage Mist #C8D8C4) */}
        <div className="bg-gradient-to-br from-[#2E5A36] via-[#386B42] to-[#468051] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-emerald-950/25 flex items-center justify-between h-[96px] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#C8D8C4]">Potential Direct Fit</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5 leading-none">{stats?.direct_fit_count || 331}</h3>
            <p className="text-[11px] text-[#C8D8C4]/80 mt-1">High technical synergy</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: SI / OEM Route (Warm Peach Puff #FFDAB9) */}
        <div className="bg-gradient-to-br from-[#8C4A1D] via-[#A85B24] to-[#C96E2E] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-amber-950/25 flex items-center justify-between h-[96px] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#FFDAB9]">SI / OEM Route</p>
            <h3 className="text-2xl font-extrabold text-white mt-0.5 leading-none">{stats?.partner_route_count || 0}</h3>
            <p className="text-[11px] text-[#FFDAB9]/80 mt-1">Consortium or OEM tie-up</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Deadlines < 7 Days (Muted Rose / Thistle #D8BFD8) */}
        <div 
          onClick={() => setIsDeadlinesModalOpen(true)}
          className="bg-gradient-to-br from-[#831843] via-[#9F1239] to-[#BE123C] text-white rounded-xl p-4 border border-white/20 shadow-md shadow-rose-950/25 flex items-center justify-between h-[96px] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-white/40 cursor-pointer hover:shadow-lg hover:brightness-105 transition-all group"
          title="Click to view all upcoming deadlines in popup"
        >
          <div>
            <div className="flex items-center space-x-1">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-100/90">Deadlines &lt; 7 Days</p>
              <ArrowRight className="w-3 h-3 text-rose-200 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="text-2xl font-extrabold text-white mt-0.5 leading-none">{stats?.closing_soon_7d || 44}</h3>
            <p className="text-[11px] text-rose-100/80 mt-1">{stats?.closing_soon_48h || 15} closing in 48h</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0 group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Direct Fits & Urgent Bids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        
        {/* Direct Fit Opportunities Card */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm p-5 space-y-3.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0EDF7]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E8F3E6] border border-[#C8D8C4] flex items-center justify-center text-[#2E7D32] shadow-2xs shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-[#1E182B] text-sm tracking-tight">Top Direct Fit Opportunities</h2>
                <p className="text-[11px] text-[#8C82A0] font-medium">Ranked by BitVivid technical capability synergy</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentTab('tenders')}
              className="text-xs text-[#6B46C1] hover:text-[#553C9A] font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-[#E6E6FA]/60 transition cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {highFitTenders.length > 0 ? (
              highFitTenders.map((t) => {
                const closing = formatClosing(t.closing_date);
                return (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="group p-3.5 rounded-xl bg-[#FAF9FD] hover:bg-white border border-[#E2DEEC] hover:border-[#D8BFD8] hover:shadow-xs transition duration-150 cursor-pointer flex items-center justify-between gap-4 min-h-[86px]"
                  >
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 min-h-[58px]">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10.5px] font-bold text-[#1E182B] bg-white px-2 py-0.5 rounded border border-[#E2DEEC] shadow-2xs">
                          {t.tender_id}
                        </span>
                        <span className="text-[10px] font-semibold text-[#4A337A] bg-[#E6E6FA] px-2 py-0.5 rounded-full border border-[#D8BFD8]">
                          {t.portal}
                        </span>
                      </div>
                      <h4 
                        className="text-[13px] font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition truncate leading-normal" 
                        title={t.title}
                      >
                        {t.title}
                      </h4>
                      <p className="text-xs text-[#584E6B] truncate flex items-center space-x-1.5 leading-normal">
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </p>
                    </div>

                    {/* Status Column */}
                    <div className="w-32 shrink-0 text-right flex flex-col items-end justify-center space-y-1.5">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#E8F3E6] text-[#244E2C] border border-[#C8D8C4] rounded-full font-bold text-xs shadow-2xs">
                        <Sparkles className="w-3 h-3 text-[#2E7D32]" />
                        <span>{t.fit_score}% Fit</span>
                      </span>
                      <span className="text-[11px] text-[#8C82A0] font-medium truncate">
                        Closes {closing.date}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#8C82A0] py-8 text-center">No direct fit tenders found.</p>
            )}
          </div>
        </div>

        {/* Approaching Submission Deadlines Card */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm p-5 space-y-3.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0EDF7]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFF2E5] border border-[#FFDAB9] flex items-center justify-center text-[#9A3412] shadow-2xs shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-[#1E182B] text-sm tracking-tight">Approaching Submission Deadlines</h2>
                <p className="text-[11px] text-[#8C82A0] font-medium">Priority bids closing soon, nearest deadline first</p>
              </div>
            </div>
            <button
              onClick={() => setIsDeadlinesModalOpen(true)}
              className="text-xs text-[#6B46C1] hover:text-[#553C9A] font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-[#E6E6FA]/60 transition cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {urgentTenders.length > 0 ? (
              urgentTenders.map((t) => {
                const deadline = formatDeadline(t.closing_date);

                let pillColor = 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9]';
                if (deadline.urgency === 'critical') {
                  pillColor = 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] font-extrabold';
                } else if (deadline.urgency === 'urgent') {
                  pillColor = 'bg-[#FFF2E5] text-[#9A3412] border-[#FFDAB9] font-bold';
                }

                return (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="group p-3.5 rounded-xl bg-[#FAF9FD] hover:bg-white border border-[#E2DEEC] hover:border-[#FFDAB9] hover:shadow-xs transition duration-150 cursor-pointer flex items-center justify-between gap-4 min-h-[86px]"
                  >
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 min-h-[58px]">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10.5px] font-bold text-[#1E182B] bg-white px-2 py-0.5 rounded border border-[#E2DEEC] shadow-2xs">
                          {t.tender_id}
                        </span>
                        <span className="text-[10px] font-semibold text-[#584E6B] bg-[#E6E6FA] px-2 py-0.5 rounded-full border border-[#D8BFD8]">
                          {t.portal}
                        </span>
                        {deadline.countdown && deadline.countdown !== 'Expired' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${pillColor}`}>
                            {deadline.countdown}
                          </span>
                        )}
                      </div>
                      <h4 
                        className="text-[13px] font-bold text-[#1E182B] group-hover:text-[#9A3412] transition truncate leading-normal"
                        title={t.title}
                      >
                        {t.title}
                      </h4>
                      <p className="text-xs text-[#584E6B] truncate flex items-center space-x-1.5 leading-normal">
                        <Building2 className="w-3.5 h-3.5 text-[#8C82A0] shrink-0" />
                        <span>{cleanOrg(t.organisation)}</span>
                      </p>
                    </div>

                    {/* Symmetrical Fixed-Width Status Column */}
                    <div className="w-32 shrink-0 text-right flex flex-col items-end justify-center space-y-1.5">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-bold text-xs shadow-2xs border ${pillColor}`}>
                        <Clock className="w-3 h-3 text-[#9A3412]" />
                        <span>{deadline.date}</span>
                      </span>
                      <span className="text-[11px] text-[#9A3412] font-bold truncate">
                        {deadline.time || 'Closing Soon'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#8C82A0] py-8 text-center">No upcoming deadlines found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines Pop-up Modal */}
      <UpcomingDeadlinesModal
        isOpen={isDeadlinesModalOpen}
        onClose={() => setIsDeadlinesModalOpen(false)}
        onSelectTender={openTenderDrawer}
      />
    </div>
  );
};

export default DashboardView;
