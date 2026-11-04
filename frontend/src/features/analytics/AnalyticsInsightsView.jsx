import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  BarChart3, 
  Tag, 
  Building2, 
  CheckCircle2, 
  Users, 
  Layers, 
  TrendingUp,
  FileSearch
} from 'lucide-react';

export const AnalyticsInsightsView = () => {
  const { stats } = useApp();

  if (!stats) return <div className="text-center py-12 text-[#8C82A0]">Loading analytics...</div>;

  const total = stats.total_tenders || 1;
  const directPct = Math.round((stats.direct_fit_count / total) * 100);
  const partnerPct = Math.round((stats.partner_route_count / total) * 100);
  const reviewPct = 100 - directPct - partnerPct;

  return (
    <div className="space-y-5 w-full">
      {/* 1. Header Card (Lavender Dream Palette) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Analytics &amp; Portfolio Insights
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs">
                Real-Time Intelligence
              </span>
            </div>
            <p className="text-xs font-medium text-[#584E6B] mt-1">
              Real-time distribution of public procurement opportunities across portals, domains, and partner readiness
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (Lavender Dream Color Palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Direct Fit Ratio (Sage Mist #C8D8C4) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#244E2C]">Direct Fit Ratio</span>
            <div className="w-7 h-7 rounded-lg bg-[#E8F3E6] text-[#2E7D32] flex items-center justify-center border border-[#C8D8C4]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1E182B]">{directPct}%</h3>
            <p className="text-[11px] text-[#8C82A0] mt-0.5">{stats.direct_fit_count} of {total} tenders qualified</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#2E7D32] h-1.5 rounded-full transition-all duration-500" style={{ width: `${directPct}%` }}></div>
          </div>
        </div>

        {/* Card 2: SI / Partner Route (Peach Puff #FFDAB9) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A3412]">SI / OEM Route</span>
            <div className="w-7 h-7 rounded-lg bg-[#FFF2E5] text-[#A85B24] flex items-center justify-center border border-[#FFDAB9]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1E182B]">{partnerPct}%</h3>
            <p className="text-[11px] text-[#8C82A0] mt-0.5">{stats.partner_route_count} tenders for consortium</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#A85B24] h-1.5 rounded-full transition-all duration-500" style={{ width: `${partnerPct}%` }}></div>
          </div>
        </div>

        {/* Card 3: Manual Review (Heather Slate #C3C1CD) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#584E6B]">ATC / PDF Check</span>
            <div className="w-7 h-7 rounded-lg bg-[#FAF9FD] text-[#584E6B] flex items-center justify-center border border-[#C3C1CD]">
              <FileSearch className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1E182B]">{reviewPct}%</h3>
            <p className="text-[11px] text-[#8C82A0] mt-0.5">{stats.review_count} tenders need ATC parse</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#8C82A0] h-1.5 rounded-full transition-all duration-500" style={{ width: `${reviewPct}%` }}></div>
          </div>
        </div>

        {/* Card 4: Total Tracked Pipeline (Royal Iris #6B46C1 / #E6E6FA) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#3B2961]">Total Tracked Bids</span>
            <div className="w-7 h-7 rounded-lg bg-[#E6E6FA] text-[#6B46C1] flex items-center justify-center border border-[#D8BFD8]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1E182B]">{total}</h3>
            <p className="text-[11px] text-[#8C82A0] mt-0.5">Across 8 government portals</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#6B46C1] h-1.5 rounded-full w-full"></div>
          </div>
        </div>
      </div>

      {/* 3. Symmetrical 2-Column Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* Left Column */}
        <div className="space-y-5">
          {/* Card: Tenders by Portal */}
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7]">
              <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-sm">
                <Building2 className="w-4 h-4 text-[#6B46C1]" />
                <span>Tenders by Procurement Portal</span>
              </div>
              <span className="text-xs text-[#8C82A0] font-mono">8 Portals Active</span>
            </div>

            <div className="space-y-3 pt-1">
              {Object.entries(stats.portals_distribution || {}).map(([name, count]) => {
                const pCount = Math.round((count / total) * 100);
                const isGeM = name.toLowerCase().includes('gem');
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-[#584E6B]">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${isGeM ? 'bg-[#A85B24]' : 'bg-[#6B46C1]'}`} />
                        <span className="font-semibold text-[#1E182B]">{name}</span>
                      </div>
                      <span className="font-bold text-[#1E182B] font-mono">{count} bids ({pCount}%)</span>
                    </div>
                    <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isGeM ? 'bg-[#A85B24]' : 'bg-[#6B46C1]'
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
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7]">
              <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-sm">
                <Layers className="w-4 h-4 text-[#2E7D32]" />
                <span>Technical Synergy &amp; Partner Tiers</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-[#584E6B]">
                  <span className="font-semibold text-[#244E2C]">Potential Direct Fit (≥80% Technical Match)</span>
                  <span className="font-bold text-[#1E182B] font-mono">{stats.direct_fit_count} ({directPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#2E7D32] h-2 rounded-full" style={{ width: `${directPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-[#584E6B]">
                  <span className="font-semibold text-[#9A3412]">SI / OEM Consortium Route (&lt;80% or High Turnover)</span>
                  <span className="font-bold text-[#1E182B] font-mono">{stats.partner_route_count} ({partnerPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#A85B24] h-2 rounded-full" style={{ width: `${partnerPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-[#584E6B]">
                  <span className="font-semibold text-[#584E6B]">Manual ATC Review Required</span>
                  <span className="font-bold text-[#1E182B] font-mono">{stats.review_count} ({reviewPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#8C82A0] h-2 rounded-full" style={{ width: `${reviewPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Matched Keywords */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7]">
            <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-sm">
              <Tag className="w-4 h-4 text-[#6B46C1]" />
              <span>Top AI Matched Discovery Keywords</span>
            </div>
            <span className="text-xs text-[#8C82A0] font-mono">Ranked by volume</span>
          </div>

          <div className="space-y-2 pt-1">
            {Object.entries(stats.top_keywords || {}).map(([kw, count], idx) => {
              const maxCount = Math.max(...Object.values(stats.top_keywords || { a: 1 }));
              const barWidth = Math.round((count / maxCount) * 100);

              return (
                <div key={kw} className="p-2.5 rounded-xl bg-[#FAF9FD] hover:bg-[#E6E6FA]/40 border border-[#E2DEEC] transition flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="text-[10.5px] font-mono font-bold text-[#8C82A0] w-5">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-[#1E182B] truncate">
                      {kw}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="w-20 bg-[#E2DEEC] rounded-full h-1.5 overflow-hidden hidden sm:block">
                      <div className="bg-[#6B46C1] h-1.5 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="font-mono font-bold text-[#1E182B] bg-white border border-[#E2DEEC] px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
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

export default AnalyticsInsightsView;
export { AnalyticsInsightsView as AnalyticsView };
