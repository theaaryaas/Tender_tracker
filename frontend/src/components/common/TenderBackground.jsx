import React from 'react';

export const ContractDocuments = ({ className = '', scale = 1 }) => {
  return (
    <div className={`relative ${className}`} style={{ transform: `scale(${scale})` }}>
      <svg
        viewBox="0 0 280 260"
        className="w-full h-full drop-shadow-xl select-none pointer-events-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="paper-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f5f3ff" />
          </linearGradient>
          <linearGradient id="paper-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#E6E6FA" />
          </linearGradient>
          <linearGradient id="gold-seal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFDAB9" />
            <stop offset="50%" stopColor="#D8BFD8" />
            <stop offset="100%" stopColor="#6B46C1" />
          </linearGradient>
          <linearGradient id="gold-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D8BFD8" />
            <stop offset="100%" stopColor="#553C9A" />
          </linearGradient>
          <filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="#2D2638" floodOpacity="0.3" />
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
            fill="url(#paper-grad-2)"
            stroke="#D8BFD8"
            strokeWidth="1"
          />
          <line x1="20" y1="28" x2="60" y2="28" stroke="#8C82A0" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="42" x2="130" y2="42" stroke="#C3C1CD" strokeWidth="1.5" />
          <line x1="20" y1="52" x2="125" y2="52" stroke="#C3C1CD" strokeWidth="1.5" />
          <line x1="20" y1="62" x2="110" y2="62" stroke="#C3C1CD" strokeWidth="1.5" />
        </g>

        {/* SHEET 2 (Middle Sheet - Angled Slightly Right) */}
        <g transform="translate(35, 12) rotate(4 75 105)">
          <rect
            x="0"
            y="0"
            width="150"
            height="210"
            rx="4"
            fill="url(#paper-grad-1)"
            stroke="#C3C1CD"
            strokeWidth="1"
          />
          <text x="75" y="32" textAnchor="middle" fill="#584E6B" fontSize="10" fontWeight="bold" fontFamily="serif" letterSpacing="2">
            CONTRACT
          </text>
          <line x1="25" y1="46" x2="125" y2="46" stroke="#8C82A0" strokeWidth="1.5" />
          <line x1="20" y1="60" x2="130" y2="60" stroke="#E2DEEC" strokeWidth="1.5" />
          <line x1="20" y1="70" x2="130" y2="70" stroke="#E2DEEC" strokeWidth="1.5" />
          <line x1="20" y1="80" x2="115" y2="80" stroke="#E2DEEC" strokeWidth="1.5" />
        </g>

        {/* SHEET 1 (Front Primary Sheet - Angled Left) */}
        <g transform="translate(10, 18) rotate(-4 75 105)">
          <rect
            x="0"
            y="0"
            width="150"
            height="210"
            rx="5"
            fill="#ffffff"
            stroke="#D8BFD8"
            strokeWidth="1.2"
          />
          <rect x="18" y="24" width="30" height="4" fill="#6B46C1" rx="1.5" />
          <rect x="52" y="24" width="55" height="4" fill="#C8D8C4" rx="1.5" />

          <text x="20" y="44" fill="#1E182B" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif">
            GOVERNMENT PROCUREMENT
          </text>
          <text x="20" y="54" fill="#8C82A0" fontSize="7" fontFamily="sans-serif">
            AWARD NOTIFICATION • GeM BIDPLUS
          </text>

          <line x1="20" y1="64" x2="135" y2="64" stroke="#D8BFD8" strokeWidth="1.5" />
          <line x1="20" y1="72" x2="130" y2="72" stroke="#E2DEEC" strokeWidth="1.2" />
          <line x1="20" y1="82" x2="135" y2="82" stroke="#E2DEEC" strokeWidth="1.2" />
          <line x1="20" y1="92" x2="125" y2="92" stroke="#E2DEEC" strokeWidth="1.2" />
          <line x1="20" y1="102" x2="135" y2="102" stroke="#E2DEEC" strokeWidth="1.2" />
          <line x1="20" y1="112" x2="130" y2="112" stroke="#E2DEEC" strokeWidth="1.2" />
          <line x1="20" y1="122" x2="110" y2="122" stroke="#E2DEEC" strokeWidth="1.2" />

          {/* Signatures */}
          <line x1="25" y1="185" x2="65" y2="185" stroke="#584E6B" strokeWidth="1" strokeDasharray="3,2" />
          <text x="25" y="193" fill="#8C82A0" fontSize="6" fontFamily="sans-serif">Authorized Signatory</text>

          {/* Lavender Dream Crest Seal */}
          <g transform="translate(110, 168)" filter="url(#seal-shadow)">
            <polygon points="-5,14 -10,34 -4,30 2,34 -2,14" fill="url(#gold-ribbon-grad)" />
            <polygon points="4,14 0,34 6,30 12,34 7,14" fill="url(#gold-ribbon-grad)" />

            <circle cx="0" cy="0" r="22" fill="url(#gold-seal-grad)" stroke="#6B46C1" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="18" fill="none" stroke="#FFDAB9" strokeWidth="0.8" strokeDasharray="2,2" />
            <circle cx="0" cy="0" r="15" fill="url(#gold-seal-grad)" stroke="#553C9A" strokeWidth="1" />
            
            <polygon
              points="0,-8 2.5,-2.5 8,-2.5 3.5,1.5 5.5,7 0,3.5 -5.5,7 -3.5,1.5 -8,-2.5 -2.5,-2.5"
              fill="#FFFFFF"
              stroke="#6B46C1"
              strokeWidth="0.5"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

// Lavender Dream Canvas with Precision Lines Texture (Architectural Pinstripes)
export const TenderBackground = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* 1. Base Canvas: Soft Lavender Mist (#FAF9FD / #E6E6FA Wash) */}
      <div className="absolute inset-0 bg-[#FAF9FD]" />

      {/* 2. Soft Ambient Vignette Orbs (Lavender Dream Palette) */}
      <div className="absolute -top-36 -left-36 w-96 h-96 rounded-full bg-[#E6E6FA] opacity-50 blur-3xl" />
      <div className="absolute -bottom-36 -right-36 w-96 h-96 rounded-full bg-[#FFDAB9] opacity-35 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#D8BFD8] opacity-20 blur-3xl" />

      {/* 3. Precision Lines Texture (Diagonal 45° Architectural Pinstripes) */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-70" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern 
            id="lavender-lines" 
            width="24" 
            height="24" 
            patternTransform="rotate(45 0 0)" 
            patternUnits="userSpaceOnUse"
          >
            {/* Primary crisp diagonal line */}
            <line x1="0" y1="0" x2="0" y2="24" stroke="#D1CADF" strokeWidth="1.1" strokeOpacity="0.65" />
            {/* Secondary soft accent line */}
            <line x1="12" y1="0" x2="12" y2="24" stroke="#E2DEEC" strokeWidth="0.8" strokeOpacity="0.45" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#lavender-lines)" />
      </svg>
    </div>
  );
};

export default TenderBackground;
