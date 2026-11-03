import React, { createContext, useContext, useState, useEffect } from 'react';
import { analyticsApi, syncApi, authApi } from '../utils/api';

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
  const [user, setUser] = useState(getInitialUser);
  const [currentTab, setCurrentTab] = useState('dashboard'); // dashboard, tenders, kanban, sync, analytics, settings
  const [stats, setStats] = useState(null);
  const [syncState, setSyncState] = useState({ is_running: false, progress: 0, current_task: 'Idle' });
  const [selectedTender, setSelectedTender] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const isAuthenticated = Boolean(user);

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

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

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

  const signup = async ({ username, email, password, confirm_password }) => {
    const res = await authApi.signup({
      username,
      email,
      password,
      confirm_password,
    });
    const { access_token, user: userData } = res.data;
    const newUser = {
      ...userData,
      name: userData.username,
      token: access_token,
    };

    localStorage.setItem('tender_tracker_token', access_token);
    localStorage.setItem('bitvivid_user', JSON.stringify(newUser));
    setUser(newUser);
    showNotification(`Account created successfully! Welcome, ${newUser.username}.`, 'success');
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('tender_tracker_token');
    localStorage.removeItem('bitvivid_user');
    setUser(null);
    showNotification('Logged out successfully', 'info');
  };

  const openTenderDrawer = (tender) => {
    setSelectedTender(tender);
    setIsDrawerOpen(true);
  };

  const closeTenderDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTender(null);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        signup,
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
