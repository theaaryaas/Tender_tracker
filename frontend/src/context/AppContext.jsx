import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { analyticsApi, syncApi, authApi, tenderApi } from '../utils/api';
import { parseLocation, getUrlForTab } from '../utils/navigation';

const AppContext = createContext();

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('bitvivid_user');
    const token = localStorage.getItem('tender_tracker_token');
    if (saved && token) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse saved user', e);
  }
  return null;
};

export const AppProvider = ({ children }) => {
  const initialNav = typeof window !== 'undefined' ? parseLocation(window.location.pathname) : { tab: 'dashboard', tenderId: null };

  const [user, setUser] = useState(getInitialUser);
  const [currentTab, _setCurrentTab] = useState(initialNav.tab || 'dashboard');
  const [stats, setStats] = useState(null);
  const [syncState, setSyncState] = useState({ is_running: false, progress: 0, current_task: 'Idle' });
  const [selectedTender, setSelectedTender] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Keep a ref to currentTab to prevent stale closures in history listeners
  const currentTabRef = useRef(currentTab);
  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  const isAuthenticated = Boolean(user);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Synchronized tab switcher that updates the browser URL
  const setCurrentTab = useCallback((tab, options = {}) => {
    const { push = true, closeDrawer = true } = options;
    _setCurrentTab(tab);
    currentTabRef.current = tab;

    if (closeDrawer && isDrawerOpen) {
      setIsDrawerOpen(false);
      setSelectedTender(null);
    }

    if (typeof window !== 'undefined') {
      const targetUrl = getUrlForTab(tab, null);
      if (push && window.location.pathname !== targetUrl) {
        window.history.pushState({ tab, tenderId: null }, '', targetUrl);
      }
    }
  }, [isDrawerOpen]);

  // Synchronized tender drawer opener that updates the URL to /alltenders/:tenderId
  const openTenderDrawer = useCallback((tender, options = {}) => {
    if (!tender) return;
    const { push = true } = options;
    setSelectedTender(tender);
    setIsDrawerOpen(true);

    const tid = tender.tender_id || tender.id;
    if (tid && typeof window !== 'undefined') {
      const targetUrl = `/alltenders/${encodeURIComponent(tid)}`;
      if (push && window.location.pathname !== targetUrl && window.location.pathname !== `/alltenders/${tid}`) {
        window.history.pushState({ tab: 'tenders', tenderId: tid }, '', targetUrl);
      }
    }
  }, []);

  // Synchronized tender drawer closer that reverts the URL back to the tab root (e.g. /alltenders)
  const closeTenderDrawer = useCallback((options = {}) => {
    const { push = true } = options;
    setIsDrawerOpen(false);
    setSelectedTender(null);

    if (typeof window !== 'undefined') {
      const activeTab = currentTabRef.current || 'dashboard';
      const targetUrl = getUrlForTab(activeTab, null);
      if (push && window.location.pathname !== targetUrl) {
        window.history.pushState({ tab: activeTab, tenderId: null }, '', targetUrl);
      }
    }
  }, []);

  // Listen to browser Back and Forward button events (popstate)
  useEffect(() => {
    const handlePopState = async () => {
      const { tab, tenderId } = parseLocation(window.location.pathname);
      _setCurrentTab(tab);
      currentTabRef.current = tab;

      if (tenderId) {
        // Only fetch if tender isn't already loaded in state
        setSelectedTender((prev) => {
          if (prev && (String(prev.tender_id) === String(tenderId) || String(prev.id) === String(tenderId))) {
            if (tab !== 'analysis') setIsDrawerOpen(true);
            else setIsDrawerOpen(false);
            return prev;
          }
          // Fetch tender details
          tenderApi.getTender(tenderId)
            .then((res) => {
              setSelectedTender(res.data);
              if (tab !== 'analysis') setIsDrawerOpen(true);
              else setIsDrawerOpen(false);
              const preferredCode = res.data.tender_id || res.data.id;
              const updatedCanonical = tab === 'analysis'
                ? `/tender-analysis/${encodeURIComponent(preferredCode)}`
                : `/alltenders/${encodeURIComponent(preferredCode)}`;
              if (window.location.pathname !== updatedCanonical) {
                window.history.replaceState({ tab, tenderId: preferredCode }, '', updatedCanonical);
              }
            })
            .catch((err) => {
              console.warn('Failed to load tender from browser history navigation', err);
              setIsDrawerOpen(false);
              setSelectedTender(null);
            });
          return prev;
        });
      } else {
        setIsDrawerOpen(false);
        setSelectedTender(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Deep linking: Hydrate tender or canonicalize URL on initial load and authentication
  useEffect(() => {
    const { tab, tenderId } = parseLocation(window.location.pathname);
    _setCurrentTab(tab);
    currentTabRef.current = tab;

    if (tenderId) {
      if (isAuthenticated) {
        tenderApi.getTender(tenderId)
          .then((res) => {
            setSelectedTender(res.data);
            if (tab !== 'analysis') setIsDrawerOpen(true);
            else setIsDrawerOpen(false);
            const preferredCode = res.data.tender_id || res.data.id;
            const updatedCanonical = tab === 'analysis'
              ? `/tender-analysis/${encodeURIComponent(preferredCode)}`
              : `/alltenders/${encodeURIComponent(preferredCode)}`;
            if (window.location.pathname !== updatedCanonical) {
              window.history.replaceState({ tab, tenderId: preferredCode }, '', updatedCanonical);
            }
          })
          .catch((err) => {
            console.warn(`Tender "${tenderId}" from URL not found`, err);
            showNotification(`Tender "${tenderId}" could not be found or has been removed.`, 'error');
            window.history.replaceState({ tab: 'tenders', tenderId: null }, '', '/alltenders');
          });
      }
    } else {
      // Normalize aliases like /tenders -> /alltenders
      const canonical = getUrlForTab(tab);
      if (window.location.pathname !== '/' && window.location.pathname !== canonical) {
        window.history.replaceState({ tab, tenderId: null }, '', canonical);
      }
    }
  }, [isAuthenticated, showNotification]);

  // Validate active session on mount
  useEffect(() => {
    const token = localStorage.getItem('tender_tracker_token');
    if (token) {
      authApi.getMe()
        .then((res) => {
          const freshUser = {
            ...res.data,
            name: res.data.username,
            token,
          };
          setUser(freshUser);
          localStorage.setItem('bitvivid_user', JSON.stringify(freshUser));
        })
        .catch((err) => {
          console.warn('Session expired or invalid, logging out', err);
          localStorage.removeItem('tender_tracker_token');
          localStorage.removeItem('bitvivid_user');
          setUser(null);
        });
    }
  }, []);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await analyticsApi.getOverview();
      setStats(res.data);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await syncApi.getStatus();
      if (res.data?.live) {
        setSyncState(res.data.live);
      }
    } catch (e) {
      console.error('Error fetching sync status:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchSyncStatus();

      // Poll sync status every 3 seconds if running, otherwise every 15s
      const interval = setInterval(() => {
        fetchSyncStatus();
      }, syncState.is_running ? 2500 : 15000);

      return () => clearInterval(interval);
    }
  }, [syncState.is_running, isAuthenticated]);

  const login = async (identifier, password) => {
    const res = await authApi.login({ identifier, password });
    const { access_token, user: userData } = res.data;
    const loggedUser = {
      ...userData,
      name: userData.username,
      token: access_token,
    };

    localStorage.setItem('tender_tracker_token', access_token);
    localStorage.setItem('bitvivid_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    showNotification(`Welcome back, ${loggedUser.username}!`, 'success');
    return loggedUser;
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const isExecutive = user?.role === 'executive';
  const canViewAudit = isSuperAdmin || (user?.permissions || []).includes('can_view_audit');
  const canManageUsers = isSuperAdmin || isManager;
  const userRole = user?.role || 'executive';

  const logout = () => {
    localStorage.removeItem('tender_tracker_token');
    localStorage.removeItem('bitvivid_user');
    setUser(null);
    showNotification('Logged out successfully', 'info');
  };

  const openNotificationModal = () => setIsNotificationModalOpen(true);
  const closeNotificationModal = () => setIsNotificationModalOpen(false);

  return (
    <AppContext.Provider
      value={{
        user,
        userRole,
        isSuperAdmin,
        isManager,
        isExecutive,
        canViewAudit,
        canManageUsers,
        isAuthenticated,
        login,
        logout,
        currentTab,
        setCurrentTab,
        stats,
        refreshStats: fetchStats,
        syncState,
        refreshSyncStatus: fetchSyncStatus,
        selectedTender,
        openTenderDrawer,
        closeTenderDrawer,
        isDrawerOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isNotificationModalOpen,
        openNotificationModal,
        closeNotificationModal,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        notification,
        showNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

export default AppContext;
