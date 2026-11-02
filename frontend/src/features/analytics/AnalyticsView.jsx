import React from 'react';
import { useApp } from '../../context/AppContext';
import { BarChart3, PieChart, Tag, Building2, CheckCircle2, Users, Layers } from 'lucide-react';

export const AnalyticsView = () => {
  const { stats } = useApp();

  if (!stats) return <div className="text-center py-12 text-slate-400">Loading analytics...</div>;

  const total = stats.total_tenders || 1;
  const directPct = Math.round((stats.direct_fit_count / total) * 100);
  const partnerPct = Math.round((stats.partner_route_count / total) * 100);
  const reviewPct = 100 - directPct - partnerPct;

  return (
    <div className="space-y-6 w-full">
      {/* 1. Page Header Banner Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Analytics & Portfolio Insights
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Distribution of public opportunities across portals, domains, and partner readiness
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Direct Fit Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Direct Fit Ratio</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900">{directPct}%</h3>
          <p className="text-xs text-slate-500">{stats.direct_fit_count} of {total} total tenders</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${directPct}%` }}></div>
          </div>
        </div>

        {/* Partner Route Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase">SI / OEM Route</span>
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900">{partnerPct}%</h3>
          <p className="text-xs text-slate-500">{stats.partner_route_count} of {total} total tenders</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${partnerPct}%` }}></div>
          </div>
        </div>

        {/* Manual Review Ratio */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase">Manual Review</span>
            <PieChart className="w-5 h-5 text-slate-500" />
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900">{reviewPct}%</h3>
          <p className="text-xs text-slate-500">{stats.review_count} tenders need PDF check</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${reviewPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* Two Column Distributions (Balanced & Symmetrical) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Portal Distribution & Eligibility Breakdown */}
        <div className="space-y-6">
          {/* Portal Distribution */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Tenders by Portal</span>
            </div>

            <div className="space-y-3">
              {Object.entries(stats.portals_distribution || {}).map(([name, count]) => {
                const pCount = Math.round((count / total) * 100);
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span className="font-semibold">{name}</span>
                      <span className="font-bold text-slate-900">{count} ({pCount}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          name.toLowerCase().includes('gem') ? 'bg-amber-500' : 'bg-blue-600'
                        }`} 
                        style={{ width: `${Math.max(pCount, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Readiness & Matching Breakdown Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Readiness & Matching Breakdown</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-emerald-800">Potential Direct Fit (≥80%)</span>
                  <span className="font-bold text-slate-900">{stats.direct_fit_count} ({directPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${directPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-amber-800">SI / OEM Consortium Route</span>
                  <span className="font-bold text-slate-900">{stats.partner_route_count} ({partnerPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${partnerPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-slate-700">Requires Manual PDF Check</span>
                  <span className="font-bold text-slate-900">{stats.review_count} ({reviewPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${reviewPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Matched Keywords */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Tag className="w-4 h-4 text-blue-600" />
            <span>Top Matched Keywords</span>
          </div>

          <div className="space-y-2">
            {Object.entries(stats.top_keywords || {}).map(([kw, count]) => {
              return (
                <div key={kw} className="flex items-center justify-between py-1.5 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                    {kw}
                  </span>
                  <span className="font-bold text-slate-900">{count} bids</span>
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


