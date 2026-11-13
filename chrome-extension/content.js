/**
 * BitVivid GeM Tender Sync - Content Script
 * Supports single-page extraction and automated multi-page crawling
 */

let isCrawling = false;
let stopRequested = false;

// Helper to clean and trim whitespace
const clean = (str) => (str ? str.replace(/\s+/g, ' ').trim() : '');

// Regex to detect official GeM Bid Numbers (e.g. GEM/2026/B/1234567 or GEM/2024/R/...)
const bidNoRegex = /GEM\/\d{4}\/[A-Za-z0-9_/-]+/i;

function extractTendersFromPage() {
  const tenders = [];
  const seenIds = new Set();

  // STRATEGY 1: Search all elements with links to showbidDocument
  const docLinks = Array.from(document.querySelectorAll('a[href*="showbidDocument"], a[href*="showbidDocument"]'));
  
  docLinks.forEach((link) => {
    let card = link.closest('.card, .bid_block, .border, .bid-card, .list-item, tr') || link.parentElement?.parentElement?.parentElement;
    if (!card) card = link.parentElement;

    const cardText = card.innerText || '';
    
    // Extract Bid Number
    let bidNo = '';
    const match = cardText.match(bidNoRegex) || link.innerText.match(bidNoRegex);
    if (match) {
      bidNo = match[0].trim();
    } else {
      const href = link.getAttribute('href') || '';
      const hrefMatch = href.match(/showbidDocument\/([0-9]+)/i);
      if (hrefMatch) {
        bidNo = `GEM/${new Date().getFullYear()}/B/${hrefMatch[1]}`;
      }
    }

    if (!bidNo || seenIds.has(bidNo.toLowerCase())) return;
    seenIds.add(bidNo.toLowerCase());

    // Extract Title / Items
    let title = '';
    const titleEl = card.querySelector('.card-title, h5, h6, strong, a[href*="showbidDocument"]');
    const itemMatch = cardText.match(/Items?\s*:\s*([^\n\r]+)/i);
    if (itemMatch) {
      title = clean(itemMatch[1]);
    } else if (titleEl) {
      title = clean(titleEl.innerText);
    }
    if (!title || title.startsWith('GEM/')) {
      title = `GeM Bid Notice - ${bidNo}`;
    }

    // Extract Department / Organisation
    let organisation = '';
    const deptMatch = cardText.match(/Department\s*(?:Name\s*And\s*Address)?\s*:\s*([^\n\r]+)/i) ||
                      cardText.match(/Ministry\s*:\s*([^\n\r]+)/i) ||
                      cardText.match(/Organisation\s*:\s*([^\n\r]+)/i);
    if (deptMatch) {
      organisation = clean(deptMatch[1]);
    }

    // Extract Quantity
    let quantity = '';
    const qtyMatch = cardText.match(/Quantity\s*:\s*([^\n\r]+)/i);
    if (qtyMatch) {
      quantity = clean(qtyMatch[1]);
    }

    // Extract End Date / Closing Date
    let closingDate = '';
    const dateMatch = cardText.match(/(?:Bid\s*End\s*Date(?:\/Time)?|End\s*Date)\s*:\s*([0-9]{2}-[0-9]{2}-[0-9]{4}[^,\n\r]+)/i) ||
                      cardText.match(/([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
    if (dateMatch) {
      closingDate = clean(dateMatch[1]);
    }

    // Extract Document URL
    let docUrl = link.getAttribute('href') || '';
    if (docUrl.startsWith('/')) {
      docUrl = `https://bidplus.gem.gov.in${docUrl}`;
    }

    tenders.push({
      tender_id: bidNo,
      title: title,
      organisation: organisation || 'Government e-Marketplace (GeM)',
      closing_date: closingDate,
      doc_url: docUrl,
      url: window.location.href,
      quantity: quantity,
      portal: 'GeM BidPlus',
      site_key: 'gem',
      estimated_value: 'Check tender PDF / ATC',
      emd_amount: 'Check tender PDF / ATC',
      turnover_required: 'Check tender PDF / ATC'
    });
  });

  // STRATEGY 2: Fallback across card blocks
  if (tenders.length === 0) {
    const blocks = Array.from(document.querySelectorAll('.card, .border, .bid_block, tr, div[id*="bid"]'));
    blocks.forEach((block) => {
      const text = block.innerText || '';
      const match = text.match(bidNoRegex);
      if (!match) return;

      const bidNo = match[0].trim();
      if (seenIds.has(bidNo.toLowerCase())) return;
      seenIds.add(bidNo.toLowerCase());

      const itemMatch = text.match(/Items?\s*:\s*([^\n\r]+)/i);
      const deptMatch = text.match(/Department\s*:\s*([^\n\r]+)/i) || text.match(/Ministry\s*:\s*([^\n\r]+)/i);
      const dateMatch = text.match(/([0-9]{2}-[0-9]{2}-[0-9]{4}[^,\n\r]+)/i);
      const linkEl = block.querySelector('a[href*=".pdf"], a[href*="showbid"]');

      tenders.push({
        tender_id: bidNo,
        title: itemMatch ? clean(itemMatch[1]) : `GeM Bid - ${bidNo}`,
        organisation: deptMatch ? clean(deptMatch[1]) : 'Government e-Marketplace (GeM)',
        closing_date: dateMatch ? clean(dateMatch[1]) : '',
        doc_url: linkEl ? linkEl.href : '',
        url: window.location.href,
        portal: 'GeM BidPlus',
        site_key: 'gem'
      });
    });
  }

  return tenders;
}

// Find the Next Page button on GeM
function findNextPageButton() {
  // 1. Check next item after current active page in pagination
  const activePageItem = document.querySelector('.pagination .active, .page-item.active, li.active');
  if (activePageItem && activePageItem.nextElementSibling) {
    const nextLink = activePageItem.nextElementSibling.querySelector('a, button');
    if (nextLink && !activePageItem.nextElementSibling.classList.contains('disabled')) {
      return nextLink;
    }
  }

  // 2. Explicit next button classes
  const nextBtn = document.querySelector('.pagination li.next:not(.disabled) a, a.page-link[rel="next"]:not(.disabled), a[aria-label="Next"]:not(.disabled)');
  if (nextBtn) return nextBtn;

  // 3. Search pagination links by symbol/text
  const allLinks = Array.from(document.querySelectorAll('.pagination a, .page-item a, a.page-link'));
  const found = allLinks.find((el) => {
    const txt = el.innerText.trim();
    return (txt === '›' || txt === '>' || txt === '»' || txt.toLowerCase().includes('next')) && !el.closest('.disabled');
  });

  return found || null;
}

// Multi-Page Automated Scraper
async function crawlPages(targetPages, progressCallback) {
  isCrawling = true;
  stopRequested = false;

  const masterTenders = [];
  const masterIds = new Set();

  for (let page = 1; page <= targetPages; page++) {
    if (stopRequested) break;

    // 1. Scrape current page
    const pageTenders = extractTendersFromPage();
    for (const t of pageTenders) {
      if (!masterIds.has(t.tender_id.toLowerCase())) {
        masterIds.add(t.tender_id.toLowerCase());
        masterTenders.push(t);
      }
    }

    // 2. Report Progress
    progressCallback({
      page: page,
      totalPages: targetPages,
      collected: masterTenders.length
    });

    // If reached target pages or stop requested, finish
    if (page >= targetPages || stopRequested) break;

    // 3. Find and click Next button
    const nextBtn = findNextPageButton();
    if (!nextBtn) {
      console.log('No next page button found or reached last page.');
      break;
    }

    // Take snapshot of first tender to detect when DOM updates
    const firstBidBefore = pageTenders[0]?.tender_id || '';

    nextBtn.click();

    // 4. Wait for page change (poll up to 3.5 seconds)
    let pageChanged = false;
    for (let wait = 0; wait < 7; wait++) {
      await new Promise((r) => setTimeout(r, 500));
      if (stopRequested) break;

      const newTenders = extractTendersFromPage();
      const firstBidAfter = newTenders[0]?.tender_id || '';
      if (firstBidAfter && firstBidAfter !== firstBidBefore) {
        pageChanged = true;
        break;
      }
    }

    if (!pageChanged) {
      // Small additional delay if GeM was slow
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  isCrawling = false;
  return masterTenders;
}

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_VISIBLE_TENDERS') {
    try {
      const tenders = extractTendersFromPage();
      sendResponse({
        success: true,
        count: tenders.length,
        tenders: tenders,
        pageTitle: document.title,
        url: window.location.href
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message, tenders: [] });
    }
    return true;
  }

  if (request.action === 'START_MULTI_PAGE_SCRAPE') {
    const targetPages = request.pages || 5;

    crawlPages(targetPages, (progress) => {
      chrome.runtime.sendMessage({ action: 'CRAWL_PROGRESS', progress });
    }).then((collectedTenders) => {
      sendResponse({
        success: true,
        count: collectedTenders.length,
        tenders: collectedTenders
      });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message, tenders: [] });
    });

    return true; // Keep channel open for async response
  }

  if (request.action === 'STOP_MULTI_PAGE_SCRAPE') {
    stopRequested = true;
    sendResponse({ success: true, message: 'Stop requested.' });
    return true;
  }
});
