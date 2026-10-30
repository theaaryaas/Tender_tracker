import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  RefreshCw, 
  ChevronDown, 
  LogOut, 
  LogIn,
  User 
} from 'lucide-react';

const INDIAN_STATES = [
  'Maharashtra',
  'Uttar Pradesh',
  'Tamil Nadu',
  'Karnataka',
  'Gujarat',
  'Delhi NCR',
  'Rajasthan',
  'West Bengal',
  'Telangana',
  'Madhya Pradesh',
  'Odisha',
  'Andhra Pradesh',
  'Kerala',
  'Haryana',
  'Punjab',
  'Assam',
  'Bihar',
  'Jharkhand',
  'Chhattisgarh',
  'Uttarakhand',
  'Himachal Pradesh',
  'Goa',
  'Jammu & Kashmir'
];

export const Navbar = () => {
  const { syncState, setCurrentTab, showNotification } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const profileRef = useRef(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setProfileOpen(false);
    showNotification('Logged out successfully', 'info');
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    showNotification('Logged in as Business Development Team', 'success');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Company Brand Typography (Tightly Cropped, Transparent, Large & Crisp) */}
      <div 
        onClick={() => setCurrentTab('dashboard')}
        className="flex items-center cursor-pointer select-none group"
        title="BitVivid Solutions"
      >
        <img 
          src="/bitvivid-brand.png" 
          alt="BitVivid Solutions" 
          className="h-10 max-h-11 w-auto object-contain transition group-hover:opacity-90"
        />
      </div>

      {/* 🇮🇳 Center: Concept 1 "Pan-India Radar" Smooth Marquee */}
      <div className="hidden md:flex flex-1 max-w-md lg:max-w-xl xl:max-w-2xl mx-6 items-center">
        <div className="w-full relative flex items-center h-8 px-2 rounded-full bg-slate-50/90 border border-slate-200/80 shadow-2xs overflow-hidden">
          
          {/* Fixed Badge Indicator on the Left */}
          <div className="flex items-center space-x-1.5 pl-2 pr-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 text-[10.5px] font-bold text-blue-900 shrink-0 z-10 shadow-2xs select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex items-center space-x-1 text-blue-900 font-bold tracking-wide">
              <span>INDIA</span>
              <span className="text-blue-300/80 font-normal">|</span>
              <span className="font-semibold">भारत</span>
            </div>
            <span className="text-[9px] font-mono text-blue-600 bg-white px-1.5 py-0.2 rounded border border-blue-200/80 font-semibold">
              28 STATES
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2 shrink-0 z-10" />

          {/* Infinite Marquee Strip with Fade Edges */}
          <div className="relative overflow-hidden flex-1 mask-fade-edges">
            <div className="animate-pan-india-marquee flex items-center space-x-6 text-[11px] font-mono tracking-widest text-slate-500 uppercase select-none">
              {[...INDIAN_STATES, ...INDIAN_STATES].map((state, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center space-x-2.5 hover:text-blue-700 transition cursor-default"
                >
                  <span className="font-semibold text-slate-600 hover:text-blue-700 transition">
                    {state}
                  </span>
                  <span className="text-[9px] text-amber-500/90 select-none">✦</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Authentication & Session Area */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Live Sync Status Indicator (active only during background crawls) */}
        {syncState.is_running && (
          <>
            <div 
              onClick={() => setCurrentTab('sync')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer text-xs font-medium animate-pulse"
              title="Click to view Sync Center progress"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing ({syncState.progress}%)</span>
            </div>
            <div className="h-5 w-px bg-slate-200"></div>
          </>
        )}

        {isLoggedIn ? (
          <div className="flex items-center space-x-2">
            {/* User Account Pill */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center space-x-2.5 py-1 px-2.5 rounded-xl transition cursor-pointer select-none group border ${
                  profileOpen 
                    ? 'bg-slate-100/90 border-slate-300 shadow-2xs' 
                    : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
                title="Account session details"
              >
                {/* Avatar with Active Dot */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6] text-white flex items-center justify-center shadow-2xs border border-blue-200/60">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
                </div>

                {/* Account Details */}
                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-slate-800 tracking-tight group-hover:text-blue-700 transition">
                    Business Dev Team
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Signed in
                  </span>
                </div>

                <ChevronDown 
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                    profileOpen ? 'rotate-180 text-blue-600' : ''
                  }`} 
                />
              </button>

              {/* Compact Account Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  {/* Account Info */}
                  <div className="px-2 py-1.5 flex items-center space-x-2.5 border-b border-slate-100 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6] text-white flex items-center justify-center shadow-2xs shrink-0">
                      <User className="w-3 h-3 text-white" />
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-[11px] font-bold text-slate-800 truncate">Business Dev Team</p>
                      <p className="text-[9.5px] text-slate-400 truncate">bd@bitvividsolutions.com</p>
                    </div>
                  </div>

                  {/* Log Out Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-left text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition group"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:text-rose-600" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
            title="Sign In to BitVivid"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
