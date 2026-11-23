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
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* 1. Header Card (Lavender Dream Palette) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2DEEC] shadow-xs w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center space-x-3 sm:space-x-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0 mt-0.5 sm:mt-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Analytics &amp; Portfolio Insights
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs shrink-0">
                Real-Time Intelligence
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-[#584E6B] mt-1 leading-normal">
              Real-time distribution of public procurement opportunities across portals, domains, and partner readiness
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (Lavender Dream Color Palette - 2x2 on Mobile, 4x1 on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Direct Fit Ratio (Sage Mist #C8D8C4) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-3 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#244E2C] truncate">Direct Fit</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#E8F3E6] text-[#2E7D32] flex items-center justify-center border border-[#C8D8C4] shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1E182B]">{directPct}%</h3>
            <p className="text-[10px] sm:text-[11px] text-[#8C82A0] mt-0.5 truncate">{stats.direct_fit_count} of {total} qualified</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#2E7D32] h-1.5 rounded-full transition-all duration-500" style={{ width: `${directPct}%` }}></div>
          </div>
        </div>

        {/* Card 2: SI / Partner Route (Peach Puff #FFDAB9) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-3 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#9A3412] truncate">SI / OEM Route</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#FFF2E5] text-[#A85B24] flex items-center justify-center border border-[#FFDAB9] shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1E182B]">{partnerPct}%</h3>
            <p className="text-[10px] sm:text-[11px] text-[#8C82A0] mt-0.5 truncate">{stats.partner_route_count} consortium bids</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#A85B24] h-1.5 rounded-full transition-all duration-500" style={{ width: `${partnerPct}%` }}></div>
          </div>
        </div>

        {/* Card 3: Manual Review (Heather Slate #C3C1CD) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-3 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#584E6B] truncate">ATC / PDF Check</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#FAF9FD] text-[#584E6B] flex items-center justify-center border border-[#C3C1CD] shrink-0">
              <FileSearch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1E182B]">{reviewPct}%</h3>
            <p className="text-[10px] sm:text-[11px] text-[#8C82A0] mt-0.5 truncate">{stats.review_count} need ATC parse</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#8C82A0] h-1.5 rounded-full transition-all duration-500" style={{ width: `${reviewPct}%` }}></div>
          </div>
        </div>

        {/* Card 4: Total Tracked Pipeline (Royal Iris #6B46C1 / #E6E6FA) */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-3 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#3B2961] truncate">Total Bids</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#E6E6FA] text-[#6B46C1] flex items-center justify-center border border-[#D8BFD8] shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1E182B]">{total}</h3>
            <p className="text-[10px] sm:text-[11px] text-[#8C82A0] mt-0.5 truncate">Across 8 portals</p>
          </div>
          <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#6B46C1] h-1.5 rounded-full w-full"></div>
          </div>
        </div>
      </div>

      {/* 3. Symmetrical 2-Column Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
        
        {/* Left Column */}
        <div className="space-y-4 sm:space-y-5">
          {/* Card: Tenders by Portal */}
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7] gap-2">
              <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-xs sm:text-sm min-w-0">
                <Building2 className="w-4 h-4 text-[#6B46C1] shrink-0" />
                <span className="truncate">Tenders by Procurement Portal</span>
              </div>
              <span className="text-[11px] sm:text-xs text-[#8C82A0] font-mono shrink-0">8 Portals Active</span>
            </div>

            <div className="space-y-3 pt-1">
              {Object.entries(stats.portals_distribution || {}).map(([name, count]) => {
                const pCount = Math.round((count / total) * 100);
                const isGeM = name.toLowerCase().includes('gem');
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-medium text-[#584E6B] gap-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isGeM ? 'bg-[#A85B24]' : 'bg-[#6B46C1]'}`} />
                        <span className="font-semibold text-[#1E182B] truncate text-xs">{name}</span>
                      </div>
                      <span className="font-bold text-[#1E182B] font-mono text-[11px] sm:text-xs shrink-0">{count} bids ({pCount}%)</span>
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
          <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7] gap-2">
              <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-xs sm:text-sm min-w-0">
                <Layers className="w-4 h-4 text-[#2E7D32] shrink-0" />
                <span className="truncate">Technical Synergy &amp; Partner Tiers</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-start justify-between text-xs font-medium text-[#584E6B] gap-2">
                  <span className="font-semibold text-[#244E2C] leading-snug">Potential Direct Fit (≥80% Technical Match)</span>
                  <span className="font-bold text-[#1E182B] font-mono text-[11px] sm:text-xs shrink-0">{stats.direct_fit_count} ({directPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#2E7D32] h-2 rounded-full" style={{ width: `${directPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start justify-between text-xs font-medium text-[#584E6B] gap-2">
                  <span className="font-semibold text-[#9A3412] leading-snug">SI / OEM Consortium Route (&lt;80% or High Turnover)</span>
                  <span className="font-bold text-[#1E182B] font-mono text-[11px] sm:text-xs shrink-0">{stats.partner_route_count} ({partnerPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#A85B24] h-2 rounded-full" style={{ width: `${partnerPct}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start justify-between text-xs font-medium text-[#584E6B] gap-2">
                  <span className="font-semibold text-[#584E6B] leading-snug">Manual ATC Review Required</span>
                  <span className="font-bold text-[#1E182B] font-mono text-[11px] sm:text-xs shrink-0">{stats.review_count} ({reviewPct}%)</span>
                </div>
                <div className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#8C82A0] h-2 rounded-full" style={{ width: `${reviewPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Matched Keywords */}
        <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDF7] gap-2">
            <div className="flex items-center space-x-2 font-bold text-[#1E182B] text-xs sm:text-sm min-w-0">
              <Tag className="w-4 h-4 text-[#6B46C1] shrink-0" />
              <span className="truncate">Top AI Matched Discovery Keywords</span>
            </div>
            <span className="text-[11px] sm:text-xs text-[#8C82A0] font-mono shrink-0">Ranked by volume</span>
          </div>

          <div className="space-y-2 pt-1">
            {Object.entries(stats.top_keywords || {}).map(([kw, count], idx) => {
              const maxCount = Math.max(...Object.values(stats.top_keywords || { a: 1 }));
              const barWidth = Math.round((count / maxCount) * 100);

              return (
                <div key={kw} className="p-2 sm:p-2.5 rounded-xl bg-[#FAF9FD] hover:bg-[#E6E6FA]/40 border border-[#E2DEEC] transition flex items-center justify-between gap-2 sm:gap-3 text-xs">
                  <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
                    <span className="text-[10px] sm:text-[10.5px] font-mono font-bold text-[#8C82A0] w-4 sm:w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-[#1E182B] truncate text-xs sm:text-sm" title={kw}>
                      {kw}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                    <div className="w-14 sm:w-20 bg-[#E2DEEC] rounded-full h-1.5 overflow-hidden hidden xs:block sm:block">
                      <div className="bg-[#6B46C1] h-1.5 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="font-mono font-bold text-[#1E182B] bg-white border border-[#E2DEEC] px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] shadow-2xs shrink-0">
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
