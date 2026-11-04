import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { 
  RefreshCw, 
  ChevronDown, 
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
  const { 
    syncState, 
    setCurrentTab, 
    user, 
    logout, 
    isAuthenticated, 
    openNotificationModal, 
    isNotificationModalOpen 
  } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Live Tender Notifications State for Badge Counter
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bitvivid_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Fetch real notifications for badge counting
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await tenderApi.getNotifications({ limit: 40 });
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications count:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  // Synchronize readIds when modal updates read status
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('bitvivid_read_notifications');
        if (saved) setReadIds(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('notifications:updated', handleUpdate);
    return () => window.removeEventListener('notifications:updated', handleUpdate);
  }, []);

  // Re-fetch automatically when sync completes
  useEffect(() => {
    if (!syncState.is_running && isAuthenticated) {
      fetchNotifications();
    }
  }, [syncState.is_running, isAuthenticated, fetchNotifications]);

  // Unread count based on active notifications
  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

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

        {/* 🔔 Live Notification Bell Icon - Triggers Pop-Up Window */}
        <button
          onClick={openNotificationModal}
          className={`relative p-2 rounded-xl transition cursor-pointer select-none border ${
            isNotificationModalOpen
              ? 'bg-[#E6E6FA] border-[#D8BFD8] text-[#6B46C1] shadow-2xs'
              : 'border-transparent text-[#584E6B] hover:bg-[#FAF9FD] hover:border-[#E2DEEC] hover:text-[#1E182B]'
          }`}
          title="Open Tender Radar & Alert Center Pop-up Window"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-xs animate-in zoom-in-75 duration-100">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

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

              {/* Clean Minimal Account Dropdown */}
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
