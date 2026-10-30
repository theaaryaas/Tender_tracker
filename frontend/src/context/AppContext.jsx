import React, { createContext, useContext, useState, useEffect } from 'react';
import { analyticsApi, syncApi } from '../utils/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentTab, setCurrentTab] = useState('dashboard'); // dashboard, tenders, kanban, sync, analytics, settings
  const [stats, setStats] = useState(null);
  const [syncState, setSyncState] = useState({ is_running: false, progress: 0, current_task: 'Idle' });
  const [selectedTender, setSelectedTender] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [tenderFilter, setTenderFilter] = useState('');

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
        tenderFilter,
        setTenderFilter,
        notification,
        showNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

