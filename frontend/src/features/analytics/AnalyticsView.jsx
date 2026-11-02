import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  BarChart3, 
  PieChart, 
  Tag, 
  Building2, 
  CheckCircle2, 
  Users, 
  Layers, 
  Sparkles,
  TrendingUp,
  FileSearch,
  ExternalLink
} from 'lucide-react';

export const AnalyticsView = () => {
  const { stats, setCurrentTab } = useApp();

  if (!stats) return <div className="text-center py-12 text-slate-400">Loading analytics...</div>;

  const total = stats.total_tenders || 1;
  const directPct = Math.round((stats.direct_fit_count / total) * 100);
  const partnerPct = Math.round((stats.partner_route_count / total) * 100);
  const reviewPct = 100 - directPct - partnerPct;

  return (
    <div className="space-y-5 w-full">
      {/* 1. Solid Pure-White Header Card (High Contrast & Perfectly Aligned) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                Analytics &amp; Portfolio Insights
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                Real-Time Intelligence
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Real-time distribution of public procurement opportunities across portals, domains, and partner readiness
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Executive Metric Cards (4 Symmetrical Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Direct Fit Ratio */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Direct Fit Ratio</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{directPct}%</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{stats.direct_fit_count} of {total} tenders qualified</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${directPct}%` }}></div>
          </div>
        </div>

        {/* Card 2: SI / Partner Route */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">SI / OEM Route</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{partnerPct}%</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{stats.partner_route_count} tenders for consortium</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${partnerPct}%` }}></div>
          </div>
        </div>

        {/* Card 3: Manual Review */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">ATC / PDF Check</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileSearch className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{reviewPct}%</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{stats.review_count} tenders need ATC parse</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${reviewPct}%` }}></div>
          </div>
        </div>

        {/* Card 4: Total Tracked Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Total Tracked Bids</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{total}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Across 8 government portals</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-1.5 rounded-full w-full"></div>
          </div>
        </div>
      </div>

      {/* 3. Symmetrical 2-Column Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* Left Column: Portal Distribution & Qualification Matrix */}
        <div className="space-y-5">
          {/* Card: Tenders by Portal */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Tenders by Procurement Portal</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">8 Portals Active</span>
            </div>

            <div className="space-y-3 pt-1">
              {Object.entries(stats.portals_distribution || {}).map(([name, count]) => {
                const pCount = Math.round((count / total) * 100);
                const isGeM = name.toLowerCase().includes('gem');
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${isGeM ? 'bg-amber-500' : 'bg-blue-600'}`} />
                        <span className="font-semibold text-slate-800">{name}</span>
                      </div>
                      <span className="font-bold text-slate-900">{count} bids ({pCount}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isGeM ? 'bg-amber-500' : 'bg-blue-600'
                        }`} 
                        style={{ width: `${Math.max(pCount, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Technical Synergy Tiers */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Technical Synergy &amp; Partner Tiers</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-emerald-800">Potential Direct Fit (≥80% Technical Match)</span>
                  <span className="font-bold text-slate-900">{stats.direct_fit_count} ({directPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${directPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-amber-800">SI / OEM Consortium Route (&lt;80% or High Turnover)</span>
                  <span className="font-bold text-slate-900">{stats.partner_route_count} ({partnerPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${partnerPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-slate-600">Manual ATC Review Required</span>
                  <span className="font-bold text-slate-900">{stats.review_count} ({reviewPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${reviewPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Matched Keywords */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>Top AI Matched Discovery Keywords</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Ranked by volume</span>
          </div>

          <div className="space-y-2 pt-1">
            {Object.entries(stats.top_keywords || {}).map(([kw, count], idx) => {
              const maxCount = Math.max(...Object.values(stats.top_keywords || { a: 1 }));
              const barWidth = Math.round((count / maxCount) * 100);

              return (
                <div key={kw} className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="text-[10.5px] font-mono font-bold text-slate-400 w-5">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 truncate">
                      {kw}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden hidden sm:block">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                      {count} bids
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsView;
