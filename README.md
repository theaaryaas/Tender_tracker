# BitVivid Tender Intelligence & Tracking System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Local RAG](https://img.shields.io/badge/Local_RAG-100%25_Offline-blueviolet.svg)](chatbot/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)

An enterprise-grade, full-stack intelligence and opportunity discovery platform engineered for **BitVivid Solutions Private Limited**. The system automates public tender crawling, qualification assessment, PDF clause extraction, pipeline management, and tender-scoped AI assistance for smart city, surveillance, and AI video analytics procurement.

---

## 📑 Table of Contents

- [Key Capabilities & Features](#-key-capabilities--features)
- [100% Local RAG Tender AI Chatbot](#-100-local-rag-tender-ai-chatbot)
- [Target Procurement Keywords](#-target-procurement-keywords)
- [System Architecture](#-system-architecture)
- [Directory Layout](#-directory-layout)
- [Technology Stack](#-technology-stack)
- [Quick Start Guide](#-quick-start-guide)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: Bare-Metal Local Development](#method-2-bare-metal-local-development)
  - [Method 3: 1-Click Windows Launcher](#method-3-1-click-windows-launcher)
- [Environment Variables](#-environment-variables)
- [REST API Reference](#-rest-api-reference)
- [Troubleshooting & Maintenance](#-troubleshooting--maintenance)

---

## 🌟 Key Capabilities & Features

### 1. 🤖 100% Local RAG Tender AI Chatbot
- **Zero Cloud Dependency:** Operates fully inside your local container without third-party LLM API keys (OpenAI, Anthropic, Gemini), preventing proprietary data leakage and eliminating per-query costs.
- **Tender-Scoped Guardrails:** Enforces strict boundary checks so queries stay focused exclusively on the selected tender's scope, clauses, and technical BOQ.
- **Dedicated Clause Resolvers:** Instant, accurate extraction of Earnest Money Deposit (EMD), ePBG security deposit, 3-year average turnover, past experience, MSE/Startup relaxations, hardware specifications, and certifications.
- **Interactive Chat Experience:** Accessible via a sleek floating AI button in the Tender Details Drawer, opening a dedicated modal with suggested question chips and an in-chat **"Parse PDF Now"** trigger.

### 2. ⚡ Multi-Portal Asynchronous Scraper
- **Automated Crawling:** Scrapes GeM BidPlus, Central Public Procurement Portal (CPPP / eProcure / GePNIC), and RailTel.
- **Resilient Engine:** Features automated CSRF token negotiation, session renewal, pagination handling, and exponential backoff.
- **Delta Tracking:** Accurately classifies bids into **New**, **Updated Deadlines / Corrigendum**, and **Closed / Archived** states.

### 3. 📄 Automated PDF Clause Extraction
- **Background Ingestion:** Downloads official bid notification documents and Buyer ATC (Additional Terms & Conditions).
- **Rule-Based Parsing:** Uses `pypdf` and domain-specific regex heuristics to automatically extract and verify commercial and technical parameters (EMD, ePBG, turnover criteria, required client completion certificates).

### 4. 🎯 Automated Fit & Qualification Scoring
- Evaluates every discovered bid against BitVivid’s company profile (turnover, technical experience, OEM partnerships, ISO/STQC/BIS certifications).
- Computes an immediate compatibility percentage (e.g. `85% Match - Direct Fit`) to help BD teams prioritize high-win opportunities.

### 5. ⭐ Starred Favorites & Rapid Filtering
- One-click tender starring to flag priority opportunities.
- Dedicated ⭐ Table Header filter for instant one-click toggle of starred tenders.
- Quick sorting by **"⭐ Favorites First"**, **Fit Score**, **Deadline**, and **Estimated Value**.

### 6. 📊 Visual Kanban Bid Pipeline & Deadline Tracker
- **Stage-Gate Workflow:** Organizes opportunities into *Identified → Reviewing → In Preparation → Submitted → Disqualified → Won → Lost*.
- **Urgent Deadline Alerts:** Visual countdown flags highlighting bids closing within `< 48 Hours` and `< 7 Days`.
- **Persistent Collaboration:** Stores custom team notes, priority levels, and bid progress safely in PostgreSQL.

### 7. 📥 Enterprise Multi-Tab Excel & CSV Export
- Generates styled Excel (`.xlsx`) workbooks and CSV files formatted with active filters, qualification scores, notes, and direct links to official portal documents.

---

## 🤖 100% Local RAG Tender AI Chatbot

The Tender Chatbot utilizes a **Retrieval-Augmented Generation (RAG)** pipeline designed specifically for public procurement documents:

```mermaid
flowchart TD
    A[User Enters Query in Chat Modal] --> B{Scope Guardrail Check}
    B -- Out of Scope --> C[Return Scope Warning & Suggest Tenders Topics]
    B -- In Scope --> D[Query Classifier & Intent Matcher]
    
    D --> E[EMD / ePBG Resolver]
    D --> F[Turnover & Financial Standing Resolver]
    D --> G[Past Experience & Scope Resolver]
    D --> H[MSE / Startup Exemption Resolver]
    D --> I[BOQ & Technical Specs Resolver]
    D --> J[General Document Chunk Semantic Search]
    
    K[(Tender Database)] --> L[Extracted PDF Text & Clauses]
    L --> M[Text Chunking & Tokenizer]
    
    E & F & G & H & I & J <--> M
    
    E & F & G & H & I & J --> N[Synthesize Formatted Response]
    N --> O[Add Source Citations & Confidence Level]
    O --> P[Return Markdown Output with Follow-up Chips]
```

### Key Highlights of the Chatbot
- **Zero Token Fees:** No external API keys or cloud services required.
- **Accurate Source Citations:** Direct quotes and section references from Buyer ATC, GeM Bid documents, and portal metadata.
- **Unparsed PDF Detection:** If a tender's PDF hasn't been parsed yet, the chatbot alerts the user and provides a one-click **"Parse PDF Now"** button directly inside the chat dialog.

---

## 🔍 Target Procurement Keywords

Configured out-of-the-box for BitVivid's domain expertise:

| Domain | Key Target Phrases |
|---|---|
| **AI & Video Analytics** | AI video analytics, GenAI video search, video analytics, video management system, VMS |
| **Surveillance & Security** | CCTV surveillance, video surveillance system, IP camera, NVR, ICCC |
| **Traffic & Mobility** | Intelligent Traffic Management System (ITMS), Automatic Number Plate Recognition (ANPR), Red Light Violation Detection (RLVD) |
| **Smart City & Vision AI** | Facial Recognition System (FRS), crowd management, fire and smoke detection, Integrated Command and Control Centre |

---

## 🏛 System Architecture

The application is structured into three orchestrated Docker services:

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                   http://localhost:3000                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Web Server                         │
│   (Serves React SPA / Proxies /api/v1 to FastAPI Backend)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (8000)                   │
│  ├── /api/v1/tenders      (CRUD, Star, Status, Notes)       │
│  ├── /api/v1/chatbot      (Local RAG Engine & Follow-ups)   │
│  ├── /api/v1/sync         (Multi-Portal Crawlers & SSE)     │
│  ├── /api/v1/analytics    (KPIs, Deadlines & Charts)        │
│  ├── /api/v1/settings     (Keywords & Company Profile)      │
│  └── /api/v1/export       (Styled Excel & CSV Generators)   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│   PostgreSQL 16 (Port 5432)   │ │  Multi-Portal Scraper Engine│
│   - Persistent Bids & Notes  │ │  - GeM BidPlus              │
│   - Alembic Version Tracking │ │  - CPPP / GePNIC            │
│   - Keyword & System Configs │ │  - RailTel e-Procurement    │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 📁 Directory Layout

```
Tender_tracker/
├── backend/                        # FastAPI REST Application
│   ├── alembic/                    # Database migration scripts
│   ├── core/                       # App configuration and database setup
│   │   ├── config.py               # Pydantic settings & environment loader
│   │   └── db.py                   # SQLAlchemy engine and session factory
│   ├── models/                     # SQLAlchemy ORM models
│   │   ├── tender.py               # Tender entity (clauses, scoring, star, notes)
│   │   ├── sync_log.py             # Crawler execution history model
│   │   └── setting.py              # System keywords and qualification settings
│   ├── repositories/               # Data access layer
│   │   ├── tender_repository.py    # Search, multi-filtering, sorting, delta upsert
│   │   └── sync_repository.py      # Execution logging
│   ├── routes/                     # REST API route controllers
│   │   ├── auth.py                 # JWT authentication endpoints
│   │   ├── tenders.py              # Tender CRUD, star toggle, PDF parse trigger
│   │   ├── sync.py                 # Crawler trigger & live SSE progress stream
│   │   ├── analytics.py            # Dashboard metrics & upcoming deadline alerts
│   │   ├── settings.py             # Company profile & keyword management
│   │   └── export.py               # Styled Excel (.xlsx) and CSV export
│   ├── schemas/                    # Pydantic validation & response schemas
│   ├── services/                   # Core business logic
│   │   ├── scraper_service.py      # Multi-portal asynchronous crawler orchestrator
│   │   ├── gem_service.py          # GeM client with CSRF token management
│   │   ├── gepnic_service.py       # CPPP / GePNIC portal scraper
│   │   ├── railtel_service.py      # RailTel portal scraper
│   │   ├── pdf_service.py          # PDF downloader & clause extraction engine
│   │   ├── eligibility_service.py  # Profile match calculation & scoring
│   │   └── export_service.py       # Openpyxl styled Excel builder
│   ├── seed_data.py                # Database seeder
│   ├── Dockerfile                  # Backend container specification
│   ├── requirements.txt            # Python dependencies
│   └── main.py                     # FastAPI application entrypoint
│
├── chatbot/                        # 100% Local RAG Chatbot Module
│   ├── __init__.py                 # Package initialization
│   ├── rag_engine.py               # Chunking, semantic retrieval & clause resolvers
│   ├── routes.py                   # /api/v1/chatbot endpoints
│   ├── schemas.py                  # Chat request, response & follow-up models
│   └── service.py                  # Tender context assembler & query router
│
├── frontend/                       # React 18 (Vite) Single Page Application
│   ├── src/
│   │   ├── components/             # Reusable UI component library (Modals, Nav, Shell)
│   │   ├── context/                # Global React state (AppContext)
│   │   ├── features/               # Feature-specific views
│   │   │   ├── dashboard/          # Metric cards, urgent deadlines, high-fit bids
│   │   │   ├── tenders/            # Tender table, drawer, star filter & Chat Modal
│   │   │   │   ├── AllTendersView.jsx   # Searchable table with ⭐ header filter
│   │   │   │   ├── BidPipelineView.jsx  # Interactive Kanban board
│   │   │   │   ├── TenderDrawer.jsx     # Detailed view with floating AI button
│   │   │   │   └── TenderChatModal.jsx  # Dedicated RAG Chatbot overlay
│   │   │   ├── sync/               # Live multi-portal scraper runner & log viewer
│   │   │   ├── analytics/          # Visual breakdown of fit ratios & portals
│   │   │   └── settings/           # Keyword tags & company qualification editor
│   │   ├── utils/                  # Axios HTTP client & date/currency formatters
│   │   ├── App.jsx                 # Application layout & view routing
│   │   └── main.jsx                # React DOM bootstrap
│   ├── Dockerfile                  # Multi-stage container build (Node + Nginx)
│   ├── nginx.conf                  # Nginx proxy configuration
│   ├── package.json                # Frontend package dependencies
│   └── vite.config.js              # Vite build setup & dev proxy
│
├── scripts/                        # Automation & platform launchers
│   ├── start.bat                   # 1-Click launcher for Windows
│   └── start.sh                    # 1-Click launcher for Linux / macOS
│
├── .env.example                    # Environment configuration template
├── docker-compose.yaml             # Docker Compose orchestration
└── README.md                       # Comprehensive system documentation
```

---

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios |
| **Backend API** | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| **Database & ORM** | PostgreSQL 16 Alpine, SQLAlchemy, Alembic |
| **AI & RAG Engine** | 100% Local In-Memory Chunking, Intent Matching, Regular Expressions, Heuristic Parsing |
| **PDF Extraction** | `pypdf`, `httpx` async client |
| **Export Formats** | `openpyxl` (styled Excel workbooks), standard CSV |
| **DevOps & Containers** | Docker, Docker Compose, Nginx Alpine |

---

## 🚀 Quick Start Guide

### Method 1: Docker Compose (Recommended)

1. **Clone the repository and enter directory:**
   ```bash
   git clone -b Project-1 https://github.com/theaaryaas/Tender_tracker.git
   cd Tender_tracker
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   *(Modify credentials or ports in `.env` if desired; defaults work out-of-the-box).*

3. **Build and start services:**
   ```bash
   docker compose up -d --build
   ```

4. **Access the application:**
   - **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
   - **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ReDoc API Reference:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Method 2: Bare-Metal Local Development

#### 1. Database Setup
Ensure PostgreSQL is running locally and create the database:
```sql
CREATE USER tender_user WITH PASSWORD 'tender_password';
CREATE DATABASE tender_tracker OWNER tender_user;
```

#### 2. Backend Setup
```bash
# Navigate to repository root
cd Tender_tracker

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations & seed data
alembic -c backend/alembic.ini upgrade head

# Start FastAPI development server
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

#### 3. Frontend Setup
```bash
# In a separate terminal, navigate to frontend directory
cd Tender_tracker/frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Method 3: 1-Click Windows Launcher

Double-click `scripts\start.bat` from Windows File Explorer. The launcher script will:
1. Verify Python 3.10+ and Node.js are installed.
2. Install any missing backend and frontend dependencies.
3. Launch both the backend API and frontend Vite server in background terminals.
4. Open the dashboard automatically in your default browser.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` to customize settings:

| Variable | Default Value | Description |
|---|---|---|
| `POSTGRES_USER` | `tender_user` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | `tender_password` | PostgreSQL database password |
| `POSTGRES_DB` | `tender_tracker` | PostgreSQL database name |
| `POSTGRES_HOST` | `postgres` | Database container host name (use `localhost` for local dev) |
| `POSTGRES_PORT` | `5432` | PostgreSQL external port |
| `DATABASE_URL` | `postgresql+psycopg2://tender_user:tender_password@postgres:5432/tender_tracker` | SQLAlchemy connection URL |
| `PROJECT_NAME` | `BitVivid Tender Intelligence` | Application title display |
| `API_V1_STR` | `/api/v1` | Base route prefix for API endpoints |
| `BACKEND_PORT` | `8000` | Exposed host port for the FastAPI service |
| `FRONTEND_PORT` | `3000` | Exposed host port for the Nginx/React frontend |
| `JWT_SECRET_KEY` | *(Random secret string)* | Key used to sign JWT auth tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `43200` | JWT token validity duration (30 days) |

---

## 🔌 REST API Reference

The FastAPI service exposes a comprehensive RESTful API under the `/api/v1` prefix:

### 🤖 Local RAG Chatbot
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/chatbot/query` | Submit a tender-scoped query and receive grounded markdown response with citations |
| `GET` | `/api/v1/chatbot/suggested/{tender_id}` | Retrieve dynamic prompt suggestion chips tailored for the tender |

### 📋 Tender Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/tenders` | Search, filter by portal/status/starred, and paginate discovered tenders |
| `GET` | `/api/v1/tenders/{tender_id}` | Retrieve full details, extracted clauses, and compatibility analysis |
| `PATCH` | `/api/v1/tenders/{tender_id}/status` | Update bid pipeline stage (*Identified*, *Reviewing*, *Bidding*, *Won*, etc.) |
| `PATCH` | `/api/v1/tenders/{tender_id}/notes` | Update internal business development notes and priority |
| `POST` | `/api/v1/tenders/{tender_id}/star` | Toggle starred / favorites status for a tender |
| `POST` | `/api/v1/tenders/{tender_id}/parse-pdf` | Trigger on-demand downloading and extraction of bid document PDF |

### 🔄 Multi-Portal Synchronizer
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/sync/run` | Trigger asynchronous crawl across GeM, CPPP, and RailTel portals |
| `GET` | `/api/v1/sync/stream` | Real-time Server-Sent Events (SSE) stream for crawl progress |
| `GET` | `/api/v1/sync/history` | Retrieve historical crawl execution logs and delta statistics |

### 📊 Analytics & Reporting
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/kpis` | Summary KPIs (active tenders, qualified count, expiring `<48h`) |
| `GET` | `/api/v1/analytics/deadlines` | Ranked list of upcoming bid closing deadlines |
| `GET` | `/api/v1/analytics/portals` | Breakdown of bids discovered per procurement portal |

### ⚙️ System Settings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/settings/keywords` | List active search and qualification keyword filters |
| `POST` | `/api/v1/settings/keywords` | Add or update procurement search keywords |
| `GET` | `/api/v1/settings/profile` | Retrieve BitVivid qualification profile and scoring thresholds |
| `PUT` | `/api/v1/settings/profile` | Update company profile parameters (turnover, experience, certifications) |

### 📥 Data Export
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/export/excel` | Download multi-sheet, styled Excel workbook (`.xlsx`) |
| `GET` | `/api/v1/export/csv` | Download filtered tender data as CSV |

---

## 🔧 Troubleshooting & Maintenance

### 1. Database Migrations with Alembic
If changes are made to database models in `backend/models/`:
```bash
# Generate a new migration revision
docker compose exec backend alembic -c backend/alembic.ini revision --autogenerate -m "describe_change"

# Apply pending migrations
docker compose exec backend alembic -c backend/alembic.ini upgrade head
```

### 2. Viewing Live Container Logs
```bash
# Stream logs for all containers
docker compose logs -f

# Stream only backend or scraper output
docker compose logs -f backend
```

### 3. Re-seeding Initial Data
To refresh baseline tenders and qualification configurations:
```bash
docker compose exec backend python -m backend.seed_data
```

### 4. Clearing Cached PDF Documents
Parsed PDFs and temporary downloads are stored in the persistent volume mounted at `/app/data`. To clear downloaded cache files:
```bash
docker compose exec backend rm -rf /app/data/*.pdf
```

---

## 🏢 About BitVivid Solutions Private Limited

**BitVivid Solutions Private Limited** is an innovative AI technology company delivering state-of-the-art computer vision, intelligent video analytics, automated traffic monitoring, and smart city infrastructure solutions.

*Proprietary & Confidential — Engineered for Internal Use by BitVivid BD & Bid Management Teams.*
