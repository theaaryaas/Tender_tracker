import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  ListFilter, 
  Kanban, 
  RefreshCw, 
  BarChart3, 
  Sliders,
  X 
} from 'lucide-react';

const SidebarPillarsGraphic = () => (
  <div className="relative w-full h-56 mt-auto shrink-0 overflow-hidden pointer-events-none select-none z-0">
    <svg viewBox="0 0 240 220" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Gradients in Lavender Dream */}
        <linearGradient id="sb-contract-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#221A38" />
          <stop offset="50%" stopColor="#191329" />
          <stop offset="100%" stopColor="#0F0B1A" />
        </linearGradient>

        <linearGradient id="sb-gold-seal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFDAB9" />
          <stop offset="40%" stopColor="#D8BFD8" />
          <stop offset="75%" stopColor="#B794F4" />
          <stop offset="100%" stopColor="#6B46C1" />
        </linearGradient>

        <filter id="sb-doc-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-2" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* 1. CLASSICAL CONSTITUTIONAL GOVERNMENT PILLAR BUILDING / MINISTRY PORTICO (Left Side) */}
      <g transform="translate(10, 50)" opacity="0.45" stroke="#D8BFD8">
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

      {/* 2. ANGLED OFFICIAL CONTRACT DOCUMENT (Right Side, Overlapping Pillars) */}
      <g transform="translate(95, 38) rotate(9 65 85)" filter="url(#sb-doc-shadow)">
        {/* Certificate Paper */}
        <rect
          x="0"
          y="0"
          width="130"
          height="175"
          rx="5"
          fill="url(#sb-contract-bg)"
          stroke="#6B46C1"
          strokeWidth="1.2"
        />
        
        {/* Fine Guilloché / Border Inset */}
        <rect
          x="5"
          y="5"
          width="120"
          height="165"
          rx="3"
          fill="none"
          stroke="#D8BFD8"
          strokeWidth="0.6"
          strokeDasharray="4,2"
          opacity="0.6"
        />

        {/* Header Serif Typography */}
        <text
          x="65"
          y="24"
          textAnchor="middle"
          fill="#E6E6FA"
          fontSize="8"
          fontWeight="bold"
          letterSpacing="1.5"
          fontFamily="serif"
        >
          CONTRACT
        </text>

        {/* Header Accent Bar */}
        <line x1="20" y1="32" x2="110" y2="32" stroke="#6B46C1" strokeWidth="1" />

        {/* Ruled Body Lines in Lavender & Sage Tones */}
        <line x1="16" y1="52" x2="114" y2="52" stroke="#E6E6FA" strokeWidth="1.2" strokeOpacity="0.4" />
        <line x1="16" y1="60" x2="114" y2="60" stroke="#D8BFD8" strokeWidth="1" strokeOpacity="0.35" />
        <line x1="16" y1="68" x2="105" y2="68" stroke="#D8BFD8" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="16" y1="76" x2="114" y2="76" stroke="#C8D8C4" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="16" y1="84" x2="100" y2="84" stroke="#D8BFD8" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="16" y1="92" x2="114" y2="92" stroke="#E6E6FA" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="16" y1="100" x2="95" y2="100" stroke="#D8BFD8" strokeWidth="1" strokeOpacity="0.3" />

        {/* Signatures */}
        <line x1="20" y1="140" x2="55" y2="140" stroke="#8C82A0" strokeWidth="0.8" strokeDasharray="3,2" />
        <text x="20" y="146" fill="#8C82A0" fontSize="4.5" fontFamily="sans-serif">Authorized Seal</text>

        {/* CIRCULAR GOLDEN WATERMARK SEAL (Bottom Left of Contract) */}
        <g transform="translate(32, 122)">
          {/* Outer Rim */}
          <circle cx="0" cy="0" r="16" fill="url(#sb-gold-seal)" stroke="#6B46C1" strokeWidth="1" />
          {/* Concentric rings */}
          <circle cx="0" cy="0" r="13" fill="none" stroke="#FFDAB9" strokeWidth="0.7" strokeDasharray="2,2" />
          <circle cx="0" cy="0" r="11" fill="url(#sb-gold-seal)" stroke="#553C9A" strokeWidth="0.7" />
          {/* Inner Crest Star */}
          <text x="0" y="3" textAnchor="middle" fill="#FAF9FD" fontSize="7" fontWeight="bold">
            ★
          </text>
          <circle cx="0" cy="0" r="7" fill="none" stroke="#FFDAB9" strokeWidth="0.5" />
          {/* Specular highlight */}
          <ellipse cx="-4" cy="-5" rx="4" ry="2" transform="rotate(-30 -4 -5)" fill="#ffffff" opacity="0.45" />
        </g>
      </g>
    </svg>
  </div>
);

export const Sidebar = () => {
  const { currentTab, setCurrentTab, stats, isMobileSidebarOpen, setIsMobileSidebarOpen } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenders', label: 'All Tenders', icon: ListFilter, badge: stats?.total_tenders || 351 },
    { id: 'kanban', label: 'Bid Pipeline', icon: Kanban },
    { id: 'sync', label: 'Sync Center', icon: RefreshCw },
    { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3 },
    { id: 'settings', label: 'Company Settings', icon: Sliders },
  ];

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (setIsMobileSidebarOpen) setIsMobileSidebarOpen(false);
  };

  const renderNavButtons = () => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              active 
                ? 'bg-[#6B46C1] border border-[#D8BFD8]/50 text-white shadow-lg shadow-purple-950/40' 
                : 'text-[#C3C1CD] hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Icon className={`w-4 h-4 ${active ? 'text-[#FFDAB9]' : 'text-[#8C82A0]'}`} />
              <span className="tracking-tight">{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-xs ${
                active 
                  ? 'bg-[#553C9A] text-white border border-[#D8BFD8]/40' 
                  : 'bg-[#241C3B] text-[#D8BFD8] border border-[#3E3260]'
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#141021] text-[#C3C1CD] flex-col shrink-0 h-[calc(100vh-5.5rem)] sticky top-[4.75rem] rounded-2xl border border-[#26203B] shadow-2xl relative overflow-hidden my-3 ml-3 z-20 self-start justify-between">
        <div className="p-4 space-y-1 relative z-10 overflow-y-auto">
          {renderNavButtons()}
        </div>
        <SidebarPillarsGraphic />
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#141021]/70 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <aside 
            className="w-72 max-w-[85vw] bg-[#141021] text-[#C3C1CD] h-full flex flex-col justify-between border-r border-[#26203B] shadow-2xl relative overflow-hidden animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-2 relative z-10 overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10 pb-3">
                <div 
                  onClick={() => {
                    setCurrentTab('dashboard');
                    if (setIsMobileSidebarOpen) setIsMobileSidebarOpen(false);
                  }}
                  className="flex items-center cursor-pointer select-none group px-1 py-1"
                  title="BitVivid Solutions"
                >
                  <img 
                    src="/bitvivid-brand.png" 
                    alt="BitVivid Solutions" 
                    className="h-7 max-h-8 w-auto object-contain brightness-0 invert opacity-95 transition group-hover:opacity-100" 
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-xl text-[#8C82A0] hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavButtons()}
            </div>
            <SidebarPillarsGraphic />
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
