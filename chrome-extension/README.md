# BitVivid GeM Tender Sync - Chrome Extension

This extension lets you sync **all visible tenders** from your active, logged-in GeM session (`bidplus.gem.gov.in` and `gem.gov.in`) directly into your local BitVivid Tender Tracker running at `http://localhost:8000`.

---

## 🚀 How to Install in Google Chrome (Under 30 Seconds)

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions
   ```
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. In the top-left corner, click the **"Load unpacked"** button.
4. Select this directory:
   ```text
   /Volumes/Work/bitvivid/Tender_tracker/chrome-extension
   ```
5. Pin the **BitVivid Tender Sync** extension to your Chrome toolbar.

---

## 📋 How to Sync Tenders

1. Make sure your BitVivid backend is running on `http://localhost:8000`.
2. Open any GeM bids page where you are logged in (e.g. `https://bidplus.gem.gov.in/all-bids` or your seller dashboard).
3. Click the **BitVivid extension icon** in your toolbar.
4. You will see the live count of detected tenders on that page.
5. Click **"Sync to BitVivid Tracker"**.
6. The extension will automatically:
   - Extract all bid numbers, titles, departments, quantities, end dates, and PDF links.
   - Send them to your local database via `POST /api/v1/tenders/import-bulk`.
   - Compute fit scores and AI technical alignment automatically.
   - **Prevent all duplicates**: Brand new tenders are added; existing tenders are refreshed without overwriting your custom notes, status, or star flags.
7. Open **`http://localhost:3000`** $\rightarrow$ All synced bids immediately appear in your **Tenders Pipeline** and **Kanban Board**!

