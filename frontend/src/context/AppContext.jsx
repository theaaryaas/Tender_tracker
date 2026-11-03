import React, { createContext, useContext, useState, useEffect } from 'react';
import { analyticsApi, syncApi } from '../utils/api';

const AppContext = createContext();

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('bitvivid_user');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse saved user', e);
  }
  // Default to null so user sees the login / sign up page
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
    fetchStats();
    fetchSyncStatus();

    // Poll sync status every 3 seconds if running, otherwise every 15s
    const interval = setInterval(() => {
      fetchSyncStatus();
    }, syncState.is_running ? 2500 : 15000);

    return () => clearInterval(interval);
  }, [syncState.is_running]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const login = (email, password, remember = true) => {
    const loggedUser = {
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Business Development Team',
      email: email.trim(),
      role: email.includes('analyst') 
        ? 'Senior Bid Analyst' 
        : email.includes('director') 
          ? 'Executive Director' 
          : 'Business Development Manager',
      company: 'BitVivid Solutions Private Limited',
      avatar: null,
      token: 'jwt_bitvivid_' + Date.now(),
    };

    setUser(loggedUser);
    if (remember) {
      localStorage.setItem('bitvivid_user', JSON.stringify(loggedUser));
    }
    showNotification(`Welcome back, ${loggedUser.name}!`, 'success');
    return loggedUser;
  };

  const signup = (formData) => {
    const newUser = {
      name: formData.name || 'New Member',
      email: formData.email.trim(),
      role: formData.role || 'Bidding Specialist',
      company: formData.company || 'BitVivid Solutions Private Limited',
      avatar: null,
      token: 'jwt_bitvivid_' + Date.now(),
    };

    setUser(newUser);
    localStorage.setItem('bitvivid_user', JSON.stringify(newUser));
    showNotification(`Account created successfully! Welcome to BitVivid, ${newUser.name}.`, 'success');
    return newUser;
  };

  const logout = () => {
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
