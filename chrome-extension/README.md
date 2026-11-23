# BitVivid Tender Sync (GeM & Tenderlelo) - Chrome Extension

This extension lets you sync **all visible tenders** from your active browser session directly into your local BitVivid Tender Tracker running at `http://localhost:8000`.

### Supported Portals:
1. **Government e-Marketplace (GeM BidPlus)**: `https://bidplus.gem.gov.in/*` and `https://*.gem.gov.in/*`
2. **Tenderlelo**: `https://tenderlelo.com/*` and `https://*.tenderlelo.com/*`

---

## 🚀 How to Install / Reload in Google Chrome

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions
   ```
2. In the top-right corner, ensure **Developer mode** is toggled **ON**.
3. If you have already loaded the extension previously:
   - Click the 🔄 **Reload** icon on the **BitVivid Tender Sync** card.
4. If installing fresh:
   - Click **"Load unpacked"** in the top-left corner.
   - Select this folder:
     ```text
     /Volumes/Work/bitvivid/Tender_tracker/chrome-extension
     ```
5. Pin the **BitVivid Tender Sync** extension to your Chrome toolbar.

---

## 📋 How to Sync Tenders from Tenderlelo or GeM

1. Ensure your BitVivid backend is running (Production: `http://157.20.211.42:8090` or Local: `http://localhost:8000`).
   - Click the **⚙️ icon** in the extension popup to switch between **Production Server** and **Localhost** or enter any custom URL.
2. Open any search or browse page on **Tenderlelo** (`https://tenderlelo.com/tenders`) or **GeM BidPlus** (`https://bidplus.gem.gov.in`).
3. Click the **BitVivid extension icon** in your toolbar:
   - The extension will automatically detect the portal (`Tenderlelo` or `GeM BidPlus`).
   - It will display the live count of tenders on your screen.
4. Choose an action:
   - **Current Page**: Click **"Sync Visible Tenders"** to immediately import the tenders on your current screen.
   - **Custom Scraper**: Choose 5, 10, 20, or custom number of pages, then click **"Start Multi-Page Scrape"** to automatically navigate and collect batches of tenders.
5. What happens automatically:
   - Extracts Tender / Bid Numbers, Titles, Buyers / Departments, End Dates, EMD, and Document Links.
   - Directly transmits them to your local BitVivid database via `POST /api/v1/tenders/import-bulk`.
   - **Zero Duplicates**: Existing tenders are refreshed with latest dates without overwriting your custom status or notes.
   - Automatically computes BitVivid fit scores, tier-1 software matches, and MSE exemptions.
6. Open **`http://localhost:3000`** $\rightarrow$ All synced tenders appear instantly in your **Tenders Pipeline** and **Kanban Board**!
