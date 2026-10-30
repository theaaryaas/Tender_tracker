import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  ListFilter, 
  Kanban, 
  RefreshCw, 
  BarChart3, 
  Sliders 
} from 'lucide-react';

export const Sidebar = () => {
  const { currentTab, setCurrentTab, stats } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenders', label: 'Tenders Pipeline', icon: ListFilter, badge: stats?.total_tenders || 351 },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban },
    { id: 'sync', label: 'Sync Center', icon: RefreshCw },
    { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3 },
    { id: 'settings', label: 'Company Settings', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-[#071527] text-slate-300 flex flex-col justify-between shrink-0 h-[calc(100vh-5.5rem)] sticky top-[4.75rem] rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden my-3 ml-3 z-20 self-start">
      
      {/* Top Nav Items */}
      <div className="p-4 space-y-1 relative z-10 overflow-y-auto">
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active 
                    ? 'bg-gradient-to-r from-amber-900/40 via-amber-700/30 to-amber-600/40 border border-amber-400/60 text-amber-100 shadow-lg shadow-amber-950/40' 
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shadow-xs ${
                    active 
                      ? 'bg-amber-600/60 text-amber-100 border border-amber-400/60' 
                      : 'bg-amber-600/30 text-amber-200 border border-amber-400/50'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* LOWER SECTION: Classical Pillars + Official Navy Contract Certificate (Docked Sticky Visual) */}
      <div className="relative w-full h-56 mt-auto shrink-0 overflow-hidden pointer-events-none select-none z-0">
        <svg viewBox="0 0 240 220" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Gradients */}
            <linearGradient id="sb-contract-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0c1e3d" />
              <stop offset="50%" stopColor="#08152b" />
              <stop offset="100%" stopColor="#040b17" />
            </linearGradient>

            <linearGradient id="sb-gold-seal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            <filter id="sb-doc-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="-2" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* 1. CLASSICAL GOVERNMENT PILLAR BUILDING / MINISTRY PORTICO (Left Side) */}
          <g transform="translate(10, 50)" opacity="0.38" stroke="#38bdf8">
            {/* Triangular Pediment (Roof) */}
            <polygon points="5,35 60,8 115,35" strokeWidth="1.5" fill="none" />
            <polygon points="12,33 60,12 108,33" strokeWidth="0.8" fill="none" strokeDasharray="3,2" />
            
            {/* Entablature / Architrave Beams */}
            <rect x="5" y="35" width="110" height="7" strokeWidth="1.2" fill="none" />
            <line x1="5" y1="39" x2="115" y2="39" strokeWidth="0.6" />

            {/* 4 Classical Fluted Columns / Pillars */}
            {/* Column 1 */}
            <g transform="translate(12, 42)">
              <rect x="0" y="0" width="16" height="4" strokeWidth="1" fill="none" />
              <line x1="2" y1="4" x2="2" y2="95" strokeWidth="0.8" />
              <line x1="6" y1="4" x2="6" y2="95" strokeWidth="0.8" />
              <line x1="10" y1="4" x2="10" y2="95" strokeWidth="0.8" />
              <line x1="14" y1="4" x2="14" y2="95" strokeWidth="0.8" />
              <rect x="0" y="95" width="16" height="5" strokeWidth="1" fill="none" />
            </g>

            {/* Column 2 */}
            <g transform="translate(38, 42)">
              <rect x="0" y="0" width="16" height="4" strokeWidth="1" fill="none" />
              <line x1="2" y1="4" x2="2" y2="95" strokeWidth="0.8" />
              <line x1="6" y1="4" x2="6" y2="95" strokeWidth="0.8" />
              <line x1="10" y1="4" x2="10" y2="95" strokeWidth="0.8" />
              <line x1="14" y1="4" x2="14" y2="95" strokeWidth="0.8" />
              <rect x="0" y="95" width="16" height="5" strokeWidth="1" fill="none" />
            </g>

            {/* Column 3 */}
            <g transform="translate(64, 42)">
              <rect x="0" y="0" width="16" height="4" strokeWidth="1" fill="none" />
              <line x1="2" y1="4" x2="2" y2="95" strokeWidth="0.8" />
              <line x1="6" y1="4" x2="6" y2="95" strokeWidth="0.8" />
              <line x1="10" y1="4" x2="10" y2="95" strokeWidth="0.8" />
              <line x1="14" y1="4" x2="14" y2="95" strokeWidth="0.8" />
              <rect x="0" y="95" width="16" height="5" strokeWidth="1" fill="none" />
            </g>

            {/* Column 4 */}
            <g transform="translate(90, 42)">
              <rect x="0" y="0" width="16" height="4" strokeWidth="1" fill="none" />
              <line x1="2" y1="4" x2="2" y2="95" strokeWidth="0.8" />
              <line x1="6" y1="4" x2="6" y2="95" strokeWidth="0.8" />
              <line x1="10" y1="4" x2="10" y2="95" strokeWidth="0.8" />
              <line x1="14" y1="4" x2="14" y2="95" strokeWidth="0.8" />
              <rect x="0" y="95" width="16" height="5" strokeWidth="1" fill="none" />
            </g>

            {/* Plinth / Steps */}
            <rect x="2" y="142" width="116" height="8" strokeWidth="1.2" fill="none" />
            <rect x="-2" y="150" width="124" height="6" strokeWidth="1" fill="none" />
          </g>

          {/* 3. ANGLED DARK NAVY OFFICIAL CONTRACT DOCUMENT (Right Side, Overlapping Pillars) */}
          <g transform="translate(95, 38) rotate(9 65 85)" filter="url(#sb-doc-shadow)">
            {/* Dark Navy Certificate Paper */}
            <rect
              x="0"
              y="0"
              width="130"
              height="165"
              rx="5"
              fill="url(#sb-contract-bg)"
              stroke="#1e3a8a"
              strokeWidth="1.2"
            />

            {/* Guilloche / Hairline Inner Border */}
            <rect
              x="5"
              y="5"
              width="120"
              height="155"
              rx="3"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.7"
              strokeOpacity="0.45"
            />
            <rect
              x="8"
              y="8"
              width="114"
              height="149"
              rx="2"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="0.4"
              strokeOpacity="0.3"
              strokeDasharray="3,2"
            />

            {/* Official Header Crest & Typography */}
            <circle cx="65" cy="22" r="6" stroke="#93c5fd" strokeWidth="0.8" strokeOpacity="0.7" fill="#071527" />
            <text x="65" y="24.5" textAnchor="middle" fill="#93c5fd" fontSize="5.5" fontWeight="bold">⚖</text>
            <text
              x="65"
              y="37"
              textAnchor="middle"
              fill="#bfdbfe"
              fontSize="9"
              fontWeight="bold"
              fontFamily="serif"
              letterSpacing="2"
            >
              CONTRACT
            </text>
            <line x1="38" y1="42" x2="92" y2="42" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.6" />

            {/* Ruled Body Lines in Blue/Cyan Tone */}
            <line x1="16" y1="52" x2="114" y2="52" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.4" />
            <line x1="16" y1="60" x2="114" y2="60" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.35" />
            <line x1="16" y1="68" x2="105" y2="68" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="16" y1="76" x2="114" y2="76" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="16" y1="84" x2="100" y2="84" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="16" y1="92" x2="114" y2="92" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="16" y1="100" x2="95" y2="100" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />

            {/* Signatures */}
            <line x1="20" y1="140" x2="55" y2="140" stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
            <text x="20" y="146" fill="#64748b" fontSize="4.5" fontFamily="sans-serif">Authorized Seal</text>

            {/* CIRCULAR GOLDEN WATERMARK SEAL (Bottom Left of Contract) */}
            <g transform="translate(32, 122)">
              {/* Gold outer rim */}
              <circle cx="0" cy="0" r="16" fill="url(#sb-gold-seal)" stroke="#78350f" strokeWidth="1" />
              {/* Concentric rings */}
              <circle cx="0" cy="0" r="13" fill="none" stroke="#fef08a" strokeWidth="0.7" strokeDasharray="2,2" />
              <circle cx="0" cy="0" r="11" fill="url(#sb-gold-seal)" stroke="#b45309" strokeWidth="0.7" />
              {/* Inner Crest Star */}
              <text x="0" y="3" textAnchor="middle" fill="#78350f" fontSize="7" fontWeight="bold">
                ★
              </text>
              <circle cx="0" cy="0" r="7" fill="none" stroke="#fde047" strokeWidth="0.5" />
              {/* Specular highlight */}
              <ellipse cx="-4" cy="-5" rx="4" ry="2" transform="rotate(-30 -4 -5)" fill="#ffffff" opacity="0.4" />
            </g>
          </g>
        </svg>
      </div>
    </aside>
  );
};

export default Sidebar;
