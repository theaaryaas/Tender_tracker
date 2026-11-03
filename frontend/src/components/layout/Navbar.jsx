import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  LogOut, 
  LogIn,
  User,
  Bell
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
  const { syncState, setCurrentTab, user, logout, isAuthenticated } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Live Tender Notifications State
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'High-Value GeM Tender Matched',
      desc: 'AI Surveillance & Video Analytics - UP Police HQ (₹14.8 Cr, 96% Match)',
      time: '12m ago',
      unread: true,
    },
    {
      id: 2,
      title: 'Corrigendum Notice Issued',
      desc: 'Integrated Smart CCTV - RailTel Western Railway (Technical Specs Revised)',
      time: '1h ago',
      unread: true,
    },
    {
      id: 3,
      title: 'Submission Due in 24 Hours',
      desc: 'Smart Traffic Video Management - BMC Mumbai (Technical Bid Closing)',
      time: '3h ago',
      unread: true,
    },
    {
      id: 4,
      title: 'GeM Bid Status Evaluation',
      desc: 'CCTV Surveillance System - CPWD Delhi moved to Technical Scoring',
      time: '1d ago',
      unread: false,
    },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2DEEC] px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Company Brand Typography */}
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

      {/* 🇮🇳 Center: Pan-India Radar Marquee (Lavender Dream Palette) */}
      <div className="hidden md:flex flex-1 max-w-md lg:max-w-xl xl:max-w-2xl mx-6 items-center">
        <div className="w-full relative flex items-center h-8 px-2 rounded-full bg-[#FAF9FD] border border-[#E2DEEC] shadow-2xs overflow-hidden">
          
          {/* Fixed Badge Indicator on the Left */}
          <div className="flex items-center space-x-1.5 pl-2 pr-2.5 py-0.5 rounded-full bg-[#E6E6FA] border border-[#D8BFD8] text-[10.5px] font-bold text-[#3B2961] shrink-0 z-10 shadow-2xs select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
            <div className="flex items-center space-x-1 text-[#3B2961] font-bold tracking-wide">
              <span>INDIA</span>
              <span className="text-[#8C82A0] font-normal">|</span>
              <span className="font-semibold">भारत</span>
            </div>
            <span className="text-[9px] font-mono text-[#6B46C1] bg-white px-1.5 py-0.2 rounded border border-[#D8BFD8] font-bold">
              28 STATES
            </span>
          </div>

          <div className="h-4 w-px bg-[#E2DEEC] mx-2 shrink-0 z-10" />

          {/* Infinite Marquee Strip with Fade Edges */}
          <div className="relative overflow-hidden flex-1 mask-fade-edges">
            <div className="animate-pan-india-marquee flex items-center space-x-6 text-[11px] font-mono tracking-widest text-[#584E6B] uppercase select-none">
              {[...INDIAN_STATES, ...INDIAN_STATES].map((state, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center space-x-2.5 hover:text-[#6B46C1] transition cursor-default"
                >
                  <span className="font-semibold text-[#584E6B] hover:text-[#6B46C1] transition">
                    {state}
                  </span>
                  <span className="text-[9px] text-[#B8860B] select-none">✦</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Authentication, Notifications & Session Area */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Live Sync Status Indicator */}
        {syncState.is_running && (
          <>
            <div 
              onClick={() => setCurrentTab('sync')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#FFF2E5] text-[#9A3412] border border-[#FFDAB9] cursor-pointer text-xs font-medium animate-pulse"
              title="Click to view Sync Center progress"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing ({syncState.progress}%)</span>
            </div>
            <div className="h-5 w-px bg-[#E2DEEC]"></div>
          </>
        )}

        {/* 🔔 2. Notification Icon with Dropdown Drawer */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={`relative p-2 rounded-xl transition cursor-pointer select-none border ${
              notificationsOpen
                ? 'bg-[#E6E6FA] border-[#D8BFD8] text-[#6B46C1]'
                : 'border-transparent text-[#584E6B] hover:bg-[#FAF9FD] hover:border-[#E2DEEC] hover:text-[#1E182B]'
            }`}
            title="Tender Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </button>

          {/* Notification Dropdown Drawer */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-[#E2DEEC]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#1E182B]">Tender Radar Alerts</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-[#E6E6FA] text-[#6B46C1] px-1.5 py-0.2 rounded-full border border-[#D8BFD8]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10.5px] font-semibold text-[#6B46C1] hover:text-[#553C9A] transition cursor-pointer hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                      n.unread
                        ? 'bg-[#FAF9FD] border-[#E2DEEC] hover:border-[#D8BFD8]'
                        : 'bg-white border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <span className="text-xs font-bold text-[#1E182B] leading-snug">
                        {n.title}
                      </span>
                      <span className="text-[9.5px] font-mono text-[#8C82A0] shrink-0 mt-0.5">
                        {n.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#584E6B] mt-1 leading-normal">
                      {n.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E2DEEC] pt-2 text-center">
                <button
                  onClick={() => {
                    setNotificationsOpen(false);
                    setCurrentTab('sync');
                  }}
                  className="text-[11px] font-semibold text-[#6B46C1] hover:text-[#553C9A] transition cursor-pointer inline-flex items-center space-x-1"
                >
                  <span>View All Alerts in Sync Center</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {isAuthenticated && user ? (
          <div className="flex items-center space-x-2">
            {/* User Account Pill */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center space-x-2.5 py-1 px-2.5 rounded-xl transition cursor-pointer select-none group border ${
                  profileOpen 
                    ? 'bg-[#E6E6FA] border-[#D8BFD8] shadow-2xs' 
                    : 'border-transparent hover:bg-[#FAF9FD] hover:border-[#E2DEEC]'
                }`}
                title="Account session details"
              >
                {/* Avatar with Active Dot */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6B46C1] to-[#9F7AEA] text-white flex items-center justify-center shadow-2xs border border-[#D8BFD8] font-bold text-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4 text-white" />}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#2E7D32] rounded-full ring-2 ring-white" />
                </div>

                {/* Account Details (Clean Name & Email) */}
                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-[#1E182B] tracking-tight group-hover:text-[#6B46C1] transition truncate max-w-[140px]">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-medium text-[#8C82A0] truncate max-w-[140px]">
                    {user.email || 'bd@bitvividsolutions.com'}
                  </span>
                </div>

                <ChevronDown 
                  className={`w-3.5 h-3.5 text-[#8C82A0] group-hover:text-[#584E6B] transition-transform duration-200 ${
                    profileOpen ? 'rotate-180 text-[#6B46C1]' : ''
                  }`} 
                />
              </button>

              {/* Clean Minimal Account Dropdown (Removed role pill, company name, verified badge) */}
              {profileOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-[#E2DEEC] p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-100 space-y-1.5">
                  {/* Account Info */}
                  <div className="px-2 py-1.5 flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6B46C1] to-[#9F7AEA] text-white flex items-center justify-center shadow-2xs shrink-0 font-bold text-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-xs font-bold text-[#1E182B] truncate">{user.name}</p>
                      <p className="text-[10px] text-[#8C82A0] truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Log Out Button */}
                  <div className="border-t border-[#E2DEEC] pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer group"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:text-rose-600" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Sign In to BitVivid"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
