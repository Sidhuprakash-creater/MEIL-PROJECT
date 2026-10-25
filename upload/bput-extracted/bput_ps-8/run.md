# MEIL ESG / BRSR Reporting Platform — Run Guide

Complete instructions to set up and run the project after downloading.

---

## 1. Prerequisites

| Requirement | Minimum Version | Install Command |
|-------------|----------------|-----------------|
| **Node.js** | v20+ | [Download](https://nodejs.org/) or `nvm install 20` |
| **Bun** (recommended) | v1.3+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Python 3** | v3.10+ | [Download](https://python.org/) (for ReportLab PDF export) |
| **pip** | any | Usually bundled with Python |

> You can use either `bun` or `npm`/`yarn` to run the project.
> **Bun is recommended** — it's faster and is what the project was built with.

---

## 2. Installation

```bash
# 1. Extract the downloaded project
unzip meil-esg-platform.zip
cd meil-esg-platform

# 2. Install dependencies (choose one)
bun install          # ← recommended (fast)
# OR
npm install

# 3. Install Python dependencies for PDF export
pip install reportlab
```

---

## 3. Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL=file:./db/custom.db
```

> The project uses **SQLite** via Prisma ORM — no external database server required.
> The database file will be created automatically at `db/custom.db`.

---

## 4. Database Setup

```bash
# 1. Push the Prisma schema to create the database tables
bun run db:push
# OR
npx prisma db push --accept-data-loss

# 2. Generate the Prisma client
bun run db:generate
# OR
npx prisma generate

# 3. Seed the database with illustrative demo data
bun run prisma/seed.ts
# OR
npx tsx prisma/seed.ts
```

This creates:
- 1 Group (MEIL Group)
- 2 Subsidiaries (MEIL Power, MEIL Infra)
- 3 Business Units
- 4 Projects (Gayatri Solar, Nizamabad Solar, Hyderabad Substation, Kaleshwaram Irrigation)
- 15 Users (one per role)
- 15 Roles + 28 Permissions
- Reporting year FY 2026-27 with 3 monthly periods (April/May/June 2026)
- 10 Emission factors (CEA grid, IPCC fuels, GHG Protocol travel)
- BRSR v3 framework with Sections A/B/C, Principles P1-P9, 22 questions
- Real ESG source records (energy, water, waste, workforce, safety)
- Deterministic calculation results
- Evidence files (verified)
- A submission that moved DRAFT → SUBMITTED → BU_APPROVED → SUBSIDIARY_APPROVED
- Audit logs, activities, notifications, BRSR answers, 1 generated report

---

## 5. Running the Development Server

```bash
# Start the dev server (runs on port 3000)
bun run dev
# OR
npm run dev
```

The server will start at `http://localhost:3000`.

You should see:
```
✓ Ready in ~1.5s
▲ Next.js 16.1.3 (Turbopack)
- Local: http://localhost:3000
```

---

## 6. Demo Login Credentials

All demo accounts use the same password: **`esg12345`**

| Role | Email | Name |
|------|-------|------|
| Project / Site User | `rohit@meil-esg.in` | Rohit Kumar |
| HR User | `sunita@meil-esg.in` | Sunita Rao |
| EHS / Safety User | `kvenkat@meil-esg.in` | K. Venkat |
| Procurement User | `priya@meil-esg.in` | Priya Nair |
| CSR / Community User | `imran@meil-esg.in` | Imran Sheikh |
| Compliance / Governance | `deepika@meil-esg.in` | Deepika Joshi |
| Finance & Resource Contributor | `finance@meil-esg.in` | Rahul Verma |
| ESG Analyst | `sameer@meil-esg.in` | Sameer Khan |

> All accounts are marked `demo: true` (Illustrative). In production, replace with real authenticated users.
> Reviewer / governance roles (Group Admin, BU / Subsidiary / Group Reviewers, ESG Manager, BRSR Manager, Auditor, Executive) have been removed — add new users by extending `prisma/seed.ts` and `src/lib/role-nav.ts`.

---

## 7. Login Flow

1. Open `http://localhost:3000` in your browser
2. Click **"Choose Role to Continue"**
3. Select a role card
4. The login form auto-fills the email + password
5. Click **"Sign In"**
6. You'll see that role's unique dashboard

> Each role sees a **completely different** dashboard with unique colors, layout, and nav tabs.

---

## 8. Available Scripts

```bash
bun run dev          # Start dev server (port 3000)
bun run lint         # Run ESLint to check code quality
bun run db:push      # Push schema changes to the database
bun run db:generate  # Regenerate the Prisma client
bun run db:migrate   # Create a database migration
bun run db:reset     # Reset the database (destructive!)
bun run build        # Build for production (do NOT use in dev)
```

---

## 9. Project Structure

```
meil-esg-platform/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main entry — role-based dashboard routing
│   │   ├── layout.tsx          # Root layout with fonts
│   │   ├── globals.css         # Design system (glassmorphism, colors, animations)
│   │   └── api/                # 47 API routes
│   │       ├── auth/           # Login, logout, me
│   │       ├── overview/       # Dashboard KPI computation
│   │       ├── insights/       # LLM-generated AI insights
│   │       ├── action-items/   # Role-aware task list
│   │       ├── targets/        # Sustainability targets
│   │       ├── energy/         # Energy CRUD + calculation
│   │       ├── water/          # Water CRUD
│   │       ├── waste/          # Waste CRUD
│   │       ├── workforce/      # Workforce CRUD
│   │       ├── safety/         # Safety CRUD + LTIFR
│   │       ├── validation/     # Validation engine
│   │       ├── calculation/    # Calculation engine
│   │       ├── consolidation/  # Consolidation engine (Project→BU→Sub→Group)
│   │       ├── submissions/    # Workflow state machine
│   │       ├── evidence/       # Evidence management
│   │       ├── brsr/           # BRSR engine (frameworks, readiness, generate)
│   │       ├── reports/        # Report generation + download
│   │       ├── audit/          # Audit log + traceability tree
│   │       ├── organization/   # Org hierarchy tree
│   │       ├── notifications/  # User notifications
│   │       ├── activity/       # Activity feed
│   │       └── export/        # Dashboard PDF export (ReportLab)
│   ├── components/
│   │   ├── dashboard/          # 15 role-specific dashboards
│   │   ├── modules/            # 13 workspaces + 11 shared modules
│   │   ├── shell/              # App shell + command palette
│   │   ├── welcome/            # Glassmorphism login screen
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── auth-context.tsx    # Auth state + ModuleKey types
│       ├── session.ts          # Session/RBAC helpers
│       ├── db.ts               # Prisma client
│       ├── role-nav.ts         # 15-role navigation config
│       └── workflow.ts        # State machine helpers
├── prisma/
│   ├── schema.prisma           # Database schema (38 models)
│   └── seed.ts                 # Seed script (illustrative data)
├── public/
│   └── projects/               # 4 generated project images
├── scripts/
│   └── generate_dashboard_pdf.py  # ReportLab PDF script
├── design.md                   # Complete UI/UX design system
├── run.md                      # This file
└── .env                        # Environment variables
```

---

## 10. Key Features

### ESG Data Control Chain
```
Source Data → Evidence → Validation → Calculation → Submission → Review → Approval → Consolidation → BRSR Mapping → Report → Audit
```
Every KPI is traceable through this chain.

### Role-Specific Dashboards (15 unique)
Each role sees a completely different dashboard with unique colors, layouts, and nav tabs.

### Real-Time Data
- Activity feed auto-refreshes every 30 seconds
- KPI cards auto-refresh every 60 seconds
- Live "pulse" indicators on feeds

### AI Insights
- LLM-generated narrative insights from real ESG data
- Available on Overview and Executive dashboards

### Scenario Calculator
- "What-If" modeling tool — adjust sliders to see ESG score impact

### PDF Export
- One-click dashboard PDF export using ReportLab

### CSV Import
- Bulk data import for Energy/Water/Waste with 4-step wizard

### Command Palette (⌘K / Ctrl+K)
- Global search across modules, actions, and projects

---

## 11. Total Screen Count

| Metric | Count |
|--------|-------|
| Unique role dashboards | 15 |
| Unique nav-tab screens | 158 |
| **Total screens** | **173** |

---

## 12. Troubleshooting

### Port 3000 already in use
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
# Or
fuser -k 3000/tcp
```

### Database not initialized
```bash
rm -f db/custom.db
bun run db:push
bun run prisma/seed.ts
```

### Prisma client out of sync
```bash
bun run db:generate
# Then restart the dev server
```

### PDF export not working
```bash
pip install reportlab
# The export uses Python via child_process — ensure python3 is in PATH
```

### Slow page loads
- The dev server uses Turbopack — first load compiles on-demand
- Prisma query logging is disabled (only errors/warnings logged)
- Subsequent loads should be ~50ms per route

---

## 13. Production Build (Optional)

```bash
# Build the production bundle
bun run build

# Start the production server
bun run start
```

> Note: The project was built for development. Production deployment may require additional configuration for the gateway, environment variables, and database migration strategy.

---

## 14. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite |
| Auth | Custom session (httpOnly cookie + HMAC) |
| Charts | Recharts |
| Animation | Framer Motion |
| Icons | Lucide React |
| AI | z-ai-web-dev-sdk (LLM insights) |
| PDF | ReportLab (Python, via child_process) |
| Runtime | Bun (recommended) / Node.js |

---

## 15. Quick Start (TL;DR)

```bash
bun install
pip install reportlab
echo "DATABASE_URL=file:./db/custom.db" > .env
bun run db:push
bun run prisma/seed.ts
bun run dev
```

Then open `http://localhost:3000`, click "Choose Role to Continue", pick any role, and sign in with password `esg12345`.
