import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Bell, 
  X, 
  Search, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  CheckCheck, 
  Check, 
  ArrowRight, 
  Building2, 
  Calendar, 
  IndianRupee, 
  AlertCircle,
  ShieldAlert,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { tenderApi } from '../../utils/api';

export const NotificationModal = ({
  isOpen,
  onClose,
  onSelectTender,
  onNavigateSync,
  onNavigateDashboard
}) => {
  const [notifications, setNotifications] = useState([]);
  const [allDeadlines, setAllDeadlines] = useState([]);
  const [allDirectFit, setAllDirectFit] = useState([]);
  const [allSync, setAllSync] = useState([]);
  const [counts, setCounts] = useState({ all: 0, deadlines: 0, direct_fit: 0, sync: 0 });
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'deadlines', 'direct_fit', 'sync', 'unread'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('urgency'); // 'urgency', 'fit_desc', 'unread_first'
  const [loading, setLoading] = useState(false);

  // Read IDs persisted in localStorage
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bitvivid_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tenderApi.getNotifications({ limit: 50 });
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setAllDeadlines(res.data.all_deadlines || []);
        setAllDirectFit(res.data.all_direct_fit || []);
        setAllSync(res.data.all_sync || []);
        setCounts(res.data.counts || { all: 0, deadlines: 0, direct_fit: 0, sync: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch notifications in modal:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      try {
        const saved = localStorage.getItem('bitvivid_read_notifications');
        if (saved) setReadIds(JSON.parse(saved));
      } catch (e) {}
    }
  }, [isOpen, fetchNotifications]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const markAsRead = (id) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      try {
        localStorage.setItem('bitvivid_read_notifications', JSON.stringify(next));
      } catch (e) {}
    }
  };

  const markAllAsRead = () => {
    const allIds = [
      ...notifications.map(n => n.id),
      ...allDeadlines.map(n => n.id),
      ...allDirectFit.map(n => n.id),
      ...allSync.map(n => n.id)
    ];
    const unique = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(unique);
    try {
      localStorage.setItem('bitvivid_read_notifications', JSON.stringify(unique));
    } catch (e) {}
  };

  const handleSelectNotification = (item) => {
    markAsRead(item.id);
    onClose();

    if (item.tender && onSelectTender) {
      onSelectTender(item.tender);
    } else if (item.type === 'sync' && onNavigateSync) {
      onNavigateSync();
    }
  };

  // Base list depending on active tab
  const tabList = useMemo(() => {
    if (activeTab === 'deadlines') return allDeadlines;
    if (activeTab === 'direct_fit') return allDirectFit;
    if (activeTab === 'sync') return allSync;
    if (activeTab === 'unread') {
      const combined = [...notifications];
      return combined.filter(n => !readIds.includes(n.id));
    }
    return notifications;
  }, [activeTab, notifications, allDeadlines, allDirectFit, allSync, readIds]);

  // Search and Sort
  const processedList = useMemo(() => {
    let list = [...tabList];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.desc && item.desc.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q)) ||
        (item.time && item.time.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sortBy === 'unread_first') {
      list.sort((a, b) => {
        const aUnread = !readIds.includes(a.id);
        const bUnread = !readIds.includes(b.id);
        if (aUnread === bUnread) return 0;
        return aUnread ? -1 : 1;
      });
    } else if (sortBy === 'fit_desc') {
      list.sort((a, b) => {
        const fitA = a.tender?.fit_score || 0;
        const fitB = b.tender?.fit_score || 0;
        return fitB - fitA;
      });
    } else if (sortBy === 'urgency') {
      list.sort((a, b) => {
        // Critical deadlines (<24h) first, then urgent (<48h), then direct fits, then sync
        const rank = (x) => {
          if (x.type === 'deadline') {
            return x.urgency === 'critical' ? 1 : 2;
          }
          if (x.type === 'direct_fit') return 3;
          return 4;
        };
        const diffRank = rank(a) - rank(b);
        if (diffRank !== 0) return diffRank;
        if (a.diff_seconds && b.diff_seconds) {
          return a.diff_seconds - b.diff_seconds;
        }
        return 0;
      });
    }

    return list;
  }, [tabList, search, sortBy, readIds]);

  const unreadTotal = useMemo(() => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#D8BFD8] flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#E2DEEC] bg-gradient-to-r from-[#FAF9FD] via-white to-[#FAF9FD] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6B46C1] to-[#9F7AEA] text-white flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-[#1E182B] tracking-tight">
                  Tender Radar & Alert Center
                </h2>
                {unreadTotal > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#E6E6FA] text-[#6B46C1] text-xs font-bold border border-[#D8BFD8]">
                    {unreadTotal} Unread
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                    All Caught Up
                  </span>
                )}
              </div>
              <p className="text-xs text-[#584E6B] mt-0.5">
                Real-time signals: Urgent deadlines within 48h, AI CCTV opportunities, and portal sync logs.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {unreadTotal > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9FD] hover:bg-[#E6E6FA] text-[#6B46C1] text-xs font-semibold border border-[#D8BFD8] transition cursor-pointer shadow-2xs"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2 rounded-xl text-[#8C82A0] hover:text-[#6B46C1] hover:bg-[#FAF9FD] border border-transparent hover:border-[#E2DEEC] transition cursor-pointer"
              title="Refresh alert feed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#6B46C1]' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8C82A0] hover:text-[#1E182B] hover:bg-[#FAF9FD] border border-transparent hover:border-[#E2DEEC] transition cursor-pointer"
              title="Close window (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="px-6 py-3 border-b border-[#E2DEEC] bg-[#FAF9FD]/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          
          {/* Tab Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Alerts', count: counts.all },
              { id: 'deadlines', label: 'Deadlines ≤ 48h', count: counts.deadlines },
              { id: 'direct_fit', label: 'Direct Fit (≥85%)', count: counts.direct_fit },
              { id: 'sync', label: 'Sync Reports', count: counts.sync },
              { id: 'unread', label: 'Unread Only', count: unreadTotal },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#6B46C1] text-white shadow-xs'
                    : 'bg-white text-[#584E6B] hover:bg-[#E6E6FA] hover:text-[#3B2961] border border-[#E2DEEC]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#FAF9FD] text-[#584E6B] border border-[#E2DEEC]'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C82A0]" />
              <input
                type="text"
                placeholder="Search alerts, keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E2DEEC] rounded-xl text-xs text-[#1E182B] placeholder-[#8C82A0] focus:outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C82A0] hover:text-[#1E182B]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-white border border-[#E2DEEC] rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-[#584E6B] hover:border-[#D8BFD8] focus:outline-none focus:border-[#6B46C1] cursor-pointer"
              >
                <option value="urgency">Sort: Priority / Urgency</option>
                <option value="fit_desc">Sort: Highest Fit Score</option>
                <option value="unread_first">Sort: Unread Alerts First</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none text-[#8C82A0]" />
            </div>
          </div>
        </div>

        {/* Scrollable Alerts Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#FAF9FD]/40">
          {loading && processedList.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#6B46C1] mx-auto" />
              <p className="text-xs font-semibold text-[#584E6B]">Fetching live alert telemetry...</p>
            </div>
          ) : processedList.length > 0 ? (
            processedList.map((item) => {
              const isUnread = !readIds.includes(item.id);
              const tender = item.tender;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectNotification(item)}
                  className={`relative p-4 rounded-2xl border transition-all duration-150 cursor-pointer group text-left ${
                    isUnread
                      ? 'bg-white border-[#D8BFD8] shadow-sm hover:border-[#6B46C1] hover:shadow-md'
                      : 'bg-white/80 border-[#E2DEEC] hover:bg-white hover:border-[#D8BFD8] hover:shadow-xs'
                  }`}
                >
                  {/* Left Highlight Strip for Unread Items */}
                  {isUnread && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#6B46C1] rounded-r-full" />
                  )}

                  <div className="flex items-start justify-between gap-4">
                    
                    {/* Left Icon + Body */}
                    <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                      
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {item.type === 'deadline' && (
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs ${
                            item.urgency === 'critical'
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-amber-50 border-amber-200 text-amber-600'
                          }`}>
                            <Clock className="w-4 h-4" />
                          </div>
                        )}
                        {item.type === 'direct_fit' && (
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                        {item.type === 'sync' && (
                          <div className="w-9 h-9 rounded-xl bg-[#FAF9FD] border border-[#D8BFD8] text-[#6B46C1] flex items-center justify-center shadow-2xs">
                            <RefreshCw className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        
                        {/* Title and Top Badges */}
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-bold text-[#1E182B] group-hover:text-[#6B46C1] transition leading-snug">
                            {item.title}
                          </span>

                          {/* Pill Badge */}
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                            item.type === 'deadline'
                              ? item.urgency === 'critical'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                              : item.type === 'direct_fit'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-[#E6E6FA] text-[#6B46C1] border-[#D8BFD8]'
                          }`}>
                            {item.badge}
                          </span>

                          {tender?.tender_id && (
                            <span className="font-mono text-[10px] text-[#8C82A0] bg-[#FAF9FD] px-1.5 py-0.5 rounded border border-[#E2DEEC]">
                              {tender.tender_id}
                            </span>
                          )}

                          {isUnread && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#6B46C1] bg-[#FAF9FD] px-1.5 py-0.5 rounded-full border border-[#D8BFD8]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#6B46C1]" />
                              <span>New</span>
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[#584E6B] leading-relaxed line-clamp-2">
                          {item.desc}
                        </p>

                        {/* Metadata Row */}
                        <div className="flex items-center space-x-3 text-[11px] text-[#8C82A0] pt-1 flex-wrap gap-y-1">
                          {tender?.organisation && (
                            <span className="inline-flex items-center space-x-1 truncate max-w-[240px]">
                              <Building2 className="w-3 h-3 text-[#8C82A0]" />
                              <span>{tender.organisation}</span>
                            </span>
                          )}

                          {item.time && (
                            <span className="inline-flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-[#8C82A0]" />
                              <span>{item.time}</span>
                            </span>
                          )}

                          {tender?.estimated_value && (
                            <span className="inline-flex items-center space-x-0.5 font-semibold text-[#1E182B]">
                              <span>₹</span>
                              <span>{tender.estimated_value}</span>
                            </span>
                          )}

                          {tender?.fit_score !== undefined && (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                              {tender.fit_score}% Capability Synergy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Action Button */}
                    <div className="shrink-0 flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectNotification(item);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAF9FD] group-hover:bg-[#6B46C1] group-hover:text-white text-[#6B46C1] border border-[#E2DEEC] group-hover:border-[#6B46C1] text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        <span>{item.type === 'sync' ? 'View Sync' : 'Inspect'}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center space-y-2 bg-white rounded-2xl border border-[#E2DEEC]">
              <AlertCircle className="w-10 h-10 text-[#D8BFD8] mx-auto" />
              <h3 className="text-sm font-bold text-[#1E182B]">No alerts in this category</h3>
              <p className="text-xs text-[#8C82A0] max-w-sm mx-auto">
                No tender events matched your current filter. Try selecting "All Alerts" or adjusting your search term.
              </p>
              <button
                onClick={() => {
                  setActiveTab('all');
                  setSearch('');
                }}
                className="mt-2 text-xs font-semibold text-[#6B46C1] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-[#E2DEEC] bg-[#FAF9FD] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#584E6B] flex items-center space-x-2">
            <span>Showing <strong className="text-[#1E182B]">{processedList.length}</strong> alerts</span>
            <span>•</span>
            <span><strong className="text-[#6B46C1]">{unreadTotal}</strong> unread</span>
          </div>

          <div className="flex items-center space-x-3">
            {onNavigateDashboard && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateDashboard();
                }}
                className="text-xs font-semibold text-[#6B46C1] hover:text-[#553C9A] transition cursor-pointer hover:underline"
              >
                Open Dashboard Radar
              </button>
            )}

            {onNavigateSync && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateSync();
                }}
                className="text-xs font-semibold text-[#584E6B] hover:text-[#6B46C1] transition cursor-pointer hover:underline"
              >
                Sync Center
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-[#FAF9FD] text-[#1E182B] text-xs font-semibold border border-[#E2DEEC] transition cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NotificationModal;

