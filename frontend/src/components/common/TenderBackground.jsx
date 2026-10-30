import React from 'react';

// Reusable SVG component for the Realistic Stacked Contract Documents with Gold Seal
export const ContractDocuments = ({ className = '', scale = 1 }) => {
  return (
    <div className={`relative pointer-events-none select-none ${className}`}>
      <svg
        viewBox="0 0 280 260"
        className="w-full h-full drop-shadow-xl"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Paper drop shadows and gradients */}
          <linearGradient id="paper-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="paper-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
          <linearGradient id="gold-seal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#d97706" />
            <stop offset="70%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="gold-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* SHEET 3 (Back Sheet - Angled Right) */}
        <g transform="translate(60, 15) rotate(10 75 105)">
          <rect
            x="0"
            y="0"
            width="150"
            height="210"
            rx="4"
            fill="url(#paper-grad-1)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Header line & mock text */}
          <line x1="20" y1="28" x2="60" y2="28" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="42" x2="130" y2="42" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="52" x2="125" y2="52" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1.5" />
        </g>

        {/* SHEET 2 (Middle Sheet - Angled Slightly Right) */}
        <g transform="translate(35, 12) rotate(4 75 105)">
          <rect
            x="0"
            y="0"
            width="150"
            height="210"
            rx="4"
            fill="url(#paper-grad-2)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Heading */}
          <text x="75" y="32" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="serif" letterSpacing="2">
            CONTRACT
          </text>
          {/* Fine lines */}
          <line x1="25" y1="46" x2="125" y2="46" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="20" y1="60" x2="130" y2="60" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="70" x2="130" y2="70" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="80" x2="115" y2="80" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="92" x2="130" y2="92" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="20" y1="102" x2="120" y2="102" stroke="#cbd5e1" strokeWidth="1.5" />
        </g>

        {/* SHEET 1 (Front Primary Sheet - Angled Left) */}
        <g transform="translate(10, 18) rotate(-4 75 105)">
          {/* Main Paper Sheet */}
          <rect
            x="0"
            y="0"
            width="155"
            height="215"
            rx="5"
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth="1"
          />

          {/* Elegant Top Border Rule */}
          <line x1="16" y1="16" x2="139" y2="16" stroke="#0f172a" strokeWidth="1" />
          <line x1="16" y1="19" x2="139" y2="19" stroke="#94a3b8" strokeWidth="0.5" />

          {/* Official Crest / Header */}
          <circle cx="77" cy="36" r="8" stroke="#334155" strokeWidth="1" fill="#f8fafc" />
          <text x="77" y="39" textAnchor="middle" fill="#334155" fontSize="7" fontWeight="bold">⚖</text>
          <text x="77" y="54" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold" fontFamily="serif" letterSpacing="2.5">
            CONTRACT
          </text>
          <line x1="45" y1="60" x2="109" y2="60" stroke="#0f172a" strokeWidth="0.8" />

          {/* Contract Body Lines */}
          <line x1="20" y1="72" x2="135" y2="72" stroke="#64748b" strokeWidth="1.5" />
          <line x1="20" y1="82" x2="135" y2="82" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="20" y1="92" x2="125" y2="92" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="20" y1="102" x2="135" y2="102" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="20" y1="112" x2="130" y2="112" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="20" y1="122" x2="110" y2="122" stroke="#cbd5e1" strokeWidth="1.2" />

          <line x1="20" y1="136" x2="135" y2="136" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="20" y1="146" x2="130" y2="146" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="20" y1="156" x2="120" y2="156" stroke="#cbd5e1" strokeWidth="1.2" />

          {/* Signatures */}
          <line x1="25" y1="185" x2="65" y2="185" stroke="#475569" strokeWidth="1" strokeDasharray="3,2" />
          <text x="25" y="193" fill="#64748b" fontSize="6" fontFamily="sans-serif">Authorized Signatory</text>

          {/* EMBOSSED GOLDEN STAMP SEAL WITH RIBBON */}
          <g transform="translate(110, 168)" filter="url(#seal-shadow)">
            {/* Hanging Ribbon Tails */}
            <polygon points="-5,14 -10,34 -4,30 2,34 -2,14" fill="url(#gold-ribbon-grad)" />
            <polygon points="4,14 0,34 6,30 12,34 7,14" fill="url(#gold-ribbon-grad)" />

            {/* Serrated Starburst Outer Ring */}
            <circle cx="0" cy="0" r="22" fill="url(#gold-seal-grad)" stroke="#b45309" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="18" fill="none" stroke="#fef08a" strokeWidth="0.8" strokeDasharray="2,2" />
            <circle cx="0" cy="0" r="15" fill="url(#gold-seal-grad)" stroke="#92400e" strokeWidth="1" />
            
            {/* Inner Crest / Star */}
            <polygon
              points="0,-8 2.5,-2.5 8,-2.5 3.5,1.5 5.5,7 0,3.5 -5.5,7 -3.5,1.5 -8,-2.5 -2.5,-2.5"
              fill="#fef08a"
              stroke="#b45309"
              strokeWidth="0.5"
            />
            <circle cx="0" cy="0" r="12" fill="none" stroke="#fde047" strokeWidth="0.8" />
          </g>
        </g>
      </svg>
    </div>
  );
};

export const TenderBackground = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Base Canvas: Clean Executive Light Tone */}
      <div className="absolute inset-0 bg-[#eef3f8]" />

      {/* Subtle Construction Drafting Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.35]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="arch-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="80" y2="0" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />
            <line x1="0" y1="0" x2="0" y2="80" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />
            <circle cx="0" cy="0" r="1" fill="#94a3b8" />
            <circle cx="80" cy="0" r="1" fill="#94a3b8" />
            <circle cx="0" cy="80" r="1" fill="#94a3b8" />
            <circle cx="80" cy="80" r="1" fill="#94a3b8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#arch-grid)" />
      </svg>

      {/* Clean Drafting Surface */}
    </div>
  );
};

export default TenderBackground;
