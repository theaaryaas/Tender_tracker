/**
 * BitVivid Tender Sync - Popup Controller
 * Supports Configurable Server URL, Current Page, and Custom Multi-Page Scraping for GeM and Tenderlelo
 */

const DEFAULT_PROD_URL = 'http://157.20.211.42:8090';
const DEFAULT_LOCAL_URL = 'http://localhost:8000';
let currentServerUrl = DEFAULT_PROD_URL;

function normalizeUrl(url) {
  let cleaned = (url || '').trim();
  if (!cleaned) return DEFAULT_PROD_URL;
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'http://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}

async function getStoredServerUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['serverUrl'], (res) => {
      resolve(normalizeUrl(res.serverUrl || DEFAULT_PROD_URL));
    });
  });
}

async function saveStoredServerUrl(url) {
  const clean = normalizeUrl(url);
  return new Promise((resolve) => {
    chrome.storage.local.set({ serverUrl: clean }, () => resolve(clean));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const portalBadge = document.getElementById('portalBadge');
  const tabCurrent = document.getElementById('tabCurrent');
  const tabCustom = document.getElementById('tabCustom');
  const viewCurrent = document.getElementById('viewCurrent');
  const viewCustom = document.getElementById('viewCustom');

  // Settings Elements
  const settingsToggleBtn = document.getElementById('settingsToggleBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const presetProdBtn = document.getElementById('presetProdBtn');
  const presetLocalBtn = document.getElementById('presetLocalBtn');
  const saveServerUrlBtn = document.getElementById('saveServerUrlBtn');
  const settingsAlert = document.getElementById('settingsAlert');
  const dashboardLink = document.getElementById('dashboardLink');

  // Current View Elements
  const tenderCountEl = document.getElementById('tenderCount');
  const counterSubtitleEl = document.getElementById('counterSubtitle');
  const syncCurrentBtn = document.getElementById('syncCurrentBtn');
  const syncCurrentIcon = document.getElementById('syncCurrentIcon');
  const syncCurrentText = document.getElementById('syncCurrentText');
  const autoParsePdfCurrent = document.getElementById('autoParsePdfCurrent');

  // Custom View Elements
  const customPagesInput = document.getElementById('customPagesInput');
  const autoParsePdfCustom = document.getElementById('autoParsePdfCustom');
  const startCrawlBtn = document.getElementById('startCrawlBtn');
  const stopCrawlBtn = document.getElementById('stopCrawlBtn');
  const crawlIcon = document.getElementById('crawlIcon');
  const crawlText = document.getElementById('crawlText');
  const progressBox = document.getElementById('progressBox');
  const progressPageText = document.getElementById('progressPageText');
  const progressPercent = document.getElementById('progressPercent');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressCollectedText = document.getElementById('progressCollectedText');
  const presetChips = document.querySelectorAll('.preset-chip');

  const resultAlert = document.getElementById('resultAlert');

  let detectedTenders = [];
  let isCrawling = false;
  let isBackendHealthy = false;

  // Initialize Configured Server URL
  currentServerUrl = await getStoredServerUrl();
  if (serverUrlInput) serverUrlInput.value = currentServerUrl;
  if (dashboardLink) dashboardLink.href = currentServerUrl;

  const getApiBaseUrl = () => `${currentServerUrl}/api/v1`;
  const getHealthUrl = () => `${currentServerUrl}/health`;

  // 1. Settings Panel Controls
  if (settingsToggleBtn && settingsPanel) {
    settingsToggleBtn.addEventListener('click', () => {
      const isVisible = settingsPanel.style.display === 'block';
      settingsPanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && serverUrlInput) {
        serverUrlInput.value = currentServerUrl;
        if (settingsAlert) settingsAlert.style.display = 'none';
      }
    });
  }

  if (closeSettingsBtn && settingsPanel) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = 'none';
    });
  }

  if (presetProdBtn && serverUrlInput) {
    presetProdBtn.addEventListener('click', () => {
      serverUrlInput.value = DEFAULT_PROD_URL;
    });
  }

  if (presetLocalBtn && serverUrlInput) {
    presetLocalBtn.addEventListener('click', () => {
      serverUrlInput.value = DEFAULT_LOCAL_URL;
    });
  }

  if (saveServerUrlBtn && serverUrlInput) {
    saveServerUrlBtn.addEventListener('click', async () => {
      saveServerUrlBtn.disabled = true;
      saveServerUrlBtn.innerText = 'Testing...';
      const clean = normalizeUrl(serverUrlInput.value);
      serverUrlInput.value = clean;

      await saveStoredServerUrl(clean);
      currentServerUrl = clean;
      if (dashboardLink) dashboardLink.href = currentServerUrl;

      const ok = await checkBackendHealth();
      saveServerUrlBtn.disabled = false;
      saveServerUrlBtn.innerText = 'Save & Connect';

      if (settingsAlert) {
        settingsAlert.style.display = 'block';
        if (ok) {
          settingsAlert.style.color = '#2E7D32';
          settingsAlert.innerText = '✅ Connected successfully to ' + clean;
          setTimeout(() => {
            if (settingsPanel) settingsPanel.style.display = 'none';
          }, 1200);
        } else {
          settingsAlert.style.color = '#C53030';
          settingsAlert.innerText = '⚠️ Saved, but could not reach ' + clean + '/health';
        }
      }

      if (detectedTenders.length > 0 && ok) {
        syncCurrentBtn.disabled = false;
      }
    });
  }

  // 2. Tab Switching
  tabCurrent.addEventListener('click', () => {
    tabCurrent.classList.add('active');
    tabCustom.classList.remove('active');
    viewCurrent.style.display = 'block';
    viewCustom.style.display = 'none';
    resultAlert.style.display = 'none';
  });

  tabCustom.addEventListener('click', () => {
    tabCustom.classList.add('active');
    tabCurrent.classList.remove('active');
    viewCurrent.style.display = 'none';
    viewCustom.style.display = 'block';
    resultAlert.style.display = 'none';
  });

  // 3. Preset Chips Selection
  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      presetChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      customPagesInput.value = chip.getAttribute('data-pages');
    });
  });

  customPagesInput.addEventListener('input', () => {
    presetChips.forEach((c) => {
      if (c.getAttribute('data-pages') === customPagesInput.value) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  });

  // 4. Check Backend Connectivity
  async function checkBackendHealth() {
    try {
      const res = await fetch(getHealthUrl(), { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        statusBadge.className = 'badge-status online';
        statusText.innerText = 'Online';
        isBackendHealthy = true;
        return true;
      }
    } catch (e) {}
    statusBadge.className = 'badge-status offline';
    statusText.innerText = 'Offline (Click ⚙️)';
    isBackendHealthy = false;
    return false;
  }

  isBackendHealthy = await checkBackendHealth();

  // 5. Query Current Active Tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || !activeTab.url) {
    counterSubtitleEl.innerText = 'Unable to inspect active tab.';
    return;
  }

  const isGemPage = activeTab.url.includes('gem.gov.in');
  const isTenderleloPage = activeTab.url.includes('tenderlelo.com');
  const isSupportedPage = isGemPage || isTenderleloPage;

  if (!isSupportedPage) {
    tenderCountEl.innerText = '—';
    counterSubtitleEl.innerText = 'Open GeM (gem.gov.in) or Tenderlelo (tenderlelo.com) to sync.';
    if (portalBadge) {
      portalBadge.style.display = 'none';
    }
    syncCurrentBtn.disabled = true;
    startCrawlBtn.disabled = true;
    return;
  }

  const portalDisplayName = isTenderleloPage ? 'Tenderlelo' : 'GeM BidPlus';
  if (portalBadge) {
    portalBadge.innerText = portalDisplayName;
    portalBadge.style.display = 'inline-block';
  }

  // 6. Initial Visible Tender Scan for Tab 1
  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_VISIBLE_TENDERS' });
    if (response && response.success) {
      detectedTenders = response.tenders || [];
      tenderCountEl.innerText = detectedTenders.length;

      if (detectedTenders.length > 0) {
        counterSubtitleEl.innerText = `${detectedTenders.length} ${portalDisplayName} tenders ready on this page`;
        if (isBackendHealthy) syncCurrentBtn.disabled = false;
      } else {
        counterSubtitleEl.innerText = `No ${portalDisplayName} tenders detected on this page. Scroll or check list.`;
      }
    }
  } catch (err) {
    // If content script was not ready, inject dynamically
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
      const retryResponse = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_VISIBLE_TENDERS' });
      if (retryResponse && retryResponse.success) {
        detectedTenders = retryResponse.tenders || [];
        tenderCountEl.innerText = detectedTenders.length;
        if (detectedTenders.length > 0 && isBackendHealthy) {
          counterSubtitleEl.innerText = `${detectedTenders.length} ${portalDisplayName} tenders ready on this page`;
          syncCurrentBtn.disabled = false;
        }
      }
    } catch (e) {
      console.warn('Script injection note:', e);
    }
  }

  // Helper: Send Tenders to Configured Backend
  async function postTendersToBackend(tendersList, autoParsePdf) {
    const payload = {
      tenders: tendersList,
      auto_parse_pdf: autoParsePdf
    };

    const targetEndpoint = `${getApiBaseUrl()}/tenders/import-bulk`;
    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.detail || data.message || 'Import failed');
    }
    return data;
  }

  // 7. Sync Current Page Button
  syncCurrentBtn.addEventListener('click', async () => {
    if (detectedTenders.length === 0) return;

    syncCurrentBtn.disabled = true;
    syncCurrentIcon.innerHTML = '<div class="spinner"></div>';
    syncCurrentText.innerText = `Syncing ${detectedTenders.length} tenders...`;
    resultAlert.style.display = 'none';

    try {
      const data = await postTendersToBackend(detectedTenders, autoParsePdfCurrent.checked);
      resultAlert.className = 'alert success';
      resultAlert.innerHTML = `
        <strong>Sync Successful!</strong><br/>
        • <strong>${data.tenders_added}</strong> new tenders added<br/>
        • <strong>${data.tenders_updated}</strong> existing updated (0 duplicates)<br/>
        <em>All records saved to ${currentServerUrl}.</em>
      `;
      syncCurrentIcon.innerHTML = '✅';
      syncCurrentText.innerText = 'Tenders Synced!';
    } catch (err) {
      resultAlert.className = 'alert error';
      resultAlert.innerHTML = `<strong>Error syncing:</strong> ${err.message || `Could not connect to ${currentServerUrl}. Check settings ⚙️`}`;
      syncCurrentIcon.innerHTML = '⚠️';
      syncCurrentText.innerText = 'Retry Sync';
      syncCurrentBtn.disabled = false;
    }
  });

  let streamTotalAdded = 0;
  let streamTotalUpdated = 0;
  let streamTotalReceived = 0;

  // 8. Multi-Page Scraper Progress Listener
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'CRAWL_PROGRESS' && msg.progress) {
      const p = msg.progress;
      const pct = Math.min(100, Math.round((p.page / p.totalPages) * 100));
      progressBarFill.style.width = `${pct}%`;
      progressPercent.innerText = `${pct}%`;

      // Real-time batch sync: send this page's tenders immediately
      if (p.pageTenders && p.pageTenders.length > 0) {
        progressPageText.innerText = `Page ${p.page} of ${p.totalPages}: Saving ${p.pageTenders.length} tenders...`;
        try {
          const res = await postTendersToBackend(p.pageTenders, autoParsePdfCustom.checked);
          streamTotalAdded += (res.tenders_added || 0);
          streamTotalUpdated += (res.tenders_updated || 0);
          streamTotalReceived += p.pageTenders.length;
          progressCollectedText.innerText = `Synced: ${streamTotalReceived} (${streamTotalAdded} new, ${streamTotalUpdated} updated)`;
        } catch (postErr) {
          console.warn('Real-time batch save note:', postErr);
        }
      } else {
        progressPageText.innerText = `Scraping Page ${p.page} of ${p.totalPages}...`;
        progressCollectedText.innerText = `Tenders gathered: ${p.collected}`;
      }

      if (p.page < p.totalPages) {
        progressPageText.innerText = `Advancing to Page ${p.page + 1} of ${p.totalPages}...`;
      }
    }
  });

  // 9. Start Multi-Page Scrape Button
  startCrawlBtn.addEventListener('click', async () => {
    const pagesToScrape = parseInt(customPagesInput.value, 10) || 5;

    isCrawling = true;
    startCrawlBtn.style.display = 'none';
    stopCrawlBtn.style.display = 'block';
    progressBox.style.display = 'block';
    resultAlert.style.display = 'none';

    streamTotalAdded = 0;
    streamTotalUpdated = 0;
    streamTotalReceived = 0;

    progressBarFill.style.width = '5%';
    progressPageText.innerText = `Starting scrape across ${pagesToScrape} pages...`;
    progressPercent.innerText = '0%';
    progressCollectedText.innerText = 'Initializing...';

    try {
      const crawlResult = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'START_MULTI_PAGE_SCRAPE',
        pages: pagesToScrape
      });

      if (!crawlResult || !crawlResult.success) {
        throw new Error(crawlResult?.error || 'Scraping was interrupted.');
      }

      const collected = crawlResult.tenders || [];
      if (collected.length === 0 && streamTotalReceived === 0) {
        throw new Error('No tenders could be extracted from the navigated pages.');
      }

      // If streaming missed anything or had leftover, ensure all are saved
      if (streamTotalReceived === 0 && collected.length > 0) {
        progressPageText.innerText = `Sending ${collected.length} tenders to BitVivid (${currentServerUrl})...`;
        const data = await postTendersToBackend(collected, autoParsePdfCustom.checked);
        streamTotalAdded = data.tenders_added;
        streamTotalUpdated = data.tenders_updated;
        streamTotalReceived = data.total_received;
      }

      progressBarFill.style.width = '100%';
      progressPercent.innerText = '100%';
      progressPageText.innerText = `Completed all ${pagesToScrape} pages!`;

      resultAlert.className = 'alert success';
      resultAlert.innerHTML = `
        <strong>Multi-Page Scrape Complete!</strong><br/>
        • <strong>${streamTotalReceived || collected.length}</strong> total tenders scanned across ${pagesToScrape} pages<br/>
        • <strong>${streamTotalAdded}</strong> new tenders added<br/>
        • <strong>${streamTotalUpdated}</strong> existing updated (0 duplicates)<br/>
        <em>All records saved to ${currentServerUrl}.</em>
      `;
    } catch (err) {
      resultAlert.className = 'alert error';
      resultAlert.innerHTML = `<strong>Scrape Note:</strong> ${err.message || `Operation ended. Could not reach ${currentServerUrl}`}`;
    } finally {
      isCrawling = false;
      startCrawlBtn.style.display = 'block';
      stopCrawlBtn.style.display = 'none';
    }
  });

  // 10. Stop Button
  stopCrawlBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'STOP_MULTI_PAGE_SCRAPE' });
      stopCrawlBtn.innerText = 'Stopping...';
      stopCrawlBtn.disabled = true;
    } catch (e) {}
  });
});
