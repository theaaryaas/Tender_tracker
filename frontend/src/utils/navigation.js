/**
 * BitVivid Tender Intelligence - Deep Linking & Routing Utilities
 * Handles URL synchronization, tab switching, tender deep-linking,
 * and browser history (back/forward navigation).
 */

export const TAB_ROUTES = {
  dashboard: '/dashboard',
  tenders: '/alltenders',
  analysis: '/tender-analysis',
  crm: '/crm',
  kanban: '/pipeline',
  sync: '/sync',
  analytics: '/analytics',
  users: '/users',
  audit: '/audit',
  contacts: '/contacts',
  settings: '/settings',
};

// Aliases mapping URLs to their corresponding tab
export const ROUTE_ALIASES = {
  '': 'dashboard',
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/alltenders': 'tenders',
  '/all-tenders': 'tenders',
  '/tenders': 'tenders',
  '/analysis': 'analysis',
  '/tender-analysis': 'analysis',
  '/deep-analysis': 'analysis',
  '/crm': 'crm',
  '/pipeline': 'kanban',
  '/kanban': 'kanban',
  '/sync': 'sync',
  '/analytics': 'analytics',
  '/users': 'users',
  '/audit': 'audit',
  '/contacts': 'contacts',
  '/companies': 'contacts',
  '/company-contacts': 'contacts',
  '/settings': 'settings',
};

/**
 * Parses the current pathname into a tab and optional tenderId.
 * Supports:
 * - /alltenders                          -> { tab: 'tenders', tenderId: null }
 * - /alltenders/2026_BBAU_934932_1       -> { tab: 'tenders', tenderId: '2026_BBAU_934932_1' }
 * - /alltenders/12                       -> { tab: 'tenders', tenderId: '12' }
 * - /tenders/2026_BBAU_934932_1          -> { tab: 'tenders', tenderId: '2026_BBAU_934932_1' }
 * - /tender/2026_BBAU_934932_1           -> { tab: 'tenders', tenderId: '2026_BBAU_934932_1' }
 * - /2026_BBAU_934932_1 (direct code)    -> { tab: 'tenders', tenderId: '2026_BBAU_934932_1' }
 * - /12 (pure numeric)                   -> { tab: 'tenders', tenderId: '12' }
 * - /dashboard, /crm, /pipeline, /sync, /analytics, /users, /audit, /settings
 */
export const parseLocation = (pathname = window.location.pathname) => {
  if (!pathname || pathname === '/') {
    return { tab: 'dashboard', tenderId: null };
  }

  // Remove leading/trailing slashes and split
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { tab: 'dashboard', tenderId: null };
  }

  const segment0 = parts[0].toLowerCase();

  // Case 0: /analysis/..., /tender-analysis/..., /deep-analysis/...
  if (['analysis', 'tender-analysis', 'deep-analysis'].includes(segment0)) {
    const tenderId = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
    return { tab: 'analysis', tenderId };
  }

  // Case 1: /tender/..., /tenders/..., /alltenders/...
  if (['tender', 'tenders', 'alltenders', 'all-tenders'].includes(segment0)) {
    if (parts.length >= 3 && ['analysis', 'deep-analysis'].includes(parts[parts.length - 1].toLowerCase())) {
      const tenderId = decodeURIComponent(parts.slice(1, parts.length - 1).join('/'));
      return { tab: 'analysis', tenderId };
    }
    const tenderId = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
    return { tab: 'tenders', tenderId };
  }

  // Case 2: Standard known tabs, with or without a tenderId parameter
  const routeKey = '/' + segment0;
  const matchedTab = ROUTE_ALIASES[routeKey];
  if (matchedTab) {
    const tenderId = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
    return { tab: matchedTab, tenderId };
  }

  // Case 3: Direct tender identifier at root (e.g. /2026_BBAU_934932_1 or /12)
  const directTenderId = decodeURIComponent(parts.join('/'));
  return { tab: 'tenders', tenderId: directTenderId };
};

/**
 * Returns canonical URL for a given tab and optional tender ID
 */
export const getUrlForTab = (tab, tenderId = null) => {
  if (tenderId) {
    return `/alltenders/${encodeURIComponent(tenderId)}`;
  }
  return TAB_ROUTES[tab] || '/dashboard';
};

/**
 * Formats a fully qualified shareable URL for a tender
 */
export const getShareableTenderUrl = (tenderId) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/alltenders/${encodeURIComponent(tenderId)}`;
};

/**
 * Copies a tender's shareable link to clipboard
 */
export const copyTenderLinkToClipboard = async (tenderId) => {
  const url = getShareableTenderUrl(tenderId);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return url;
};

/**
 * Returns canonical URL for tender analysis page
 */
export const getAnalysisUrl = (tenderId = null) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (tenderId) {
    return `${origin}/tender-analysis/${encodeURIComponent(tenderId)}`;
  }
  return `${origin}/tender-analysis`;
};
