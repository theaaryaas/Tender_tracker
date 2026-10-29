import React from 'react';
import { useApp } from '../../context/AppContext';
import { BarChart3, PieChart, Tag, Building2, CheckCircle2, Users } from 'lucide-react';

export const AnalyticsView = () => {
  const { stats } = useApp();

  if (!stats) return <div className="text-center py-12 text-slate-400">Loading analytics...</div>;

  const total = stats.total_tenders || 1;
  const directPct = Math.round((stats.direct_fit_count / total) * 100);
  const partnerPct = Math.round((stats.partner_route_count / total) * 100);
  const reviewPct = 100 - directPct - partnerPct;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Analytics & Portfolio Insights</h2>
        <p className="text-xs text-slate-500">Distribution of public opportunities across portals, domains, and partner readiness</p>
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

      {/* Two Column Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
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
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{name}</span>
                    <span className="font-bold text-slate-900">{count} ({pCount}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pCount}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Keyword Frequency */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Top Matched Keywords</span>
          </div>

          <div className="space-y-3">
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

