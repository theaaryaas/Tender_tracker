# BitVivid Tender Intelligence & Tracking System

An enterprise-grade, full-stack application for automated public tender discovery, eligibility assessment, and pipeline tracking for **BitVivid Solutions Private Limited**.

Built with a **FastAPI** backend, **SQLite / PostgreSQL** persistent database with delta tracking, an **asynchronous multi-portal scraper**, **automated PDF clause extractor**, and a **React (Vite) + Tailwind CSS** interactive dashboard.

---

## 🏛 Architecture Overview (Aligned with `GenAI-NMS`)

```
Tender Tracking/
├── backend/                       # FastAPI REST API Service
│   ├── core/                      # Core configuration & database session
│   │   ├── config.py              # Environment variable loading & app settings
│   │   └── db.py                  # SQLAlchemy engine & session setup
│   ├── models/                    # SQLAlchemy ORM database models
│   │   ├── tender.py              # Tender data model (clauses, score, status, notes)
│   │   ├── sync_log.py            # Crawl execution history model
│   │   └── setting.py             # Profile & keyword settings model
│   ├── repositories/              # Database data access layer
│   │   ├── tender_repository.py   # Search, multi-filtering, sorting, upsert
│   │   └── sync_repository.py     # Sync history logging
│   ├── routes/                    # API endpoints & route controllers
│   │   ├── tenders.py             # CRUD, status/notes update, PDF parse trigger
│   │   ├── sync.py                # Live crawl trigger & progress reporting
│   │   ├── analytics.py           # Dashboard KPIs, deadlines (<48h/7d), distributions
│   │   ├── settings.py            # Profile & keyword configuration
│   │   └── export.py              # Styled Excel (.xlsx) & CSV export
│   ├── schemas/                   # Pydantic data validation & serialization schemas
│   │   ├── tender.py
│   │   ├── sync.py
│   │   ├── analytics.py
│   │   └── settings.py
│   ├── services/                  # Business logic & 3rd-party adapters
│   │   ├── scraper_service.py     # Asynchronous multi-portal orchestrator
│   │   ├── gem_service.py         # GeM BidPlus client with CSRF recovery
│   │   ├── gepnic_service.py      # CPPP & State eProcurement adapter
│   │   ├── railtel_service.py     # RailTel portal adapter
│   │   ├── pdf_service.py         # Tender PDF downloader & clause extractor
│   │   ├── eligibility_service.py # Scoring & company profile matching
│   │   └── export_service.py      # Openpyxl styled Excel generator
│   ├── Dockerfile                 # Backend container definition
│   ├── main.py                    # FastAPI entrypoint & router registration
│   ├── requirements.txt           # Python backend dependencies
│   └── seed_data.py               # Auto-seeds existing 252+ GeM bids from CSV
│
├── frontend/                      # React (Vite) Single Page Application
│   ├── src/
│   │   ├── components/            # Reusable UI component library
│   │   │   ├── layout/            # Navbar, Sidebar, Shell layout
│   │   ├── context/               # Global state (AppContext: stats, sync, drawer)
│   │   ├── features/              # Feature domain views
│   │   │   ├── dashboard/         # KPI cards, upcoming deadlines, top direct fits
│   │   │   ├── tenders/           # Filterable data table & Kanban board
│   │   │   ├── sync/              # Live sync runner with progress & portal status
│   │   │   ├── analytics/         # Visual charts (portals, fit ratio, keywords)
│   │   │   └── settings/          # Company profile editor & keyword manager
│   │   ├── styles/                # Tailwind CSS & custom design system
│   │   ├── utils/                 # Axios API client & formatters
│   │   ├── App.jsx                # Main application component
│   │   └── main.jsx               # React DOM bootstrap entrypoint
│   ├── Dockerfile                 # Multi-stage production build (Node + Nginx)
│   ├── nginx.conf                 # Nginx web server & reverse proxy
│   ├── package.json               # Node.js dependencies
│   ├── tailwind.config.js         # Tailwind configuration
│   └── vite.config.js             # Vite build & API proxy setup
│
├── docker-compose.yaml            # Docker Compose orchestration
├── start.bat                      # 1-Click launcher for Windows
├── start.sh                       # 1-Click launcher for Linux / macOS
└── README.md
```

---

## ⚡ Problems in Legacy Script vs. New Application

| Problem in Legacy Setup | Fixed in New Application |
|---|---|
| **Every row repeated *"Check tender PDF"*** | Added `pdf_service.py` to auto-download and extract real EMD, Turnover, Experience, and BOQ Scope. |
| **Overwriting Excel wiped team notes** | Persistent SQLite / PostgreSQL database stores custom BD notes, priority, and stages forever. |
| **No idea what's new vs. old** | Delta tracking automatically differentiates between New tenders, Updated deadlines, and Closed bids. |
| **Hardcoded Python path crashed runners** | Dynamic launcher (`start.bat`) auto-detects Python/Node on any Windows machine. |
| **Sequential crawl took 45+ mins or hung** | Asynchronous `httpx` engine with concurrent workers completes runs in 1–2 minutes. |
| **Black terminal window with raw prints** | Modern React Dashboard with KPI cards, Kanban board, and live progress bar. |

---

## 🚀 Quick Start

### Option 1: One-Click Launch (Windows)
Double-click `start.bat`. It will:
1. Verify Python 3.10+ and Node.js.
2. Install dependencies automatically.
3. Seed the database with all 252 existing GeM tenders from `BitVivid_Tender_Tracker_GeM.csv`.
4. Launch the Backend (port 8000) and Frontend (port 5173).
5. Open your browser to `http://localhost:5173`.

### Option 2: Docker Compose
```bash
docker-compose up --build
```
Access the application at: `http://localhost:3000` (or `http://localhost:5173` in local dev).

---

## 🔌 API Documentation
When the backend is running, interactive Swagger API docs are available at:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

