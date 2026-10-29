BITVIVID TENDER TRACKER - EXPANDED PORTAL EDITION
================================================

TWO SEPARATE RUNNERS
--------------------
1. Run_GeM_Only.bat
   Searches GeM only and creates:
   - BitVivid_Tender_Tracker_GeM.xlsx
   - BitVivid_Tender_Tracker_GeM.csv

2. Run_All_Other_Portals.bat
   Searches the configured non-GeM portals and creates:
   - BitVivid_Tender_Tracker_Other_Portals.xlsx
   - BitVivid_Tender_Tracker_Other_Portals.csv

HOW TO RUN
----------
1. Extract this folder to a convenient location on D:.
2. Double-click the required .bat file.
3. Keep the black command window open until it finishes.
4. Open the generated Excel file in this folder.
5. Review the Dashboard and Search Errors worksheets.

PYTHON LOCATION
---------------
The batch files use the Python installation confirmed on this PC:
D:\Whatsapp Archive App\python\python.exe
If Python is later moved, edit the PYTHON_EXE line in each .bat file.

PORTALS CONFIGURED IN THE NON-GEM RUNNER
----------------------------------------
- Central eProcurement / CPPP
- Central PSU eProcurement
- Defence eProcurement
- Bihar eProcurement
- Uttar Pradesh eProcurement
- Madhya Pradesh eProcurement
- Maharashtra eProcurement
- Rajasthan eProcurement
- Uttarakhand eProcurement
- Himachal Pradesh eProcurement
- Jharkhand eProcurement
- West Bengal NIC eProcurement
- West Bengal newer portal (best-effort public HTML-table scan)
- Odisha eProcurement
- Haryana eProcurement
- CPWD tenders listed on Central eProcurement / CPPP, filtered by organisation
- CPWD's separate e-Tender portal (best-effort public HTML-table scan)
- RailTel's official active tender, EOI and limited-tender pages
- NHAI / IHMCL
- Cotton Corporation of India and EdCIL listings on the Government ePublishing portal

OFFICIAL PORTAL LINKS FOR MANUAL CROSS-CHECK
-------------------------------------------
CPWD e-Tender: https://etender.cpwd.gov.in/
CPWD tender information: https://cpwd.gov.in/cpwde_tender.aspx
RailTel active tenders: https://www.railtel.in/tenders/active-tenders.html
RailTel EOIs: https://www.railtel.in/tenders/expression-of-interest.html
Himachal Pradesh: https://hptenders.gov.in/nicgep/app
Jharkhand: https://jharkhandtenders.gov.in/nicgep/app
West Bengal NIC: https://tenders.wb.gov.in/nicgep/app
West Bengal newer portal: https://tenders.wb.gov.in/
Odisha: https://tendersodisha.gov.in/nicgep/app
Haryana: https://etenders.hry.nic.in/nicgep/app

IMPORTANT LIMITATIONS
---------------------
- This is a public-listing discovery tool, not an official tender API or bid submission tool.
- The script never asks for GeM or other portal credentials and does not bypass login or CAPTCHA.
- Some portals expose their search form in a way that this version can parse; others may change their site or render results in JavaScript. Such portals may show an error or return few/no results. Review Search Errors and manually cross-check official portals.
- CPWD's own portal and West Bengal's newer portal use best-effort public HTML-table scanning. If their listings are dynamically rendered, they may require a portal-specific adapter in a future update.
- RailTel search scans public active tender, EOI and limited-tender listings. Check pagination/archives manually as the current script does not exhaust all historical pages.
- Tender fields such as EMD, turnover and experience are not reliably present in public listing pages. Read the full tender document, ATC and corrigenda.
- All searches use a focused keyword set for CCTV, VMS, AI video analytics, ANPR, ITMS, FRS, crowd management, command-and-control and related BitVivid solution areas. This improves precision but cannot guarantee every relevant tender will be found.
- The eligibility label is a preliminary screen, not a bid/no-bid legal decision. Tenders are not excluded just because a System Integrator (SI) partner may be needed.
- Follow each portal's terms of use and avoid excessive request frequency.
