/**
 * BitVivid Tender Sync - Content Script
 * Supports GeM BidPlus (bidplus.gem.gov.in) and Tenderlelo (tenderlelo.com)
 * Handles single-page extraction and automated multi-page crawling
 */

let isCrawling = false;
let stopRequested = false;

// Helper to clean and trim whitespace
const clean = (str) => (str ? str.replace(/\s+/g, ' ').trim() : '');

// Regex to detect official GeM Bid Numbers (e.g. GEM/2026/B/1234567 or GEM/2024/R/...)
const bidNoRegex = /GEM\/\d{4}\/[A-Za-z0-9_/-]+/i;

// Regex for CPPP / State tenders (e.g. 2026_DIT_929901_1)
const cpppRegex = /\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?/i;

// ---------------------------------------------------------
// 1. GeM BidPlus Extraction Strategy
// ---------------------------------------------------------
function extractGemTendersFromPage() {
  const tenders = [];
  const seenIds = new Set();

  // STRATEGY 1: Search all elements with links to showbidDocument
  const docLinks = Array.from(document.querySelectorAll('a[href*="showbidDocument"]'));
  
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

// ---------------------------------------------------------
// 2. Tenderlelo (tenderlelo.com) Extraction Strategy
// ---------------------------------------------------------
function extractTenderleloTendersFromPage() {
  const tenders = [];
  const seenIds = new Set();

  // Find candidate tender card elements
  // Tenderlelo uses .row.card, .row[role="row"], #scroller .row, .card, article.g-item, .tender-card
  let cardElements = Array.from(document.querySelectorAll(
    '#scroller .row, .row.card, .row[role="row"], article.g-item, .tender-card, .bid-item'
  ));

  // If specific selectors didn't match, look for elements with .k-main or .k-sub or .k-title
  if (cardElements.length === 0) {
    const kElements = Array.from(document.querySelectorAll('.k-main, .k-sub, .k-title'));
    cardElements = kElements.map(el => el.closest('.row, .card, article, tr, li') || el).filter(Boolean);
    // Deduplicate
    cardElements = Array.from(new Set(cardElements));
  }

  // Fallback to all .card, .list-group-item, or tr[data-id]
  if (cardElements.length === 0) {
    cardElements = Array.from(document.querySelectorAll('.card, .list-group-item, tr[data-id]'));
  }

  cardElements.forEach((card) => {
    const text = card.innerText || '';
    if (!text.trim()) return;

    // 1. Extract Tender / Bid Number
    let tenderId = '';
    const numEl = card.querySelector('.num, .mono, [data-open-tender], .k-tags .num, .bid-number');
    if (numEl && numEl.innerText.trim()) {
      tenderId = clean(numEl.innerText);
    }

    if (!tenderId) {
      // Regex search in text
      const gemMatch = text.match(bidNoRegex);
      const cpppMatch = text.match(cpppRegex);
      const refMatch = text.match(/(?:Tender\s*(?:No|Id|Ref)|Bid\s*No|NIT\s*No)\s*[:.]?\s*([A-Za-z0-9_\-\/]+)/i);
      if (gemMatch) tenderId = gemMatch[0].trim();
      else if (cpppMatch) tenderId = cpppMatch[0].trim();
      else if (refMatch) tenderId = refMatch[1].trim();
    }

    if (!tenderId) {
      // Look for tender links: /tender/12345 or data-id
      const linkWithId = card.querySelector('a[href*="/tender/"], [data-tender-id], [data-id]');
      if (linkWithId) {
        const href = linkWithId.getAttribute('href') || '';
        const hrefMatch = href.match(/\/tender\/([A-Za-z0-9_\-]+)/i);
        if (hrefMatch) {
          tenderId = hrefMatch[1].trim();
        } else {
          tenderId = linkWithId.getAttribute('data-tender-id') || linkWithId.getAttribute('data-id') || '';
        }
      }
    }

    // If still no tenderId, check if there's any link with an identifier
    if (!tenderId) {
      const anyLink = card.querySelector('a[href]');
      if (anyLink) {
        const href = anyLink.getAttribute('href') || '';
        const m = href.match(/([A-Za-z0-9_\-\/]{8,})/);
        if (m) tenderId = m[1];
      }
    }

    // Skip if no valid identifier found or duplicate on page
    if (!tenderId || seenIds.has(tenderId.toLowerCase())) return;
    seenIds.add(tenderId.toLowerCase());

    // 2. Extract Title / Work Summary
    let title = '';
    const titleEl = card.querySelector('.k-sub, .sub, .work-title, .title, .g-summary, h3, h4, h5, h6, .card-title');
    if (titleEl) {
      title = clean(titleEl.innerText);
    }
    if (!title || title.length < 5) {
      const descMatch = text.match(/(?:Description|Work|Item|Subject)\s*[:.]?\s*([^\n\r]+)/i);
      if (descMatch) {
        title = clean(descMatch[1]);
      } else {
        const lines = text.split('\n').map(l => clean(l)).filter(l => l.length > 5 && !l.includes(tenderId));
        if (lines.length > 0) title = lines[0];
      }
    }
    if (!title) {
      title = `Tender Notice - ${tenderId}`;
    }

    // 3. Extract Organisation / Authority / Department
    let organisation = '';
    const buyerEl = card.querySelector('.k-title, .buyer, .org-title, .authority');
    const deptEl = card.querySelector('.k-org, .dept, .department, .location');
    const buyerText = buyerEl ? clean(buyerEl.innerText) : '';
    const deptText = deptEl ? clean(deptEl.innerText) : '';

    if (buyerText && deptText && buyerText !== deptText) {
      organisation = `${buyerText} (${deptText})`;
    } else if (buyerText) {
      organisation = buyerText;
    } else if (deptText) {
      organisation = deptText;
    } else {
      const orgMatch = text.match(/(?:Department|Ministry|Organisation|Buyer|Authority)\s*[:.]?\s*([^\n\r]+)/i);
      if (orgMatch) {
        organisation = clean(orgMatch[1]);
      } else {
        organisation = 'Tenderlelo / Public Procurement';
      }
    }

    // 4. Extract Closing Date / Due Date
    let closingDate = '';
    const timeEl = card.querySelector('.k-time, .time, .closing-date, .due-date, [data-time], [data-date]');
    if (timeEl) {
      // Tenderlelo stores full datetime in title attribute (e.g. title="Closes 25 Nov 2026, 15:00")
      const titleAttr = timeEl.getAttribute('title') || '';
      const textVal = clean(timeEl.innerText);
      closingDate = titleAttr || textVal;
    }
    if (!closingDate) {
      const dateMatch = text.match(/(?:Closes|End Date|Due Date|Closing Date)\s*[:.]?\s*([0-9]{1,2}[-\/\s][A-Za-z0-9]+[-\/\s][0-9]{2,4}[^,\n\r]*)/i) ||
                        text.match(/([0-9]{2}-[0-9]{2}-[0-9]{4}[^,\n\r]*)/i);
      if (dateMatch) {
        closingDate = clean(dateMatch[1]);
      }
    }

    // 5. Extract Financials: Estimated Value & EMD
    let estimatedValue = 'Check tender PDF / ATC';
    let emdAmount = 'Check tender PDF / ATC';

    const statsEl = card.querySelector('.k-stats, .stats, .financials');
    const statsText = statsEl ? statsEl.innerText : text;

    const valueMatch = statsText.match(/(?:Value|Cost|Amount|₹)\s*[:.]?\s*(₹?\s*[\d,]+(?:\.\d+)?\s*(?:Cr|Crore|Lakh|L|k)?)/i) ||
                       statsText.match(/₹\s*([\d,]+(?:\.\d+)?\s*(?:Cr|Crore|Lakh|L|k)?)/i);
    if (valueMatch) {
      estimatedValue = clean(valueMatch[1] || valueMatch[0]);
      if (!estimatedValue.startsWith('₹') && !estimatedValue.toLowerCase().startsWith('inr')) {
        estimatedValue = `₹ ${estimatedValue}`;
      }
    }

    const emdMatch = statsText.match(/EMD\s*[:.]?\s*(₹?\s*[\d,]+(?:\.\d+)?\s*(?:Cr|Crore|Lakh|L|k)?|Exempt(?:ed)?)/i);
    if (emdMatch) {
      emdAmount = clean(emdMatch[1]);
    }

    // 6. Extract Document / Source URL
    let docUrl = '';
    let tenderUrl = window.location.href;

    const linkEl = card.querySelector('a[href*="showbidDocument"], a[href*="eprocure"], a[href*=".pdf"], a[href*="/tender/"], a[target="_blank"], a.card-link, a');
    if (linkEl) {
      const href = linkEl.getAttribute('href') || '';
      if (href) {
        if (href.startsWith('http')) {
          docUrl = href;
          tenderUrl = href;
        } else if (href.startsWith('/')) {
          const fullUrl = `https://tenderlelo.com${href}`;
          docUrl = fullUrl;
          tenderUrl = fullUrl;
        }
      }
    }

    const isGemTender = tenderId.toUpperCase().startsWith('GEM/');

    tenders.push({
      tender_id: tenderId,
      title: title,
      organisation: organisation,
      closing_date: closingDate,
      doc_url: docUrl,
      url: tenderUrl,
      portal: isGemTender ? 'GeM (via Tenderlelo)' : 'Tenderlelo',
      site_key: 'tenderlelo',
      estimated_value: estimatedValue,
      emd_amount: emdAmount,
      turnover_required: 'Check tender PDF / ATC'
    });
  });

  return tenders;
}

// ---------------------------------------------------------
// 3. Central Dispatcher
// ---------------------------------------------------------
function extractTendersFromPage() {
  const isTenderlelo = window.location.hostname.includes('tenderlelo.com');
  if (isTenderlelo) {
    return extractTenderleloTendersFromPage();
  }
  return extractGemTendersFromPage();
}

// ---------------------------------------------------------
// 4. Safe Click & Page Navigation (GeM & Tenderlelo)
// ---------------------------------------------------------
function triggerClick(element) {
  if (!element) return false;
  try {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {}

  const mouseEvents = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
  for (const evt of mouseEvents) {
    try {
      element.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
  }
  if (typeof element.click === 'function') {
    try {
      element.click();
    } catch (e) {}
  }
  return true;
}

function advanceToPage(targetPage) {
  const isTenderlelo = window.location.hostname.includes('tenderlelo.com');

  if (isTenderlelo) {
    // 1. Check for specific page button
    const pageBtns = Array.from(document.querySelectorAll('#pager button, button.page, .pagination button, .pagination a'));
    const targetBtn = pageBtns.find((b) => b.innerText.trim() === String(targetPage) && !b.disabled);
    if (targetBtn) {
      return triggerClick(targetBtn);
    }

    // 2. Next page button
    const tlNext = document.querySelector(
      '#pager button[aria-label="Next page"]:not([disabled]), ' +
      'button[aria-label="Next page"]:not([disabled]), ' +
      '.lt-pager button.nav:not([disabled]), ' +
      'button.next-page:not([disabled]), ' +
      '#pager button:last-child:not([disabled])'
    );
    if (tlNext) return triggerClick(tlNext);

    const buttons = Array.from(document.querySelectorAll('button, a.page-link, .pagination a'));
    const nextBtn = buttons.find((btn) => {
      if (btn.disabled || btn.classList.contains('disabled')) return false;
      const t = (btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      return t === '›' || t === '>' || t === '»' || t.includes('next') || aria.includes('next');
    });
    if (nextBtn) return triggerClick(nextBtn);
    return false;
  }

  // GeM BidPlus Strategy 1: Direct main-world execution of native loadBids(pageNumber)
  try {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          if (typeof window.loadBids === 'function') {
            window.currentPage = ${targetPage};
            window.loadBids(${targetPage});
          } else if (typeof loadBids === 'function') {
            loadBids(${targetPage});
          }
        } catch (e) {
          console.warn('GeM loadBids execution error:', e);
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (err) {
    console.warn('Script injection failed:', err);
  }

  // GeM BidPlus Strategy 2: SimplePagination DOM anchors (#light-pagination / .pagination2)
  const targetSelectors = [
    `#light-pagination a[href="#page-${targetPage}"]`,
    `#light-pagination a[page="${targetPage}"]`,
    `.pagination2 a[href="#page-${targetPage}"]`,
    `a[data-ci-pagination-page="${targetPage}"]`,
    `a[page="${targetPage}"]`,
    `a[href*="page=${targetPage}"]`,
    `#light-pagination a.next`,
    `.pagination2 a.next`,
    `a[rel="next"]`
  ];

  for (const sel of targetSelectors) {
    const el = document.querySelector(sel);
    if (el && !el.closest('.disabled')) {
      triggerClick(el);
      return true;
    }
  }

  // Strategy 3: Text match inside pagination elements
  const allNavLinks = Array.from(document.querySelectorAll('#light-pagination a, .pagination2 a, .pagination a, ul.pagination li a, .page-item a'));
  const pageMatch = allNavLinks.find((a) => a.innerText.trim() === String(targetPage) && !a.closest('.disabled'));
  if (pageMatch) {
    triggerClick(pageMatch);
    return true;
  }

  const nextArrow = allNavLinks.find((a) => {
    const t = a.innerText.trim();
    return (t === '›' || t === '>' || t === '»' || t.toLowerCase().includes('next')) && !a.closest('.disabled');
  });
  if (nextArrow) {
    triggerClick(nextArrow);
    return true;
  }

  return true;
}

async function waitForPageChange(firstBidBefore, targetPage, maxWaitMs = 8000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (stopRequested) return false;
    await new Promise((r) => setTimeout(r, 400));

    // Wait if GeM loader is visible
    const loader = document.querySelector('#bidCard img[src*="loader"], .loader, .loading, .spinner');
    if (loader && loader.offsetParent !== null) {
      continue;
    }

    const currentTenders = extractTendersFromPage();
    const firstBidAfter = currentTenders[0]?.tender_id || '';

    // If new cards appeared
    if (firstBidAfter && firstBidAfter !== firstBidBefore) {
      await new Promise((r) => setTimeout(r, 400));
      return true;
    }

    // Check pagination active indicator
    const activePageEl = document.querySelector('#light-pagination .current, #light-pagination .active, .pagination .active');
    if (activePageEl && activePageEl.innerText.trim() === String(targetPage)) {
      await new Promise((r) => setTimeout(r, 400));
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------
// 5. Multi-Page Automated Scraper
// ---------------------------------------------------------
async function crawlPages(targetPages, progressCallback) {
  isCrawling = true;
  stopRequested = false;

  const masterTenders = [];
  const masterIds = new Set();

  for (let page = 1; page <= targetPages; page++) {
    if (stopRequested) break;

    // 1. Scrape current page
    const pageTenders = extractTendersFromPage();
    const newPageTenders = [];
    for (const t of pageTenders) {
      if (!masterIds.has(t.tender_id.toLowerCase())) {
        masterIds.add(t.tender_id.toLowerCase());
        masterTenders.push(t);
        newPageTenders.push(t);
      }
    }

    // 2. Report progress and stream this page's tenders immediately
    progressCallback({
      page: page,
      totalPages: targetPages,
      collected: masterTenders.length,
      pageTenders: newPageTenders,
      isDone: (page >= targetPages)
    });

    // If reached target pages or stop requested, finish
    if (page >= targetPages || stopRequested) break;

    // 3. Take snapshot of current first tender and navigate to next page
    const firstBidBefore = pageTenders[0]?.tender_id || '';
    advanceToPage(page + 1);

    // 4. Wait for page change
    await waitForPageChange(firstBidBefore, page + 1, 8000);
  }

  isCrawling = false;
  return masterTenders;
}

// ---------------------------------------------------------
// 6. Listen for messages from extension popup
// ---------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_VISIBLE_TENDERS') {
    try {
      const tenders = extractTendersFromPage();
      sendResponse({
        success: true,
        count: tenders.length,
        tenders: tenders,
        pageTitle: document.title,
        url: window.location.href,
        portal: window.location.hostname.includes('tenderlelo.com') ? 'Tenderlelo' : 'GeM BidPlus'
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
