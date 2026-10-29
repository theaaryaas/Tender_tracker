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
  Star
} from 'lucide-react';
import { tenderApi, exportApi } from '../../utils/api';

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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/10 skew-x-12 pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI & Government Tender Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BitVivid Opportunity Pipeline</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Continuously discovering tenders across GeM BidPlus, CPPP, State Portals, and RailTel with automated eligibility matching against BitVivid's past projects & certifications.
          </p>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={() => setCurrentTab('tenders')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition inline-flex items-center space-x-2"
            >
              <span>Explore All Tenders</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href={exportApi.getExcelUrl()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
              download
            >
              Export Excel Report
            </a>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bids */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracked Tenders</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_tenders || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Across 8+ portals</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Potential Direct Fit */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Potential Direct Fit</p>
            <h3 className="text-2xl font-bold text-emerald-700 mt-1">{stats?.direct_fit_count || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">High technical synergy</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* SI Partner Opportunities */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">SI / OEM Route</p>
            <h3 className="text-2xl font-bold text-amber-700 mt-1">{stats?.partner_route_count || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Consortium or OEM tie-up</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Closing Soon */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Deadlines &lt; 7 Days</p>
            <h3 className="text-2xl font-bold text-rose-700 mt-1">{stats?.closing_soon_7d || 0}</h3>
            <p className="text-xs text-rose-500 font-medium mt-1">{stats?.closing_soon_48h || 0} closing in 48h</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Direct Fits & Urgent Bids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Direct Fit Opportunities */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800 text-base">Top Direct Fit Opportunities</h2>
            </div>
            <button
              onClick={() => setCurrentTab('tenders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {highFitTenders.length > 0 ? (
              highFitTenders.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTenderDrawer(t)}
                  className="py-3.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition cursor-pointer flex items-start justify-between space-x-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                        {t.tender_id}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{t.portal}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{t.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{t.organisation}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-xs">
                      {t.fit_score}% Fit
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">{t.closing_date ? t.closing_date.split(' ')[0] : 'Open'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No tenders found.</p>
            )}
          </div>
        </div>

        {/* Approaching Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-rose-600" />
              <h2 className="font-bold text-slate-800 text-base">Approaching Submission Deadlines</h2>
            </div>
            <button
              onClick={() => setCurrentTab('tenders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {urgentTenders.length > 0 ? (
              urgentTenders.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTenderDrawer(t)}
                  className="py-3.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition cursor-pointer flex items-start justify-between space-x-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {t.tender_id}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{t.portal}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{t.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{t.organisation}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded font-semibold text-xs">
                      {t.closing_date || 'Check portal'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">{t.status}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No upcoming deadlines found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

