# MEIL ESG & BRSR Core Reporting Platform (Problem Statement 8)

An enterprise-grade, end-to-end Environmental, Social, and Governance (ESG) & Business Responsibility and Sustainability Reporting (BRSR Core) data governance and disclosure platform built for multi-entity conglomerates.

[![Next.js](https://img.shields.io/badge/Next.js-16%20(Turbopack)-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Architecture & Core Value Chain

```
SOURCE DATA ➔ EVIDENCE VAULT ➔ REAL-TIME VALIDATION ➔ CALCULATION ENGINE
       │
       ▼
SUBMISSION ➔ WORKFLOW STATUS TRACKING ➔ VALIDATION ➔ CONSOLIDATION
       │
       ▼
BRSR CORE MAPPING (SEBI) ➔ AUDIT TRAIL (IMMUTABLE) ➔ STATUTORY DISCLOSURES
```

### Hierarchy Model
- **Group Level:** Group-wide consolidations and reporting
- **Subsidiary Level:** MEIL Power, MEIL Infra, etc.
- **Business Unit Level:** Dedicated functional units
- **Site / Project Level:** Gayatri Solar, Nizamabad Solar, Hyderabad Substation, Kaleshwaram Irrigation, etc.

---

## 🚀 Key Modules & Capabilities

- **Enterprise RBAC Roles:** Pre-configured tailored views for Site Data Owners, Finance Contributors, EHS Specialists, HR Analysts, Procurement Leads, CSR / Compliance Users, and ESG Analysts — add your own roles via `prisma/seed.ts` and `src/lib/role-nav.ts`.
- **Interactive Multi-Level Workflow:** Draft submissions, automated validation checks, evidence linkage, multi-tier approvals, and audit log generation.
- **BRSR Core Indicator Engine:** Comprehensive SEBI BRSR alignment mapping across General Disclosures (Section A), Management Processes (Section B), and Principle-wise Performance (Section C: P1–P9).
- **Carbon Accounting & Emission Factors:** Deterministic Scope 1, Scope 2, and Scope 3 GHG emissions calculations utilizing CEA grid and IPCC emission factors.
- **Evidence Management Vault:** Multi-format document tracking, metadata extraction, verification statuses, and hash checks.
- **Statutory Disclosures & Report Generation:** Direct PDF generation via Python ReportLab, real-time analytics with Recharts, CSV bulk imports, and anomaly detection.

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Node.js** v20+ or **Bun** v1.3+ (Recommended)
- **Python 3.10+** (with `pip` for PDF report generation)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/mrtushar02/bput_ps-8.git
cd bput_ps-8

# Install dependencies (Bun recommended)
bun install
# or
npm install

# Install Python requirements for statutory report rendering
pip install reportlab
```

### 3. Environment & Database Configuration
```bash
# Create .env
echo "DATABASE_URL=file:./db/custom.db" > .env

# Generate Prisma Client & Push DB schema
bun run db:push
bun run db:generate

# Seed sample data (Projects, Users, Emission factors, Historical submissions)
bun run prisma/seed.ts
# or
npx tsx prisma/seed.ts
```

### 4. Run Development Server
```bash
bun run dev
# or
npm run dev
```

Navigate to `http://localhost:3000` to view the platform.

---

## 👥 Demo Logins & Persona Access

Click **"Choose Role to Continue"** on the welcome screen to test any persona instantly. All roles use the default demo password:

| Persona / Role | Demo User Email | Scope |
|----------------|-----------------|-------|
| **Site Data Entry** | `rohit@meil-esg.in` | Gayatri Solar / Nizamabad |
| **Finance & Resource Contributor** | `finance@meil-esg.in` | Turnover, CapEx/OpEx & Resources |
| **EHS Officer** | `kvenkat@meil-esg.in` | Environmental & Safety |
| **HR / Workforce Analyst**| `sunita@meil-esg.in` | Social & Governance Metrics |
| **Procurement Lead** | `priya@meil-esg.in` | Scope 3 & Supply Chain |
| **CSR / Community User** | `imran@meil-esg.in` | Community & CSR Initiatives |
| **Compliance / Governance** | `deepika@meil-esg.in` | Regulatory & Framework Compliance |
| **ESG Analyst** | `sameer@meil-esg.in` | Analytics & Trends |

**Default Password:** `esg12345`

---

## 💻 Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + Radix UI / shadcn/ui
- **Database & ORM:** SQLite via Prisma ORM
- **Visualizations:** Recharts, Lucide Icons, Framer Motion
- **Reports:** Python ReportLab (PDF compiler)
- **Validation:** Zod schemas

---

## 📄 License
This repository is licensed under the MIT License.