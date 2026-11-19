/**
 * BitVivid Tender Sync - Popup Controller
 * Supports Current Page and Custom Multi-Page Scraping for GeM and Tenderlelo
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';
const HEALTH_URL = 'http://localhost:8000/health';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const portalBadge = document.getElementById('portalBadge');
  const tabCurrent = document.getElementById('tabCurrent');
  const tabCustom = document.getElementById('tabCustom');
  const viewCurrent = document.getElementById('viewCurrent');
  const viewCustom = document.getElementById('viewCustom');

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

  // 1. Tab Switching
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

  // 2. Preset Chips Selection
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

  // 3. Check Backend Connectivity
  async function checkBackendHealth() {
    try {
      const res = await fetch(HEALTH_URL, { method: 'GET', signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        statusBadge.className = 'badge-status online';
        statusText.innerText = 'Online';
        return true;
      }
    } catch (e) {}
    statusBadge.className = 'badge-status offline';
    statusText.innerText = 'Backend Offline';
    return false;
  }

  const isBackendHealthy = await checkBackendHealth();

  // 4. Query Current Active Tab
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

  // 5. Initial Visible Tender Scan for Tab 1
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

  // Helper: Send Tenders to Localhost Backend
  async function postTendersToBackend(tendersList, autoParsePdf) {
    const payload = {
      tenders: tendersList,
      auto_parse_pdf: autoParsePdf
    };

    const response = await fetch(`${API_BASE_URL}/tenders/import-bulk`, {
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

  // 6. Sync Current Page Button
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
        <em>All records scored in BitVivid.</em>
      `;
      syncCurrentIcon.innerHTML = '✅';
      syncCurrentText.innerText = 'Tenders Synced!';
    } catch (err) {
      resultAlert.className = 'alert error';
      resultAlert.innerHTML = `<strong>Error syncing:</strong> ${err.message || 'Could not connect to localhost:8000'}`;
      syncCurrentIcon.innerHTML = '⚠️';
      syncCurrentText.innerText = 'Retry Sync';
      syncCurrentBtn.disabled = false;
    }
  });

  // 7. Multi-Page Scraper Progress Listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'CRAWL_PROGRESS' && msg.progress) {
      const p = msg.progress;
      const pct = Math.min(100, Math.round((p.page / p.totalPages) * 100));
      progressPageText.innerText = `Scraping Page ${p.page} of ${p.totalPages}...`;
      progressPercent.innerText = `${pct}%`;
      progressBarFill.style.width = `${pct}%`;
      progressCollectedText.innerText = `Tenders gathered: ${p.collected}`;
    }
  });

  // 8. Start Multi-Page Scrape Button
  startCrawlBtn.addEventListener('click', async () => {
    const pagesToScrape = parseInt(customPagesInput.value, 10) || 5;

    isCrawling = true;
    startCrawlBtn.style.display = 'none';
    stopCrawlBtn.style.display = 'block';
    progressBox.style.display = 'block';
    resultAlert.style.display = 'none';

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
      if (collected.length === 0) {
        throw new Error('No tenders could be extracted from the navigated pages.');
      }

      progressPageText.innerText = `Sending ${collected.length} tenders to BitVivid...`;
      progressBarFill.style.width = '100%';

      // Post collected batch to backend
      const data = await postTendersToBackend(collected, autoParsePdfCustom.checked);

      resultAlert.className = 'alert success';
      resultAlert.innerHTML = `
        <strong>Multi-Page Scrape Complete!</strong><br/>
        • <strong>${data.total_received}</strong> total tenders scanned<br/>
        • <strong>${data.tenders_added}</strong> new tenders added<br/>
        • <strong>${data.tenders_updated}</strong> existing updated (0 duplicates)<br/>
        <em>All records scored in BitVivid.</em>
      `;
    } catch (err) {
      resultAlert.className = 'alert error';
      resultAlert.innerHTML = `<strong>Scrape Note:</strong> ${err.message || 'Operation ended'}`;
    } finally {
      isCrawling = false;
      startCrawlBtn.style.display = 'block';
      stopCrawlBtn.style.display = 'none';
    }
  });

  // 9. Stop Button
  stopCrawlBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'STOP_MULTI_PAGE_SCRAPE' });
      stopCrawlBtn.innerText = 'Stopping...';
      stopCrawlBtn.disabled = true;
    } catch (e) {}
  });
});
