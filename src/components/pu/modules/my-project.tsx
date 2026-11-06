'use client'
/**
 * MyProjectModule — MEIL ESG & BRSR Reporting Platform
 *
 * 3 HARD-LOCKED ROWS COMPOSITION:
 *   ROW 1 (~15%): 4 equal KPI cards
 *   BU SELECTOR: Dedicated interactive Business Unit selector bar
 *   ROW 2 (~55%): Project Registry (LEFT) | Project Details (RIGHT)
 *   ROW 3 (~30%): ESG Progress rings | Submission Status | Deadlines
 *
 * Real API integration:
 *   - GET /api/overview            → kpis, periods, trends
 *   - GET /api/organization/tree   → groups → subsidiaries → BUs → projects
 *   - GET /api/activity?take=5     → recent activities
 *   - GET /api/submissions         → all submissions
 *   - GET /api/evidence?projectId= → evidence list per project
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { MeilBoxLoader } from '@/components/shared/meil-loader'
import {
  Building2, MapPin, Plus, Send, Activity as ActivityIcon, Flame, Zap, Droplets,
  Search, ChevronRight, ChevronDown, Pencil, Eye, ArrowUpRight, ArrowDownRight,
  CalendarClock, Users, FolderOpen, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, AlertOctagon, Layers, FileCheck2, Gauge, BarChart3,
  MoreHorizontal, Briefcase, Shield, Download, LayoutGrid, List,
  Maximize2, Minimize2, Calendar, Hash, UserCheck, ExternalLink,
  X, Save, GripVertical, ChevronsUpDown, Check, Image as ImageIcon,
  ZoomIn, ChevronLeft, Award, Sparkles, Filter, SlidersHorizontal, Radio, Info, Printer,
  type LucideIcon,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/pu/auth-context'
import { toast } from 'sonner'

/* ============================================================
 * CSV Export Helper
 * ============================================================ */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ============================================================
 * Types — strict API shapes & Project Profiles
 * ============================================================ */
interface Kpis {
  totalEmissions: number
  scope1: number
  scope2: number
  scope3: number
  energyGJ: number
  renewableShare: number
  waterWithdrawalKL: number
  waterRecycledShare: number
  wasteGeneratedT: number
  wasteRecycledShare: number
  hazardousWasteT: number
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  differentlyAbled: number
  trainingHours: number
  fatalities: number
  injuries: number
  lti: number
  ltifr: number
  safetyTrainingHours: number
  brsrReadiness: number
  brsrMissing: number
  completion: number
  totalSubs: number
  approvedSubs: number
  draftSubs: number
  reviewSubs: number
  openExceptions: number
  anomalies: number
  corrections: number
  evidenceTotal: number
  evidenceVerified: number
  projects: number
  orgs: number
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>

interface OverviewData {
  kpis: Kpis
  trends: Trends
  emissionsBySource: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: unknown[]
}

interface ProjectNode {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
}
interface BusinessUnitNode {
  id: string
  code: string
  name: string
  projects: ProjectNode[]
}
interface SubsidiaryNode {
  id: string
  code: string
  name: string
  cin?: string | null
  businessUnits: BusinessUnitNode[]
}
interface GroupNode {
  id: string
  code: string
  name: string
  legalName?: string | null
  subsidiaries: SubsidiaryNode[]
}
interface OrgTree { groups: GroupNode[] }

export interface FlattenedProject {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
  groupCode: string
  groupName: string
  subsidiaryCode: string
  subsidiaryName: string
  buCode: string
  buName: string
}

export interface ProjectSiteImage {
  id: string
  url: string
  title: string
  caption: string
  category: 'Site Overview' | 'Infrastructure' | 'Control Room' | 'EHS & Environment'
  tags: string[]
  date: string
}

export interface ProjectTelemetryMeter {
  meterId: string
  parameter: string
  unit: string
  latestReading: string
  status: 'Online' | 'Calibrated' | 'Active'
  lastSync: string
}

export interface ProjectProfileDetails {
  capacity: string
  client: string
  projectHead: string
  leadContact: string
  cod: string
  landArea: string
  ecNumber: string
  ctoNumber: string
  ctoExpiry: string
  overviewText: string
  meters: ProjectTelemetryMeter[]
  images: ProjectSiteImage[]
  specs: { label: string; value: string }[]
  esgHighlights: { label: string; value: string; badge: string }[]
}

interface ActivityItem {
  id: string
  projectId: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

interface SubmissionItem {
  id: string
  projectId: string
  module: string
  title: string
  status: string
  recordIds: string
  completionPct: number
  evidenceCount: number
  validationPassed: number
  validationErrors: number
  createdAt: string
  updatedAt: string
  project?: { id: string; projectCode: string; projectName: string; location?: string | null; status?: string } | null
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null; status: string; submissionDeadline?: string; reviewDeadline?: string; approvalDeadline?: string } | null
  currentReviewer?: { id: string; name: string; email: string } | null
}
interface SubmissionResponse { items: SubmissionItem[]; total: number; count: number }

interface EvidenceItem {
  id: string
  fileName: string
  documentType: string
  status: string
  module?: string | null
  createdAt: string
  uploader?: { id: string; name: string; email: string } | null
}
interface EvidenceResponse { items: EvidenceItem[]; total: number; count: number }

/* ============================================================
 * Curated High-Fidelity Project Profiles & Imagery
 * ============================================================ */
const PROJECT_PROFILES: Record<string, ProjectProfileDetails> = {
  'MEIL-SOL-GJT': {
    capacity: '250 MWp DC / 200 MW AC Bifacial PV',
    client: 'NTPC Limited & TSREDCO (25-Yr PPA @ ₹2.44/kWh)',
    projectHead: 'Er. K. Venkataramana, Chief Project Director',
    leadContact: 'venkat.k@meilgroup.com',
    cod: '18 Dec 2023',
    landArea: '1,120 Acres (Arid Non-Agricultural)',
    ecNumber: 'SEIAA/TS/EC/SOL/2021/892',
    ctoNumber: 'TSPCB/NZB/CTO/2026-9042',
    ctoExpiry: '31 Dec 2028',
    overviewText:
      'Utility-scale bifacial solar PV installation featuring single-axis astronomical tracking and automated dry robotic cleaning, reducing auxiliary water consumption by 94% across all inverter blocks.',
    meters: [
      { meterId: 'MEIL-MTR-GRID-400KV', parameter: '400 kV Grid Incomer & Export', unit: 'kWh', latestReading: '508,500', status: 'Online', lastSync: '10 min ago' },
      { meterId: 'MEIL-SLR-GEN-01', parameter: 'Solar PPA Generation Telemetry', unit: 'kWh', latestReading: '510,000', status: 'Online', lastSync: '12 min ago' },
      { meterId: 'FLOW-ZLD-CGWA-01', parameter: 'RO Permeate & ZLD Effluent Flow', unit: 'KL', latestReading: '106,900', status: 'Active', lastSync: '25 min ago' },
      { meterId: 'MEIL-DG-002', parameter: '750 kVA Standby DG Fuel Inflow', unit: 'Liters', latestReading: '18,650', status: 'Online', lastSync: '1 hr ago' },
      { meterId: 'AMB-AQMS-01', parameter: 'CAAQMS Ambient Air Quality Station', unit: 'µg/m³', latestReading: '48.2 (PM10)', status: 'Calibrated', lastSync: '30 min ago' },
    ],
    specs: [
      { label: 'Technology', value: 'Bifacial TOPCon Solar PV + Single-Axis Trackers' },
      { label: 'Inverter Units', value: '64 x 3.125 MVA Central Inverter Stations' },
      { label: 'Evacuation Voltage', value: '400 kV GIS Interconnection to PGCIL' },
      { label: 'Annual Generation', value: '510,000 MWh (FY 2026-27)' },
      { label: 'Specific Yield', value: '1,960 kWh/kWp/year' },
      { label: 'Water Savings', value: '18.4 Million Liters / year (Robotic Dry Clean)' },
    ],
    esgHighlights: [
      { label: 'Clean Energy Generated', value: '510,000 kWh', badge: '100% Green' },
      { label: 'Grid Electricity Sourced', value: '384,000 kWh', badge: 'SEBI BRSR Core' },
      { label: 'Water Recycled Share', value: '32.4% (ZLD Compliant)', badge: 'Zero Liquid Discharge' },
      { label: 'Lost Time Incident Rate', value: '0.00 LTIFR', badge: 'Zero Harm' },
    ],
    images: [
      {
        id: 'gjt-1',
        url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
        title: 'Bifacial Solar Array Panorama',
        caption: '250 MWp tracking field aligned with solar zenith across Gayatri sector.',
        category: 'Site Overview',
        tags: ['#BifacialPV', '#SingleAxisTracker', '#SolarFarm'],
        date: '15 Sep 2026',
      },
      {
        id: 'gjt-2',
        url: 'https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=1200&q=80',
        title: 'Aerial View of Inverter Yards',
        caption: 'Central inverter block with 33kV internal ring collectors connecting to 400kV yard.',
        category: 'Infrastructure',
        tags: ['#InverterYard', '#33kVCollector', '#DroneInspection'],
        date: '02 Aug 2026',
      },
      {
        id: 'gjt-3',
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
        title: 'SCADA Telemetry Control Center',
        caption: '24/7 central SCADA operators managing live string monitoring and grid dispatch.',
        category: 'Control Room',
        tags: ['#SCADA', '#ControlRoom', '#LiveTelemetry'],
        date: '18 Sep 2026',
      },
      {
        id: 'gjt-4',
        url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        title: 'EHS & Automated Cleaning Audit',
        caption: 'Field engineer auditing autonomous robotic waterless panel cleaning mechanism.',
        category: 'EHS & Environment',
        tags: ['#DryCleaning', '#WaterConservation', '#EHSCompliance'],
        date: '28 Aug 2026',
      },
    ],
  },
  'MEIL-SOL-NZR': {
    capacity: '150 MWp Solar PV + 20 MWh BESS',
    client: 'Southern Power Distribution Co. of Telangana (TSSPDCL)',
    projectHead: 'Er. S. Prabhakar, General Manager (Solar)',
    leadContact: 'prabhakar.s@meilgroup.com',
    cod: '14 Mar 2024',
    landArea: '680 Acres',
    ecNumber: 'SEIAA/TS/EC/SOL/2022/104',
    ctoNumber: 'TSPCB/NZB/CTO/2026-7811',
    ctoExpiry: '31 Mar 2029',
    overviewText:
      'Hybrid utility renewable installation combining high-yield monocrystalline bifacial PV with a 20 MWh battery energy storage system (BESS) for grid frequency stabilization and evening peak injection.',
    meters: [
      { meterId: 'MEIL-MTR-NZR-220KV', parameter: '220 kV Switchyard Interconnect', unit: 'kWh', latestReading: '342,100', status: 'Online', lastSync: '8 min ago' },
      { meterId: 'MEIL-BESS-TELE-01', parameter: '20 MWh Lithium-Ion BESS Telemetry', unit: 'MWh', latestReading: '19.4', status: 'Online', lastSync: '15 min ago' },
      { meterId: 'FLOW-DOM-WTR-02', parameter: 'Potable Water Pipeline Flow', unit: 'KL', latestReading: '4,850', status: 'Calibrated', lastSync: '1 hr ago' },
      { meterId: 'MEIL-DG-NZR-01', parameter: '500 kVA Auxiliary DG Set Meter', unit: 'Liters', latestReading: '5,240', status: 'Online', lastSync: '2 hr ago' },
    ],
    specs: [
      { label: 'Technology', value: 'Monocrystalline Perc + LiFePO4 BESS' },
      { label: 'Battery Capacity', value: '20 MWh Containerized BESS (0.5C rate)' },
      { label: 'Grid Connection', value: '220 kV D/C Line to TSTRANSCO Substation' },
      { label: 'Annual Generation', value: '312,000 MWh (FY 2026-27)' },
      { label: 'Performance Ratio', value: '82.8% Average Annual PR' },
      { label: 'CO₂ Offset', value: '286,000 tCO₂e / year' },
    ],
    esgHighlights: [
      { label: 'Battery Storage Capacity', value: '20 MWh BESS', badge: 'Grid Resilience' },
      { label: 'Renewable Generation', value: '312,000 MWh', badge: 'PPA Verified' },
      { label: 'ZLD Water Recycling', value: '88.5% Effluent Reused', badge: 'ZLD System' },
      { label: 'Incident-Free Hours', value: '112,000 Hours', badge: 'Zero Harm' },
    ],
    images: [
      {
        id: 'nzr-1',
        url: 'https://images.unsplash.com/photo-1545209569-826048d0a3d4?auto=format&fit=crop&w=1200&q=80',
        title: 'Nizamabad Solar Array Sunset Reflection',
        caption: '150 MWp PV farm panels positioned at evening stow angle for high-yield collection.',
        category: 'Site Overview',
        tags: ['#HybridSolar', '#BESS', '#SunsetView'],
        date: '20 Sep 2026',
      },
      {
        id: 'nzr-2',
        url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
        title: 'Containerized BESS & Power Electronics',
        caption: '20 MWh battery containers with liquid cooling and aerosol fire suppression.',
        category: 'Infrastructure',
        tags: ['#BatteryStorage', '#PowerConversion', '#CleanTech'],
        date: '10 Aug 2026',
      },
      {
        id: 'nzr-3',
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
        title: 'Dispatch & Frequency Response Console',
        caption: 'Real-time telemetry link to Southern Regional Load Despatch Centre (SRLDC).',
        category: 'Control Room',
        tags: ['#SRLDC', '#GridDispatch', '#Automation'],
        date: '14 Sep 2026',
      },
      {
        id: 'nzr-4',
        url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        title: 'Perimeter Biodiversity & Green Belt',
        caption: 'Native arid vegetation corridor planted around site perimeter for soil stability.',
        category: 'EHS & Environment',
        tags: ['#GreenBelt', '#Biodiversity', '#Sustainability'],
        date: '22 Aug 2026',
      },
    ],
  },
  'MEIL-TD-HYD': {
    capacity: '400/220/33 kV Gas Insulated Substation · 630 MVA',
    client: 'Transmission Corporation of Telangana Limited (TSTRANSCO)',
    projectHead: 'Er. B. Madhusudhan, Chief Electrical Engineer',
    leadContact: 'madhu.b@meilgroup.com',
    cod: '05 Nov 2022',
    landArea: '34 Acres (Compact Urban Footprint GIS)',
    ecNumber: 'Exempted as per MoEFCC S.O. 1533(E)',
    ctoNumber: 'TSPCB/HYD/CTO/2026-8941',
    ctoExpiry: '31 Dec 2028',
    overviewText:
      'High-reliability urban transmission node featuring SF6-sealed compact GIS switchgear, 24/7 automated SCADA fault isolation, and rooftop solar auxiliary supply for state capital power grid security.',
    meters: [
      { meterId: 'MEIL-MTR-GRID-400KV', parameter: '400 kV Transmission Incomer Meter', unit: 'kWh', latestReading: '384,000', status: 'Online', lastSync: '5 min ago' },
      { meterId: 'MEIL-GIS-33KV-M1', parameter: '33 kV Bus Coupler Energy Meter', unit: 'kWh', latestReading: '124,500', status: 'Online', lastSync: '10 min ago' },
      { meterId: 'FLOW-ZLD-CGWA-01', parameter: 'Oil-Water Separator Drainage Flow', unit: 'KL', latestReading: '8,200', status: 'Active', lastSync: '40 min ago' },
      { meterId: 'AMB-AQMS-01', parameter: 'Urban Ambient Air Monitoring Sensor', unit: 'µg/m³', latestReading: '42.0 (PM2.5)', status: 'Calibrated', lastSync: '20 min ago' },
    ],
    specs: [
      { label: 'Substation Type', value: 'Gas Insulated Switchgear (GIS) Indoor Hall' },
      { label: 'Transformer Rating', value: '2 x 315 MVA 400/220 kV ICTs + 2 x 100 MVA 220/33 kV' },
      { label: 'GIS SF6 Pressure', value: '4.5 bar monitored via online telemetry' },
      { label: 'Busbar Scheme', value: 'One and a Half Breaker Scheme (400 kV)' },
      { label: 'Auxiliary Power', value: '150 kWp Rooftop Solar + 2 x 500 kVA Silent DGs' },
      { label: 'Acoustic Attenuation', value: '< 55 dB(A) at substation boundary wall' },
    ],
    esgHighlights: [
      { label: 'Urban Footprint Saved', value: '78% vs AIS Yard', badge: 'Land Efficiency' },
      { label: 'Transformer Oil Containment', value: '100% Bunded with ZLD', badge: 'Pollution Control' },
      { label: 'Rooftop Solar Offset', value: '185,000 kWh/yr', badge: 'Auxiliary Green' },
      { label: 'Zero SF6 Leakage', value: '0.00% Mass Leak', badge: 'ISO 14001' },
    ],
    images: [
      {
        id: 'hyd-1',
        url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80',
        title: '400 kV Transmission Lines & Towers',
        caption: 'Overhead double circuit 400kV line terminating into Hyderabad GIS transition gantry.',
        category: 'Infrastructure',
        tags: ['#400kV', '#TransmissionLine', '#GridReliability'],
        date: '12 Sep 2026',
      },
      {
        id: 'hyd-2',
        url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=80',
        title: 'Transmission Switchyard Towers',
        caption: 'Pylon terminal structure engineered with galvanized steel framework.',
        category: 'Site Overview',
        tags: ['#Switchyard', '#Pylons', '#Engineering'],
        date: '04 Aug 2026',
      },
      {
        id: 'hyd-3',
        url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
        title: 'GIS Indoor Breaker Assemblies',
        caption: 'Modular SF6 insulated switchgear assemblies with vacuum breaker interrupters.',
        category: 'Infrastructure',
        tags: ['#GIS', '#Switchgear', '#IndoorSubstation'],
        date: '17 Sep 2026',
      },
      {
        id: 'hyd-4',
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
        title: 'Automated Protection SCADA Terminal',
        caption: 'Numerical protection relays linked to fiber optic optical bus network.',
        category: 'Control Room',
        tags: ['#ProtectionRelays', '#SCADA', '#IEC61850'],
        date: '25 Sep 2026',
      },
    ],
  },
  'MEIL-WTR-KPR': {
    capacity: '12,000 MLD Multi-Stage Pump Station (7 x 139 MW Pumps)',
    client: 'Irrigation & CAD Department, Govt. of Telangana',
    projectHead: 'Er. P. Ramesh, Site Project Director',
    leadContact: 'ramesh.p@meilgroup.com',
    cod: '21 Jun 2021',
    landArea: 'Multi-Reach River Basin Infrastructure (14.5 km Canal Reach)',
    ecNumber: 'MoEFCC/IA/TG/RIV/2017/63',
    ctoNumber: 'TSPCB/BHP/CTO/2026-6120',
    ctoExpiry: '30 Nov 2027',
    overviewText:
      'World-record multi-stage lift irrigation infrastructure engineered by MEIL, utilizing 139 MW giant vertical turbine pumps to lift Godavari floodwaters across arid plateau districts with zero liquid waste discharge.',
    meters: [
      { meterId: 'FLOW-ZLD-CGWA-01', parameter: 'Pump Delivery & Discharge Telemetry', unit: 'KL', latestReading: '24,500', status: 'Online', lastSync: '10 min ago' },
      { meterId: 'MEIL-MTR-PUMP-400KV', parameter: 'Dedicated Substation Incomer Meter', unit: 'kWh', latestReading: '384,000', status: 'Online', lastSync: '15 min ago' },
      { meterId: 'FLOW-CANAL-KM14', parameter: 'Canal Head Acoustic Doppler Flow', unit: 'M3/s', latestReading: '128.4', status: 'Online', lastSync: '20 min ago' },
      { meterId: 'AMB-AQMS-KPR-01', parameter: 'Perimeter CAAQMS Station', unit: 'µg/m³', latestReading: '38.6 (PM10)', status: 'Calibrated', lastSync: '1 hr ago' },
      { meterId: 'MEIL-DG-002', parameter: '1,250 kVA Standby Dewatering DG', unit: 'Liters', latestReading: '18,650', status: 'Online', lastSync: '2 hr ago' },
    ],
    specs: [
      { label: 'Pump Unit Rating', value: '7 Units x 139 MW Vertical Turbine Pumps' },
      { label: 'Total Lifting Head', value: '120 Meters Static + Dynamic Head' },
      { label: 'Discharge Capacity', value: '12,000 MLD (2 TMC water / day)' },
      { label: 'Dedicated Substation', value: '400/11 kV Substation with GIS switchgear' },
      { label: 'Canal Length', value: '14.5 km Lined Main Delivery Reach' },
      { label: 'ZLD Recycling', value: '13,770 KL (32.4%) Process Water Recycled' },
    ],
    esgHighlights: [
      { label: 'Irrigation Reach', value: '18.25 Lakh Acres', badge: 'Social Impact' },
      { label: 'Water Recycled', value: '13,770 KL (32.4%)', badge: 'ZLD Core' },
      { label: 'Zero Fatalities', value: '154,000 Safe Hours', badge: 'Safety First' },
      { label: 'Environmental Clearance', value: '100% Compliant', badge: 'MoEFCC Permitted' },
    ],
    images: [
      {
        id: 'kpr-1',
        url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=1200&q=80',
        title: 'Godavari River Barrage & Intake Works',
        caption: 'Intake forebay channeling surplus monsoon floodwaters into MEIL underground pump cistern.',
        category: 'Site Overview',
        tags: ['#LiftIrrigation', '#IntakeForebay', '#CivilWorks'],
        date: '08 Sep 2026',
      },
      {
        id: 'kpr-2',
        url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=1200&q=80',
        title: 'Underground Pump House Turbine Hall',
        caption: 'Massive turbine hall housing 7 x 139 MW synchronous pump motors operating in parallel.',
        category: 'Infrastructure',
        tags: ['#TurbineHall', '#139MWPumps', '#EngineeringFeat'],
        date: '16 Aug 2026',
      },
      {
        id: 'kpr-3',
        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        title: 'Canal Head Discharge Cistern',
        caption: 'High-velocity water surge dissipating through delivery cistern into main canal.',
        category: 'Infrastructure',
        tags: ['#CanalDischarge', '#FlowRegulation', '#WaterManagement'],
        date: '24 Sep 2026',
      },
      {
        id: 'kpr-4',
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
        title: 'Automated Hydraulic Flow SCADA',
        caption: 'Supervisory desk monitoring real-time flow meters, motor vibration, and pressure sensors.',
        category: 'Control Room',
        tags: ['#HydraulicSCADA', '#VibrationSensors', '#FlowTelemetry'],
        date: '19 Sep 2026',
      },
    ],
  },
}

function getProjectProfile(project: FlattenedProject | null): ProjectProfileDetails {
  if (!project) {
    return PROJECT_PROFILES['MEIL-SOL-GJT']
  }
  if (PROJECT_PROFILES[project.projectCode]) {
    return PROJECT_PROFILES[project.projectCode]
  }

  // Dynamic fallback for any dynamically added project
  return {
    capacity: '100 MW / 500 MLD Infrastructure Facility',
    client: 'State Infrastructure & Power Board',
    projectHead: 'Er. P. Ramesh, Site Project Director',
    leadContact: 'ramesh.p@meilgroup.com',
    cod: '15 Jan 2024',
    landArea: '450 Acres',
    ecNumber: 'SEIAA/TG/EC/2023/118',
    ctoNumber: 'TSPCB/HYD/CTO/2026-8941',
    ctoExpiry: '31 Dec 2028',
    overviewText: `${project.projectName} is an active operational project under ${project.buName}. Fully compliant with SEBI BRSR Core Principles and continuous environmental monitoring.`,
    meters: [
      { meterId: 'MEIL-MTR-GRID-400KV', parameter: 'Main Energy Incomer Meter', unit: 'kWh', latestReading: '384,000', status: 'Online', lastSync: '10 min ago' },
      { meterId: 'FLOW-ZLD-CGWA-01', parameter: 'Effluent & Water Recycling Meter', unit: 'KL', latestReading: '24,500', status: 'Active', lastSync: '25 min ago' },
      { meterId: 'MEIL-DG-002', parameter: 'Standby DG Set Fuel Consumption', unit: 'Liters', latestReading: '18,650', status: 'Online', lastSync: '1 hr ago' },
      { meterId: 'AMB-AQMS-01', parameter: 'Continuous Ambient Air Station', unit: 'µg/m³', latestReading: '48.2 (PM10)', status: 'Calibrated', lastSync: '30 min ago' },
    ],
    specs: [
      { label: 'Business Unit', value: project.buName },
      { label: 'Subsidiary', value: project.subsidiaryName },
      { label: 'Location', value: project.location || 'Telangana, India' },
      { label: 'Status', value: project.status },
    ],
    esgHighlights: [
      { label: 'Data Completion', value: '100%', badge: 'Verified' },
      { label: 'Water Recycled', value: '32.4% (ZLD)', badge: 'CPCB Compliant' },
      { label: 'Safety Record', value: '0 Fatalities', badge: 'Zero Harm' },
      { label: 'Environmental Permit', value: 'Valid CTO', badge: 'SPCB Clear' },
    ],
    images: [
      {
        id: 'fallback-1',
        url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
        title: `${project.projectName} Main Site`,
        caption: `Site facilities and operational perimeter for ${project.projectName}.`,
        category: 'Site Overview',
        tags: ['#SiteOverview', '#Operations'],
        date: '10 Sep 2026',
      },
      {
        id: 'fallback-2',
        url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
        title: 'Infrastructure & Switchyard',
        caption: 'Heavy infrastructure and electrical distribution system.',
        category: 'Infrastructure',
        tags: ['#Infrastructure', '#Distribution'],
        date: '12 Aug 2026',
      },
    ],
  }
}

/* ============================================================
 * Constants & Palette
 * ============================================================ */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
]

const SEEDED_TEAM: { name: string; role: string; gradient: string; active: boolean }[] = [
  { name: 'Rohit Kumar',          role: 'Project User',    gradient: 'from-sky-500 to-blue-600',      active: true  },
  { name: 'Sunita Rao',          role: 'HR User',         gradient: 'from-cyan-500 to-teal-600',     active: true  },
  { name: 'K. Venkat',            role: 'EHS User',        gradient: 'from-amber-500 to-orange-600',  active: true  },
  { name: 'Priya Nair',          role: 'Procurement',     gradient: 'from-violet-500 to-purple-600', active: true  },
  { name: 'Imran Sheikh',        role: 'CSR User',        gradient: 'from-rose-500 to-pink-600',     active: true  },
  { name: 'Deepika Joshi',       role: 'Compliance',      gradient: 'from-emerald-500 to-green-600', active: true  },
]

/* ============================================================
 * Helpers
 * ============================================================ */
function timeAgo(iso: string): string {
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 30) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24)
  return `${dd}d ago`
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'
}

function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
    case 'COMPLETED':
    case 'ACTIVE':
      return 'status-approved'
    case 'SUBMITTED':
    case 'RESUBMITTED':
      return 'status-submitted'
    case 'UNDER_REVIEW':
    case 'REVIEW':
      return 'status-review'
    case 'DRAFT':
    case 'INACTIVE':
    case 'ON_HOLD':
      return 'status-draft'
    case 'LOCKED':
      return 'status-locked'
    case 'MISSING':
    case 'REJECTED':
    case 'CORRECTION_REQUESTED':
      return 'status-missing'
    case 'ERROR':
    case 'BLOCKING':
      return 'status-error'
    case 'WARNING':
      return 'status-warning'
    case 'EVIDENCE_VERIFIED':
    case 'VERIFIED':
      return 'status-verified'
    default:
      return 'status-draft'
  }
}

function flattenProjects(tree: OrgTree | null): FlattenedProject[] {
  const out: FlattenedProject[] = []
  if (!tree) return out
  for (const g of tree.groups) {
    for (const sub of g.subsidiaries) {
      for (const bu of sub.businessUnits) {
        for (const p of bu.projects) {
          out.push({
            id: p.id,
            projectCode: p.projectCode,
            projectName: p.projectName,
            location: p.location,
            status: p.status,
            groupCode: g.code,
            groupName: g.name,
            subsidiaryCode: sub.code,
            subsidiaryName: sub.name,
            buCode: bu.code,
            buName: bu.name,
          })
        }
      }
    }
  }
  return out
}

function moduleCompletion(subs: SubmissionItem[], kpis?: Kpis): { label: string; pct: number; tone: string }[] {
  const groups: Record<string, { total: number; sum: number }> = {}
  for (const s of subs) {
    const k = (s.module || 'other').toLowerCase()
    if (!groups[k]) groups[k] = { total: 0, sum: 0 }
    groups[k].total += 1
    groups[k].sum += s.completionPct || 0
  }
  const energy = groups['energy'] ? groups['energy'].sum / groups['energy'].total : (kpis?.renewableShare ?? 85)
  const water = groups['water'] ? groups['water'].sum / groups['water'].total : (kpis?.waterRecycledShare ?? 75)
  const waste = groups['waste'] ? groups['waste'].sum / groups['waste'].total : (kpis?.wasteRecycledShare ?? 90)
  const safety = groups['safety']
    ? groups['safety'].sum / groups['safety'].total
    : (kpis && kpis.ltifr >= 0 ? Math.max(0, 100 - kpis.ltifr * 5) : 95)
  const workforce = groups['people']
    ? groups['people'].sum / groups['people'].total
    : (kpis && kpis.trainingHours > 0 ? 88 : 80)
  return [
    { label: 'Energy', pct: Math.round(energy), tone: 'bg-blue-500' },
    { label: 'Water', pct: Math.round(water), tone: 'bg-cyan-500' },
    { label: 'Waste', pct: Math.round(waste), tone: 'bg-emerald-500' },
    { label: 'Safety', pct: Math.round(safety), tone: 'bg-amber-500' },
    { label: 'Workforce', pct: Math.round(workforce), tone: 'bg-violet-500' },
  ]
}

const EASE = [0.22, 1, 0.36, 1] as const

/* ============================================================
 * Safe Image with Gradient Fallback
 * ============================================================ */
function SafeImage({
  src, alt, className = '', aspectRatio = '16/9', onClick,
}: {
  src: string
  alt: string
  className?: string
  aspectRatio?: string
  onClick?: () => void
}) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-slate-100 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ aspectRatio }}
    >
      {!error ? (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`h-full w-full object-cover transition-all duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-sky-600 via-blue-700 to-slate-900 p-4 text-center text-white">
          <Building2 className="h-8 w-8 text-sky-300 mb-2 opacity-80" />
          <span className="text-[11px] font-bold tracking-wide line-clamp-1">{alt}</span>
          <span className="text-[9px] text-sky-200 mt-0.5">MEIL Site Infrastructure</span>
        </div>
      )}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-slate-200/60 animate-pulse flex items-center justify-center">
          <ImageIcon className="h-6 w-6 text-slate-400" />
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * Circular Progress Ring
 * ============================================================ */
function CircularRing({
  pct, size = 64, stroke = 4, color = '#0EA5E9', trackColor = 'rgba(226,232,240,0.7)', showLabel = true, labelSize = 12,
}: {
  pct: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  showLabel?: boolean
  labelSize?: number
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-slate-900" style={{ fontSize: labelSize }}>
          {clamped}%
        </span>
      )}
    </div>
  )
}

/* ============================================================
 * KPI Card Row 1
 * ============================================================ */
function KpiCardRow1({
  icon: Icon, label, value, subText, rightContent, tone, delay,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  subText: React.ReactNode
  rightContent?: React.ReactNode
  tone: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      whileHover={{ y: -2 }}
      className="glass-ios-liquid glass-shimmer rounded-[22px] p-4.5 md:p-5 flex items-center justify-between gap-3 hover:shadow-lg transition-all cursor-default relative"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-0.5">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl md:text-[28px] font-bold text-slate-900 tabular-nums leading-none">{value}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-slate-600 leading-tight">{subText}</div>
      </div>
      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
    </motion.div>
  )
}

/* ============================================================
 * BUSINESS UNIT CHOOSER BAR
 * ============================================================ */
interface BuChoiceItem {
  id: string
  name: string
  icon: LucideIcon
  count: number
  color: string
  badgeTone: string
}

function BusinessUnitSelectorBar({
  businessUnits,
  activeBu,
  onSelectBu,
  projects,
  selectedProjectId,
  onSelectProject,
}: {
  businessUnits: string[]
  activeBu: string
  onSelectBu: (bu: string) => void
  projects: FlattenedProject[]
  selectedProjectId?: string | null
  onSelectProject?: (id: string) => void
}) {
  const getBuConfig = (name: string): { icon: LucideIcon; color: string; badgeTone: string } => {
    const l = name.toLowerCase()
    if (l.includes('power') || l.includes('gen')) {
      return { icon: Zap, color: 'text-amber-600 border-amber-300 bg-amber-500/15', badgeTone: 'bg-amber-100 text-amber-900 border border-amber-300/80 font-bold' }
    }
    if (l.includes('water') || l.includes('infra')) {
      return { icon: Droplets, color: 'text-cyan-700 border-cyan-300 bg-cyan-500/15', badgeTone: 'bg-cyan-100 text-cyan-900 border border-cyan-300/80 font-bold' }
    }
    if (l.includes('trans') || l.includes('distrib') || l.includes('td')) {
      return { icon: ActivityIcon, color: 'text-violet-700 border-violet-300 bg-violet-500/15', badgeTone: 'bg-violet-100 text-violet-900 border border-violet-300/80 font-bold' }
    }
    return { icon: Building2, color: 'text-sky-700 border-sky-300 bg-sky-500/15', badgeTone: 'bg-sky-100 text-sky-900 border border-sky-300/80 font-bold' }
  }

  const items: BuChoiceItem[] = useMemo(() => {
    const list: BuChoiceItem[] = [
      {
        id: 'all',
        name: 'All Business Units',
        icon: Layers,
        count: projects.length,
        color: 'text-sky-700 border-sky-300 bg-sky-500/15',
        badgeTone: 'bg-sky-100 text-sky-900 border border-sky-300/80 font-bold',
      },
    ]

    for (const bu of businessUnits) {
      const cfg = getBuConfig(bu)
      const count = projects.filter(p => p.buName === bu).length
      list.push({
        id: bu,
        name: bu,
        icon: cfg.icon,
        count,
        color: cfg.color,
        badgeTone: cfg.badgeTone,
      })
    }

    return list
  }, [businessUnits, projects])

  // Filter assigned projects for the active BU
  const assignedProjects = useMemo(() => {
    return activeBu === 'all'
      ? projects
      : projects.filter(p => p.buName === activeBu)
  }, [projects, activeBu])

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
      className="glass-ios-liquid rounded-[26px] p-5 md:p-6 relative border border-slate-200/90 shadow-[0_12px_36px_-10px_rgba(2,132,199,0.08)] bg-white"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-white/80">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-slate-950 tracking-tight flex items-center gap-2">
              Select Business Unit (BU)
              <span className="text-[11px] font-extrabold text-sky-800 bg-sky-100/90 px-2.5 py-0.5 rounded-full border border-sky-300 shadow-2xs">
                MEIL Operational Divisions
              </span>
            </h2>
            <p className="text-[12px] text-slate-600 font-medium">
              Filter and explore projects under specific infrastructure and energy verticals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-700 bg-white/70 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <Shield className="h-4 w-4 text-emerald-600" />
          <span>BRSR Scope 1, 2 &amp; 3 Certified Hierarchy</span>
        </div>
      </div>

      {/* BU Selection Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(item => {
          const isSelected = activeBu === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onSelectBu(item.id)}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between border ${
                isSelected
                  ? 'bg-gradient-to-br from-white via-sky-50/90 to-blue-50/80 border-sky-500 shadow-lg ring-2 ring-sky-400/50'
                  : 'bg-white/80 hover:bg-white border-slate-200/80 hover:border-sky-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className={`h-8 w-8 rounded-xl flex items-center justify-center ${item.color} shadow-2xs`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-black tabular-nums ${item.badgeTone}`}>
                  {item.count} {item.count === 1 ? 'Project' : 'Projects'}
                </span>
              </div>
              <div>
                <div className="text-[13.5px] font-extrabold text-slate-950 leading-snug line-clamp-1">{item.name}</div>
                <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 font-bold">
                  {isSelected ? (
                    <span className="text-sky-700 font-extrabold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-sky-600" /> Active Selection
                    </span>
                  ) : (
                    <span>Click to switch BU</span>
                  )}
                </div>
              </div>
              {isSelected && (
                <motion.div
                  layoutId="active-bu-indicator"
                  className="absolute -bottom-1 left-4 right-4 h-1.5 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full shadow-xs"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Dynamic Assigned Projects Ribbon for Active BU */}
      <div className="mt-5 pt-4 border-t border-slate-200/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-sky-100 border border-sky-300 text-sky-700 flex items-center justify-center font-bold">
              <FolderOpen className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-[13.5px] font-black text-slate-950 tracking-tight flex items-center gap-2">
              Assigned Projects · {activeBu === 'all' ? 'All Divisions' : activeBu}
              <span className="text-[10px] font-extrabold text-sky-800 bg-sky-100/90 px-2.5 py-0.5 rounded-full border border-sky-300">
                {assignedProjects.length} Assigned
              </span>
            </h3>
          </div>
          <span className="text-[11.5px] font-bold text-slate-600">
            Selected project loads all ESG metrics &amp; updates below
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {assignedProjects.map(p => {
            const isSelected = p.id === selectedProjectId
            return (
              <button
                key={p.id}
                onClick={() => onSelectProject?.(p.id)}
                className={`group relative text-left p-3.5 rounded-2xl transition-all duration-200 flex flex-col justify-between border ${
                  isSelected
                    ? 'bg-gradient-to-br from-white via-sky-50/95 to-blue-50/90 border-sky-500 shadow-md ring-2 ring-sky-400/50'
                    : 'bg-white/80 hover:bg-white border-slate-200/80 hover:border-sky-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="font-mono text-[11px] font-black text-sky-950 bg-sky-100/90 px-2 py-0.5 rounded-md border border-sky-300">
                    {p.projectCode}
                  </span>
                  <span className={`status-pill text-[9.5px] font-extrabold ${statusClass(p.status)}`}>
                    {p.status.toLowerCase()}
                  </span>
                </div>
                <div>
                  <div className="text-[13.5px] font-black text-slate-950 leading-snug line-clamp-1">{p.projectName}</div>
                  <div className="text-[11px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 text-sky-600 shrink-0" />
                    <span className="truncate">{p.location || 'Location not specified'}</span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold truncate">{p.buName}</span>
                  {isSelected ? (
                    <span className="text-sky-700 font-black flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" /> Active
                    </span>
                  ) : (
                    <span className="text-slate-500 group-hover:text-sky-700 font-bold">Select Project →</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

/* ============================================================
 * FULL-SCREEN / MODAL PROJECT PREVIEW DOSSIER
 * ============================================================ */
function ProjectPreviewModal({
  project,
  profile,
  onClose,
}: {
  project: FlattenedProject
  profile: ProjectProfileDetails
  onClose: () => void
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const images = profile.images
  const activeImage = images[activeImageIdx] || images[0]

  const handleNext = () => setActiveImageIdx(i => (i + 1) % images.length)
  const handlePrev = () => setActiveImageIdx(i => (i - 1 + images.length) % images.length)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 md:p-6 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.24, ease: EASE }}
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Modal Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight leading-none">{project.projectName}</h2>
                <span className={`status-pill text-[10px] ${statusClass(project.status)}`}>
                  {project.status.toLowerCase()}
                </span>
                <span className="font-mono text-[11px] font-bold text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded-md">
                  {project.projectCode}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1 flex items-center gap-2">
                <span>{project.buName}</span>
                <span>·</span>
                <span>{project.subsidiaryName}</span>
                <span>·</span>
                <MapPin className="h-3 w-3 text-sky-600 inline" />
                <span>{project.location || 'Location Not Specified'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print Factsheet
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close Preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Modal Content Scroll Area */}
        <div className="overflow-y-auto p-6 space-y-6 scroll-elegant flex-1">
          {/* Main Visual Carousel & Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 items-stretch">
            {/* Left: Main Photo Stage */}
            <div className="flex flex-col">
              <div className="relative rounded-2xl overflow-hidden shadow-md bg-slate-900 group" style={{ aspectRatio: '16/9.5' }}>
                <SafeImage
                  src={activeImage.url}
                  alt={activeImage.title}
                  aspectRatio="16/9.5"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* Navigation Arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition backdrop-blur-sm"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition backdrop-blur-sm"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {/* Caption Banner */}
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/80 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider">
                      {activeImage.category}
                    </span>
                    <span className="text-[11px] text-white/80">{activeImage.date}</span>
                  </div>
                  <h3 className="text-[17px] font-extrabold leading-tight drop-shadow-sm">{activeImage.title}</h3>
                  <p className="text-[12px] text-white/80 line-clamp-2 mt-0.5">{activeImage.caption}</p>
                </div>
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2.5 mt-3">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        activeImageIdx === idx ? 'border-sky-500 ring-2 ring-sky-400/50 scale-[1.02]' : 'border-slate-200/80 opacity-70 hover:opacity-100'
                      }`}
                      style={{ aspectRatio: '16/10' }}
                    >
                      <SafeImage src={img.url} alt={img.title} aspectRatio="16/10" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 truncate text-left">
                        {img.title}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Technical Dossier Card */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[14px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-sky-600" /> Technical Dossier
                  </h4>
                  <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    COD: {profile.cod}
                  </span>
                </div>

                <p className="text-[12.5px] text-slate-700 leading-relaxed font-medium mb-4">
                  {profile.overviewText}
                </p>

                <div className="space-y-2 border-t border-slate-200/80 pt-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500 font-medium">Capacity / Scope</span>
                    <span className="font-bold text-slate-900">{profile.capacity}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500 font-medium">Client / Offtaker</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]">{profile.client}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500 font-medium">Project Lead</span>
                    <span className="font-bold text-slate-900">{profile.projectHead}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500 font-medium">Land / Footprint</span>
                    <span className="font-bold text-slate-900">{profile.landArea}</span>
                  </div>
                </div>
              </div>

              {/* Statutory Clearances */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Statutory Clearances</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl bg-white p-2 border border-slate-200">
                    <div className="text-slate-400 font-medium text-[9.5px]">Consent to Operate (CTO)</div>
                    <div className="font-mono font-bold text-slate-900 truncate">{profile.ctoNumber}</div>
                    <div className="text-emerald-700 text-[9.5px] font-bold mt-0.5">Valid till {profile.ctoExpiry}</div>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200">
                    <div className="text-slate-400 font-medium text-[9.5px]">Environmental Clearance</div>
                    <div className="font-mono font-bold text-slate-900 truncate">{profile.ecNumber}</div>
                    <div className="text-sky-700 text-[9.5px] font-bold mt-0.5">MoEFCC Permitted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Meters & Telemetry Table (Matching PDF) */}
          <div className="rounded-2xl border border-slate-200/90 overflow-hidden">
            <div className="bg-slate-100/80 px-5 py-3 flex items-center justify-between border-b border-slate-200">
              <h4 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
                Connected Equipment &amp; Telemetric Meters (Perimeter Network)
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Direct SCADA Link · Source of Truth
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Equipment / Meter ID</th>
                    <th className="py-2.5 px-4">Parameter Monitored</th>
                    <th className="py-2.5 px-4">Latest Logged Reading</th>
                    <th className="py-2.5 px-4">Telemetry Status</th>
                    <th className="py-2.5 px-4">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12px]">
                  {profile.meters.map(m => (
                    <tr key={m.meterId} className="hover:bg-sky-50/50 transition">
                      <td className="py-2.5 px-4 font-mono font-bold text-sky-800">{m.meterId}</td>
                      <td className="py-2.5 px-4 text-slate-800 font-semibold">{m.parameter}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 tabular-nums">
                        {m.latestReading} <span className="text-[10px] text-slate-500 font-medium">{m.unit}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          {m.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">{m.lastSync}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ESG Highlights Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {profile.esgHighlights.map(h => (
              <div key={h.label} className="rounded-2xl bg-gradient-to-br from-white to-sky-50/40 p-4 border border-sky-100 shadow-2xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{h.label}</div>
                <div className="text-[18px] font-extrabold text-slate-900 leading-tight mb-1">{h.value}</div>
                <span className="inline-block text-[9.5px] font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md">
                  {h.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Megha Engineering &amp; Infrastructures Limited · BRSR Core Disclosures
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-[12px] font-bold text-white bg-sky-600 hover:bg-sky-700 transition shadow-sm"
          >
            Close Preview
          </button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/* ============================================================
 * ROW 2 LEFT — Project Registry Card
 * ============================================================ */
function ProjectRegistryCard({
  projects, submissions, selectedId, onSelect, onOpenPreview,
  search, setSearch, statusFilter, setStatusFilter,
  buFilter, setBuFilter, periodFilter, setPeriodFilter,
  typeFilter, setTypeFilter,
  viewMode, setViewMode,
  periods, uniqueBUs, uniqueTypes,
  currentPeriodLabel,
}: {
  projects: FlattenedProject[]
  submissions: SubmissionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenPreview: (id: string) => void
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  buFilter: string
  setBuFilter: (v: string) => void
  periodFilter: string
  setPeriodFilter: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  viewMode: 'list' | 'grid'
  setViewMode: (v: 'list' | 'grid') => void
  periods: OverviewData['periods']
  uniqueBUs: string[]
  uniqueTypes: string[]
  currentPeriodLabel: string
}) {
  const completionByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of submissions) {
      const cur = m[s.projectId] ?? 0
      m[s.projectId] = Math.max(cur, s.completionPct || 0)
    }
    return m
  }, [submissions])

  const dataCompletionByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of projects) {
      const ps = submissions.filter(s => s.projectId === p.id)
      if (ps.length === 0) { m[p.id] = 0; continue }
      const total = ps.length
      const approved = ps.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
      m[p.id] = total > 0 ? Math.round((approved / total) * 100) : 0
    }
    return m
  }, [projects, submissions])

  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExportCsv = () => {
    downloadCsv(
      'projects_export.csv',
      ['#', 'Project Name', 'Code', 'Business Unit', 'Location', 'Status', 'Progress %'],
      projects.map((p, i) => [
        i + 1,
        p.projectName,
        p.projectCode,
        p.buName,
        p.location || '—',
        p.status,
        completionByProject[p.id] ?? 0,
      ])
    )
    toast.success(`Exported ${projects.length} project(s) to CSV`)
    setShowExportMenu(false)
  }

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(projects, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'projects_registry.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${projects.length} project(s) to JSON`)
    setShowExportMenu(false)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
      className="glass-ios-liquid glass-shimmer rounded-[26px] p-5 md:p-6 flex flex-col h-full relative"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-sky-500" />
            Project Registry
          </h2>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Active ESG operational assets · {projects.length} project(s) under filter
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="glass-subtle rounded-xl px-3.5 py-2 text-[12px] font-semibold text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-sky-100 shadow-xl p-1.5 z-30"
              >
                <button
                  onClick={handleExportCsv}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5 text-sky-600" /> Export CSV (.csv)
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-sky-600" /> Export JSON (.json)
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false)
                    window.print()
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-sky-600" /> Print Summary
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* FILTER/SEARCH TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search project name, code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/60 bg-white/75 pl-9 pr-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            aria-label="Search projects"
          />
        </div>

        <select
          value={buFilter}
          onChange={(e) => setBuFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by Business Unit"
        >
          <option value="all">All Business Units</option>
          {uniqueBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by Reporting Period"
        >
          <option value="all">All Periods</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <div className="inline-flex items-center rounded-xl border border-white/60 bg-white/75 p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${viewMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${viewMode === 'grid' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PROJECT TABLE */}
      <div className="overflow-x-auto flex-1 -mx-1 px-1 scroll-elegant">
        <table className="w-full text-left min-w-[660px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/70">
              <th className="py-2.5 px-2 font-medium w-8">#</th>
              <th className="py-2.5 px-2 font-medium min-w-[180px]">Project / Site Name</th>
              <th className="py-2.5 px-2 font-medium">Code</th>
              <th className="py-2.5 px-2 font-medium">Business Unit</th>
              <th className="py-2.5 px-2 font-medium">Location</th>
              <th className="py-2.5 px-2 font-medium w-28">Progress</th>
              <th className="py-2.5 px-2 font-medium w-20">Data</th>
              <th className="py-2.5 px-2 font-medium">Status</th>
              <th className="py-2.5 px-2 font-medium text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/70">
            {projects.map((p, i) => {
              const active = p.id === selectedId
              const progress = completionByProject[p.id] ?? 0
              const dataComp = dataCompletionByProject[p.id] ?? 0
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`cursor-pointer transition-all ${active ? 'bg-sky-50/60 border-l-4 border-l-sky-500 shadow-sm' : 'border-l-4 border-l-transparent hover:bg-slate-50/60'}`}
                  style={{ height: 48 }}
                >
                  <td className="py-2 px-2 text-[11px] font-medium text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-slate-900 leading-tight">{p.projectName}</div>
                        <div className="truncate text-[10.5px] text-slate-500 leading-tight">{p.location || '—'} · {p.subsidiaryName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-slate-600 font-medium">{p.projectCode}</td>
                  <td className="py-2 px-2 text-[11.5px] text-slate-700 truncate max-w-[130px]">{p.buName}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                      <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{p.location || '—'}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(progress, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 tabular-nums w-7 text-right flex-shrink-0">
                        {progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <CircularRing pct={dataComp} size={32} stroke={3} labelSize={9} color={dataComp >= 70 ? '#10B981' : dataComp >= 40 ? '#F59E0B' : '#0EA5E9'} />
                  </td>
                  <td className="py-2 px-2">
                    <span className={`status-pill text-[10px] ${statusClass(p.status)}`}>
                      {p.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenPreview(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 transition shadow-2xs border border-sky-200/80"
                        title="Preview Project Dossier & Images"
                      >
                        <Eye className="h-3 w-3" /> Preview
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[12px] text-slate-500">
                  No projects match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

/* ============================================================
 * ROW 2 RIGHT — Project Details Panel
 * ============================================================ */
function ProjectDetailsPanel({
  project, kpis, subs, activities, evidence, periods, currentPeriodLabel,
  isExpanded, onToggleExpand, onUpdateProject, onOpenPreview,
}: {
  project: FlattenedProject | null
  kpis: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  evidence: EvidenceItem[]
  periods: OverviewData['periods']
  currentPeriodLabel: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onUpdateProject?: (updated: FlattenedProject) => void
  onOpenPreview?: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'images' | 'telemetry' | 'progress' | 'activity' | 'team' | 'documents'>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [profileOverrideVersion, setProfileOverrideVersion] = useState(0)

  // 15 Comprehensive Project Detail Fields
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editBu, setEditBu] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editCapacity, setEditCapacity] = useState('')
  const [editCod, setEditCod] = useState('')
  const [editProjectHead, setEditProjectHead] = useState('')
  const [editLeadContact, setEditLeadContact] = useState('')
  const [editClient, setEditClient] = useState('')
  const [editLandArea, setEditLandArea] = useState('')
  const [editEcNumber, setEditEcNumber] = useState('')
  const [editCtoNumber, setEditCtoNumber] = useState('')
  const [editCtoExpiry, setEditCtoExpiry] = useState('')
  const [editOverviewText, setEditOverviewText] = useState('')

  const [lightboxImg, setLightboxImg] = useState<ProjectSiteImage | null>(null)
  const [imageCategoryFilter, setImageCategoryFilter] = useState('All')

  // Load custom project profile overrides from localStorage
  const profileOverrides = useMemo(() => {
    if (!project) return {}
    try {
      const raw = localStorage.getItem('meil_custom_project_profiles')
      if (raw) {
        const parsed = JSON.parse(raw)
        return parsed[project.id] || parsed[project.projectCode] || {}
      }
    } catch {}
    return {}
  }, [project?.id, project?.projectCode, profileOverrideVersion])

  const baseProfile = useMemo(() => getProjectProfile(project), [project])
  const profile = useMemo(() => ({
    ...baseProfile,
    ...profileOverrides,
  }), [baseProfile, profileOverrides])

  // Sync edit fields when the underlying project/profile data changes —
  // render-time adjustment (the sanctioned alternative to setState-in-effect)
  const editSyncKey = [
    project?.id, project?.projectName, project?.projectCode, project?.buName,
    project?.location, project?.status, profile.capacity, profile.cod,
    profile.projectHead, profile.leadContact, profile.client, profile.landArea,
    profile.ecNumber, profile.ctoNumber, profile.ctoExpiry, profile.overviewText,
  ].join('|')
  const [lastEditSyncKey, setLastEditSyncKey] = useState(editSyncKey)
  if (lastEditSyncKey !== editSyncKey) {
    setLastEditSyncKey(editSyncKey)
    if (project) {
      setEditName(project.projectName)
      setEditCode(project.projectCode)
      setEditBu(project.buName)
      setEditLocation(project.location || '')
      setEditStatus(project.status)
      setEditCapacity(profile.capacity || '')
      setEditCod(profile.cod || '')
      setEditProjectHead(profile.projectHead || '')
      setEditLeadContact(profile.leadContact || '')
      setEditClient(profile.client || '')
      setEditLandArea(profile.landArea || '')
      setEditEcNumber(profile.ecNumber || '')
      setEditCtoNumber(profile.ctoNumber || '')
      setEditCtoExpiry(profile.ctoExpiry || '')
      setEditOverviewText(profile.overviewText || '')
    }
  }

  const handleSaveEdit = useCallback(() => {
    if (project) {
      const updatedProject: FlattenedProject = {
        ...project,
        projectName: editName.trim() || project.projectName,
        projectCode: editCode.trim() || project.projectCode,
        buName: editBu.trim() || project.buName,
        location: editLocation.trim() || project.location,
        status: editStatus || project.status,
      }

      const updatedProfileOverrides: Partial<ProjectProfileDetails> = {
        capacity: editCapacity.trim() || profile.capacity,
        cod: editCod.trim() || profile.cod,
        projectHead: editProjectHead.trim() || profile.projectHead,
        leadContact: editLeadContact.trim() || profile.leadContact,
        client: editClient.trim() || profile.client,
        landArea: editLandArea.trim() || profile.landArea,
        ecNumber: editEcNumber.trim() || profile.ecNumber,
        ctoNumber: editCtoNumber.trim() || profile.ctoNumber,
        ctoExpiry: editCtoExpiry.trim() || profile.ctoExpiry,
        overviewText: editOverviewText.trim() || profile.overviewText,
      }

      try {
        const raw = localStorage.getItem('meil_custom_project_profiles')
        const allProfiles = raw ? JSON.parse(raw) : {}
        allProfiles[project.id] = { ...(allProfiles[project.id] || {}), ...updatedProfileOverrides }
        allProfiles[project.projectCode] = { ...(allProfiles[project.projectCode] || {}), ...updatedProfileOverrides }
        allProfiles[updatedProject.projectCode] = { ...(allProfiles[project.id] || {}), ...updatedProfileOverrides }
        localStorage.setItem('meil_custom_project_profiles', JSON.stringify(allProfiles))
      } catch {}

      setProfileOverrideVersion(v => v + 1)
      onUpdateProject?.(updatedProject)
      toast.success(`Project "${updatedProject.projectName}" details updated successfully`)
    }
    setShowEditModal(false)
  }, [
    project, profile, editName, editCode, editBu, editLocation, editStatus,
    editCapacity, editCod, editProjectHead, editLeadContact, editClient,
    editLandArea, editEcNumber, editCtoNumber, editCtoExpiry, editOverviewText,
    onUpdateProject
  ])

  // Hooks must run unconditionally — compute before early return below.
  const filteredImages = useMemo(() => {
    if (!project) return []
    if (imageCategoryFilter === 'All') return profile.images
    return profile.images.filter(img => img.category === imageCategoryFilter)
  }, [project, profile.images, imageCategoryFilter])

  if (!project) {
    return (
      <div className="glass-ios-liquid rounded-[26px] p-10 flex flex-col items-center justify-center text-center min-h-[500px]">
        <Building2 className="h-12 w-12 text-sky-400 mb-4" />
        <p className="text-[16px] font-bold text-slate-900 mb-1">No project selected</p>
        <p className="text-[12px] text-slate-600 font-medium">Click a project row in the registry to inspect ESG details.</p>
      </div>
    )
  }

  const modules = moduleCompletion(subs, kpis)

  return (
    <div className="glass-ios-liquid glass-shimmer rounded-[26px] overflow-hidden flex flex-col h-full relative border border-white/90 shadow-[0_20px_50px_-10px_rgba(2,132,199,0.16)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-slate-200/80 bg-white/40">
        <h2 className="text-[17px] font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
          <FileText className="h-5 w-5 text-sky-600" />
          Project Details &amp; Profile
        </h2>
        <div className="flex items-center gap-2">
          {onOpenPreview && (
            <button
              onClick={onOpenPreview}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black text-white bg-sky-600 hover:bg-sky-700 transition shadow-xs"
              title="Open full interactive preview dossier"
            >
              <Eye className="h-3.5 w-3.5" /> Preview Dossier
            </button>
          )}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-sky-50 hover:text-sky-800 transition-all shadow-2xs"
              title={isExpanded ? 'Collapse to side panel' : 'Expand to wide view'}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-sky-600" /> Collapse
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-sky-600" /> Expand
                </>
              )}
            </button>
          )}
          <button
            onClick={() => project && setShowEditModal(true)}
            disabled={!project}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11.5px] font-black text-sky-900 bg-sky-100/90 border border-sky-300 hover:bg-sky-200 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pencil className="h-3.5 w-3.5 text-sky-700" /> Edit Project Details
          </button>
        </div>
      </header>

      {/* Upgraded 15-Field Edit Project Modal */}
      <AnimatePresence>
        {showEditModal && project && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white/95 backdrop-blur-2xl rounded-[28px] shadow-2xl w-full max-w-2xl p-6 md:p-7 border border-white/90 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-5">
                <div>
                  <h3 className="text-[19px] font-black text-slate-950 flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-sky-600" />
                    Edit Project Specifications
                  </h3>
                  <p className="text-[12px] text-slate-600 font-medium mt-0.5">
                    Update identification, statutory clearances, site capacity, and ESG scope
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto pr-1 scroll-elegant flex-1">
                {/* 1. Identity & Division */}
                <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200/80 space-y-3.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Project Identity &amp; Division
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Project Name</label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Project Code</label>
                      <input
                        value={editCode}
                        onChange={e => setEditCode(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Business Unit (Division)</label>
                      <input
                        value={editBu}
                        onChange={e => setEditBu(e.target.value)}
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Operational Status</label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      >
                        {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Geographic Location / Site Address</label>
                    <input
                      value={editLocation}
                      onChange={e => setEditLocation(e.target.value)}
                      placeholder="e.g. Gajwel, Siddipet District, Telangana, India"
                      className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* 2. Engineering & Operational Parameters */}
                <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200/80 space-y-3.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Engineering Scale &amp; Facility Timeline
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Capacity / Grid Scale</label>
                      <input
                        value={editCapacity}
                        onChange={e => setEditCapacity(e.target.value)}
                        placeholder="e.g. 250 MWp DC / 200 MW AC"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">COD Date (Commissioning)</label>
                      <input
                        value={editCod}
                        onChange={e => setEditCod(e.target.value)}
                        placeholder="e.g. 18 Dec 2023"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Land Area / Footprint</label>
                      <input
                        value={editLandArea}
                        onChange={e => setEditLandArea(e.target.value)}
                        placeholder="e.g. 1,120 Acres"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Leadership & Statutory Clearances */}
                <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200/80 space-y-3.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Leadership, Client &amp; Statutory Permits
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Project Director / Head</label>
                      <input
                        value={editProjectHead}
                        onChange={e => setEditProjectHead(e.target.value)}
                        placeholder="e.g. Er. K. Venkataramana"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Lead Contact Email</label>
                      <input
                        value={editLeadContact}
                        onChange={e => setEditLeadContact(e.target.value)}
                        placeholder="e.g. project.head@meilgroup.com"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Client / Offtaker</label>
                      <input
                        value={editClient}
                        onChange={e => setEditClient(e.target.value)}
                        placeholder="e.g. NTPC Limited & TSREDCO"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Consent to Operate (CTO No.)</label>
                      <input
                        value={editCtoNumber}
                        onChange={e => setEditCtoNumber(e.target.value)}
                        placeholder="e.g. TSPCB/NZB/CTO/2026-9042"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">CTO Expiry Date</label>
                      <input
                        value={editCtoExpiry}
                        onChange={e => setEditCtoExpiry(e.target.value)}
                        placeholder="e.g. 31 Dec 2028"
                        className="ios-field !text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 mb-1 block">Environmental Clearance (EC No.)</label>
                      <input
                        value={editEcNumber}
                        onChange={e => setEditEcNumber(e.target.value)}
                        placeholder="e.g. SEIAA/TS/EC/SOL/2021/892"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Scope & ESG Alignment */}
                <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Project Scope &amp; Environmental Description</span>
                    <span className="text-sky-700 font-extrabold text-[10.5px]">SEBI BRSR Core Principal 6</span>
                  </div>
                  <textarea
                    value={editOverviewText}
                    onChange={e => setEditOverviewText(e.target.value)}
                    rows={4}
                    placeholder="Provide operational details, environmental management plans, and BRSR alignment..."
                    className="ios-field !text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-200/80">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-xl px-5 py-2.5 text-[12.5px] font-black text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 transition-all inline-flex items-center gap-2 shadow-md shadow-sky-600/20 active:scale-98"
                >
                  <Save className="h-4 w-4" /> Save All Project Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setLightboxImg(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
              <button
                onClick={() => setLightboxImg(null)}
                className="absolute -top-12 right-0 text-white/80 hover:text-white p-2 rounded-full bg-white/10"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={lightboxImg.url}
                alt={lightboxImg.title}
                className="max-h-[75vh] w-auto rounded-2xl shadow-2xl object-contain border border-white/20"
              />
              <div className="mt-3 text-center text-white">
                <div className="text-[16px] font-bold">{lightboxImg.title}</div>
                <div className="text-[12px] text-white/75 mt-0.5">{lightboxImg.caption}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-y-auto scroll-elegant flex-1">
        {/* HERO IMAGE BANNER */}
        <div className="px-5 pt-4">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-sm group cursor-pointer"
            style={{ aspectRatio: '16/7.2' }}
            onClick={() => profile.images[0] && setLightboxImg(profile.images[0])}
          >
            <SafeImage
              src={profile.images[0]?.url || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80'}
              alt={project.projectName}
              aspectRatio="16/7.2"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold">
                <ZoomIn className="h-3 w-3" /> View Photo
              </span>
            </div>

            <div className="absolute bottom-3.5 left-4 right-4">
              <div className="text-[10px] uppercase tracking-widest text-sky-300 font-extrabold mb-0.5">
                {project.buName}
              </div>
              <div className="text-[19px] font-black text-white leading-tight drop-shadow-md truncate">
                {project.projectName}
              </div>
              <div className="text-[11px] text-white/85 font-medium mt-0.5 truncate">
                {profile.capacity} · {project.location || 'Site Location'}
              </div>
            </div>
          </div>
        </div>

        {/* TITLE & META BAR */}
        <div className="px-5 pt-3.5 pb-2">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-[18px] font-extrabold text-slate-900 leading-tight flex-1 min-w-0 tracking-tight">
              {project.projectName}
            </h3>
            <span className={`status-pill text-[10.5px] font-bold flex-shrink-0 ${statusClass(project.status)}`}>
              {project.status.replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600 font-medium">
            <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/80">
              {project.projectCode}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700 font-semibold">{project.buName}</span>
            <span className="text-slate-300">·</span>
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-sky-600" />
            <span className="truncate">{project.location || 'Location not specified'}</span>
          </div>
        </div>

        {/* TABS */}
        <div className="px-5 pt-2">
          <div className="flex items-center gap-1 border-b border-slate-200/70 overflow-x-auto scroll-elegant -mx-1 px-1">
            {([
              { k: 'overview' as const, label: 'Overview' },
              { k: 'images' as const, label: `Site Photos (${profile.images.length})` },
              { k: 'telemetry' as const, label: 'Meters & Telemetry' },
              { k: 'progress' as const, label: 'ESG Progress' },
              { k: 'activity' as const, label: 'Activity' },
              { k: 'team' as const, label: 'Team' },
              { k: 'documents' as const, label: 'Documents' },
            ]).map(t => {
              const active = tab === t.k
              return (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`relative flex-shrink-0 px-3.5 py-2.5 text-[12px] font-bold whitespace-nowrap transition-colors ${
                    active ? 'text-sky-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {active && <motion.div layoutId="project-details-tab" className="absolute left-2 right-2 bottom-0 h-[2.5px] bg-sky-600 rounded-full" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* TAB BODY */}
        <div className="px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {tab === 'overview' && (
                <div className="space-y-4">
                  {/* METADATA GRID HEADER */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-sky-100 border border-sky-300 text-sky-700 flex items-center justify-center font-bold">
                        <Gauge className="h-3.5 w-3.5" />
                      </span>
                      <h4 className="text-[13.5px] font-black text-slate-950 tracking-tight">
                        Core Facility Specifications &amp; Clearances
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black text-sky-800 bg-sky-100/90 border border-sky-300 hover:bg-sky-200 transition-all shadow-2xs"
                    >
                      <Pencil className="h-3 w-3 text-sky-700" /> Update Details
                    </button>
                  </div>

                  {/* METADATA GRID */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <DetailRow
                      icon={Hash}
                      label="Project Code"
                      value={<span className="font-mono text-sky-950 font-black">{project.projectCode}</span>}
                    />
                    <DetailRow
                      icon={Building2}
                      label="Business Unit"
                      value={project.buName}
                    />
                    <DetailRow
                      icon={Sparkles}
                      label="Capacity / Scale"
                      value={profile.capacity}
                    />
                    <DetailRow
                      icon={CalendarClock}
                      label="Reporting Period"
                      value={currentPeriodLabel}
                    />
                    <DetailRow
                      icon={Calendar}
                      label="COD Date"
                      value={profile.cod}
                    />
                    <DetailRow
                      icon={UserCheck}
                      label="Project Director"
                      value={profile.projectHead.split(',')[0]}
                    />
                    <DetailRow
                      icon={Briefcase}
                      label="Client / Offtaker"
                      value={profile.client.split('&')[0]}
                    />
                    <DetailRow
                      icon={Shield}
                      label="CTO Permit Ref"
                      value={<span className="font-mono text-[11px] text-emerald-900 font-black">{profile.ctoNumber}</span>}
                    />
                    {profile.ecNumber && (
                      <DetailRow
                        icon={FileCheck2}
                        label="EC Clearance Ref"
                        value={<span className="font-mono text-[11px] text-sky-900 font-black">{profile.ecNumber}</span>}
                      />
                    )}
                    {profile.landArea && (
                      <DetailRow
                        icon={MapPin}
                        label="Land Footprint"
                        value={profile.landArea}
                      />
                    )}
                  </div>

                  {/* SCOPE DESCRIPTION */}
                  <div className="rounded-2xl bg-white/90 p-4 border border-slate-200/90 shadow-2xs backdrop-blur-md">
                    <div className="text-[11px] uppercase tracking-wider text-slate-700 font-black mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-900">
                        <FileText className="h-3.5 w-3.5 text-sky-600" /> Project Scope &amp; ESG Alignment
                      </span>
                      <span className="text-sky-800 font-extrabold text-[10.5px] bg-sky-100/90 px-2 py-0.5 rounded-full border border-sky-300">
                        SEBI BRSR Core Principal 6
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-800 leading-relaxed font-semibold">
                      {profile.overviewText}
                    </p>
                  </div>

                  {/* SITE PHOTOS PREVIEW STRIP */}
                  <div className="rounded-2xl bg-white/80 p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
                        <ImageIcon className="h-4 w-4 text-sky-600" />
                        Site Photo Gallery ({profile.images.length})
                      </div>
                      <button
                        onClick={() => setTab('images')}
                        className="text-[11px] font-bold text-sky-700 hover:text-sky-800 transition"
                      >
                        View Full Gallery →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {profile.images.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setLightboxImg(img)}
                          className="relative rounded-xl overflow-hidden cursor-pointer group shadow-2xs"
                          style={{ aspectRatio: '16/11' }}
                        >
                          <SafeImage src={img.url} alt={img.title} aspectRatio="16/11" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="h-4 w-4" />
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-white">
                            <div className="text-[9.5px] font-bold truncate leading-tight">{img.title}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CONNECTED METERS TABLE (PDF DATA) */}
                  <div className="rounded-2xl bg-white/85 p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
                        <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                        Connected Telemetric Meters (PDF Disclosures)
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Live SCADA Feed
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {profile.meters.slice(0, 3).map(m => (
                        <div key={m.meterId} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11.5px]">
                          <div>
                            <div className="font-mono font-bold text-sky-800">{m.meterId}</div>
                            <div className="text-slate-500 text-[10px]">{m.parameter}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 tabular-nums">
                              {m.latestReading} <span className="text-[9.5px] text-slate-500">{m.unit}</span>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-700">✓ {m.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LOCATION & GEOGRAPHIC FOOTPRINT */}
                  <div className="rounded-2xl bg-gradient-to-r from-sky-50/85 via-blue-50/60 to-white/90 p-4 border border-sky-100/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0 ring-2 ring-white">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold text-slate-900 truncate">
                          {project.location || 'Site Location'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {project.subsidiaryName} · GPS Verified Telemetry Coordinates
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 border border-emerald-300 text-emerald-800 text-[10px] font-bold shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Active Telemetry
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'images' && (
                <div className="space-y-4">
                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['All', 'Site Overview', 'Infrastructure', 'Control Room', 'EHS & Environment'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setImageCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                          imageCategoryFilter === cat
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-white/80 text-slate-600 hover:bg-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {filteredImages.map(img => (
                      <div
                        key={img.id}
                        onClick={() => setLightboxImg(img)}
                        className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition cursor-pointer group"
                      >
                        <div className="relative" style={{ aspectRatio: '16/10' }}>
                          <SafeImage src={img.url} alt={img.title} aspectRatio="16/10" />
                          <div className="absolute top-2.5 left-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9.5px] font-bold">
                              {img.category}
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="h-6 w-6" />
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-[13px] font-bold text-slate-900 truncate">{img.title}</h4>
                            <span className="text-[10px] text-slate-400">{img.date}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{img.caption}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {img.tags.map(t => (
                              <span key={t} className="text-[9.5px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'telemetry' && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white/80 p-4 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-[13.5px] font-extrabold text-slate-900">Perimeter Smart Meter Inventory</h4>
                        <p className="text-[11px] text-slate-500">Live telemetric instruments connected to central ESG datalogger</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {profile.meters.length} Instruments Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {profile.meters.map(m => (
                        <div key={m.meterId} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-sky-50/40 transition">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[12px] text-sky-800">{m.meterId}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                {m.status}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-slate-500">{m.lastSync}</span>
                          </div>
                          <div className="text-[12px] text-slate-700 font-semibold mb-1">{m.parameter}</div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Latest Datalog Value:</span>
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              {m.latestReading} {m.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'progress' && (
                <div className="space-y-3.5">
                  {modules.slice(0, 4).map((m, i) => (
                    <div key={m.label} className="flex items-center gap-3.5 p-2.5 rounded-xl bg-white/50">
                      <CircularRing pct={m.pct} size={56} stroke={4.5} labelSize={11} color={
                        m.tone.includes('blue') ? '#3B82F6' :
                        m.tone.includes('cyan') ? '#06B6D4' :
                        m.tone.includes('emerald') ? '#10B981' :
                        m.tone.includes('amber') ? '#F59E0B' : '#8B5CF6'
                      } />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12.5px] font-semibold text-slate-900">{m.label}</span>
                          <span className={`status-pill text-[9px] ${m.pct >= 75 ? 'status-approved' : m.pct >= 50 ? 'status-review' : 'status-draft'}`}>
                            {m.pct >= 75 ? 'On Track' : m.pct >= 50 ? 'In Progress' : 'Needs Attention'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className={`h-full ${m.tone} rounded-full`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'activity' && (
                <div className="max-h-[320px] overflow-y-auto scroll-elegant pr-1">
                  {activities.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-slate-500">No recent activity for this project</div>
                  ) : (
                    <ol className="space-y-2.5">
                      {activities.map((a, i) => (
                        <motion.li
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.03 * i }}
                          className="flex gap-2.5 rounded-xl bg-white/50 px-2.5 py-2.5 hover:bg-white/70 transition-colors"
                        >
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white shadow-sm">
                            {initials(a.actorName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                              {a.status && (
                                <span className={`status-pill text-[8.5px] ${statusClass(a.status)}`}>
                                  {a.status.replace(/_/g, ' ').toLowerCase()}
                                </span>
                              )}
                            </div>
                            {a.description && <p className="text-[10.5px] text-slate-600 mt-0.5 line-clamp-2">{a.description}</p>}
                            <div className="text-[10px] text-slate-500 mt-0.5">{a.actorName} · {timeAgo(a.createdAt)}</div>
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {tab === 'team' && (
                <div className="space-y-2">
                  {SEEDED_TEAM.slice(0, 7).map((m, i) => (
                    <motion.div
                      key={m.name}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex items-center gap-3 rounded-xl bg-white/55 px-2.5 py-2.5 hover:bg-white/75 transition-colors"
                    >
                      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white shadow-sm`}>
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-slate-900">{m.name}</div>
                        <div className="text-[10.5px] text-slate-500">{m.role}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${m.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className={`status-pill text-[8.5px] ${m.active ? 'status-approved' : 'status-draft'}`}>
                          {m.active ? 'Active' : 'Away'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {tab === 'documents' && (
                <div className="max-h-[320px] overflow-y-auto scroll-elegant pr-1">
                  {evidence.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-slate-500">No documents uploaded for this project</div>
                  ) : (
                    <div className="space-y-2">
                      {evidence.map((e, i) => (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.03 * i }}
                          className="flex items-center gap-2.5 rounded-xl bg-white/55 px-2.5 py-2.5 hover:bg-white/75 transition-colors"
                        >
                          <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-slate-900">{e.fileName}</div>
                            <div className="text-[10.5px] text-slate-500">
                              {e.documentType} · {e.uploader?.name ?? 'System'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`status-pill text-[8.5px] ${statusClass(e.status)}`}>
                              {e.status.replace(/_/g, ' ').toLowerCase()}
                            </span>
                            <button className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-700 transition-colors" aria-label="View document">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/90 p-3.5 border border-slate-200/90 shadow-2xs hover:bg-white hover:border-sky-300 hover:shadow-xs transition-all backdrop-blur-md">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-sky-600 shrink-0" />}
        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-extrabold truncate">{label}</span>
      </div>
      <div className="text-[13.5px] font-black text-slate-950 truncate leading-snug">{value}</div>
    </div>
  )
}

/* ============================================================
 * ROW 3 LEFT — Project ESG Progress (rings)
 * ============================================================ */
function ProjectEsgProgressCard({ project, subs, kpis, delay = 0.2, dragHandle }: {
  project: FlattenedProject | null
  subs: SubmissionItem[]
  kpis?: Kpis
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const modules = moduleCompletion(subs, kpis).slice(0, 4)
  const ringColor = (tone: string) =>
    tone.includes('blue') ? '#3B82F6' :
    tone.includes('cyan') ? '#06B6D4' :
    tone.includes('emerald') ? '#10B981' :
    tone.includes('amber') ? '#F59E0B' : '#8B5CF6'

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-sky-500" />
            Project ESG Progress
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {project ? project.projectName : 'Select a project'} · per-module completion
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {dragHandle}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3.5 flex-1 content-center">
        {modules.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/50 border border-white/80 shadow-2xs">
            <CircularRing pct={m.pct} size={58} stroke={4.5} labelSize={12} color={ringColor(m.tone)} />
            <div className="text-center">
              <div className="text-[11.5px] font-semibold text-slate-900 leading-tight">{m.label}</div>
              <div className={`mt-0.5 text-[9px] font-medium ${m.pct >= 75 ? 'text-emerald-700' : m.pct >= 50 ? 'text-amber-700' : 'text-sky-700'}`}>
                {m.pct >= 75 ? '✓ On Track' : m.pct >= 50 ? '⏵ In Progress' : '⚠ Needs Work'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * ROW 3 CENTER — Submission Status
 * ============================================================ */
function SubmissionStatusCard({ project, allSubs, delay = 0.25, dragHandle }: {
  project: FlattenedProject | null
  allSubs: SubmissionItem[]
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const modules = ['Energy', 'Water', 'Waste', 'Safety', 'Workforce']
  const rows = modules.map(mod => {
    const lower = mod.toLowerCase()
    const projectSubs = project
      ? allSubs.filter(s => s.projectId === project.id && (s.module || '').toLowerCase() === lower)
      : allSubs.filter(s => (s.module || '').toLowerCase() === lower)
    return {
      module: mod,
      total: projectSubs.length,
      submitted: projectSubs.filter(s => s.status === 'SUBMITTED' || s.status === 'RESUBMITTED').length,
      review: projectSubs.filter(s => s.status === 'UNDER_REVIEW' || s.status === 'REVIEW').length,
      approved: projectSubs.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length,
      pending: Math.max(0, projectSubs.length - projectSubs.filter(s => s.status !== 'DRAFT').length),
    }
  })

  const Chip = ({ n, tone }: { n: number; tone: string }) => (
    <span className={`inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums ${tone}`}>
      {n}
    </span>
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-sky-500" />
            Submission Status
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {project ? project.projectCode : 'All projects'} · module breakdown
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {dragHandle}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto -mx-1 px-1 scroll-elegant">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/60">
              <th className="py-2 px-1 font-medium">Module</th>
              <th className="py-2 px-1 font-medium text-center">Total</th>
              <th className="py-2 px-1 font-medium text-center">Sub.</th>
              <th className="py-2 px-1 font-medium text-center">Rev.</th>
              <th className="py-2 px-1 font-medium text-center">App.</th>
              <th className="py-2 px-1 font-medium text-center">Pen.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {rows.map(r => (
              <tr key={r.module} className="hover:bg-white/40 transition-colors">
                <td className="py-2 px-1 text-[11px] font-semibold text-slate-800">{r.module}</td>
                <td className="py-2 px-1 text-center"><Chip n={r.total} tone="bg-slate-100 text-slate-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.submitted} tone="bg-sky-100 text-sky-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.review} tone="bg-amber-100 text-amber-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.approved} tone="bg-emerald-100 text-emerald-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.pending} tone="bg-rose-100 text-rose-700" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Upcoming Deadlines
 * ============================================================ */
function UpcomingDeadlinesCard({ project, periods, allSubs, delay = 0.3, dragHandle }: {
  project: FlattenedProject | null
  periods: OverviewData['periods']
  allSubs: SubmissionItem[]
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const deadlineRows = useMemo(() => {
    const rows: { task: string; project: string; due: string; dueTs: number; status: string }[] = []
    for (const p of periods) {
      const baseYear = p.year
      const baseMonth = p.month ?? 3

      const addRow = (task: string, offsetDays: number, statusBase: string) => {
        const date = new Date(baseYear, baseMonth - 1, 15)
        date.setDate(date.getDate() + offsetDays)
        const dueTs = date.getTime()
        const now = Date.now()
        let status = statusBase
        if (dueTs < now) status = 'Overdue'
        else if (dueTs - now < 7 * 24 * 3600 * 1000 && statusBase !== 'Completed') status = 'At Risk'
        rows.push({
          task,
          project: project ? project.projectCode : p.label,
          due: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          dueTs,
          status,
        })
      }

      const projectFilter = project ? allSubs.filter(s => s.projectId === project.id) : allSubs
      const subForPeriod = projectFilter.find(s => s.reportingPeriod?.id === p.id)
      const isDone = subForPeriod?.status === 'APPROVED' || subForPeriod?.status === 'LOCKED'
      const inProgress = subForPeriod?.status === 'SUBMITTED' || subForPeriod?.status === 'UNDER_REVIEW'

      addRow(`Data Submission - ${p.label}`, 0, isDone ? 'Completed' : inProgress ? 'In Progress' : 'Pending')
      addRow(`Review Cycle - ${p.label}`, 14, isDone ? 'Completed' : 'Pending')
      addRow(`Approval Sign-off - ${p.label}`, 28, isDone ? 'Completed' : 'Pending')
    }

    return rows.sort((a, b) => a.dueTs - b.dueTs).slice(0, 5)
  }, [periods, allSubs, project])

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full overflow-hidden"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-sky-500" />
            Upcoming Deadlines
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {project ? project.projectCode : 'All projects'} · statutory reporting
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {dragHandle}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scroll-elegant">
        {deadlineRows.map((d, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/40 hover:bg-white/60 transition text-[11.5px]">
            <div className="min-w-0 flex-1 pr-2">
              <div className="font-semibold text-slate-900 truncate">{d.task}</div>
              <div className="text-[10px] text-slate-500">Due: {d.due}</div>
            </div>
            <span className={`status-pill text-[9px] ${
              d.status === 'Completed' ? 'status-approved' :
              d.status === 'In Progress' ? 'status-review' :
              d.status === 'At Risk' ? 'status-warning' :
              d.status === 'Overdue' ? 'status-error' : 'status-draft'
            }`}>
              {d.status}
            </span>
          </div>
        ))}
        {deadlineRows.length === 0 && (
          <div className="py-8 text-center text-[11px] text-slate-500">
            No upcoming deadlines
          </div>
        )}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Skeletons + Error + Empty states
 * ============================================================ */
function MyProjectSkeleton() {
  return (
    <div className="glass rounded-[26px] p-6">
      <MeilBoxLoader boxHeight="min-h-[420px]" label="Loading your project…" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <AlertOctagon className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load dashboard</p>
      <p className="text-[12px] text-slate-700 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <Building2 className="h-10 w-10 text-sky-300 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Nothing to display</p>
      <p className="text-[12px] text-slate-700 mb-4">{message}</p>
    </div>
  )
}

/* ============================================================
 * Main component — 3 hard-locked rows with BU Choice & Preview
 * ============================================================ */
export function MyProjectModule() {
  const { setActiveModule, selectedProjectId: appProjectId, setSelectedProjectId: setAppProjectId } = useApp()

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [globalActivity, setGlobalActivity] = useState<ActivityItem[]>([])
  const [allSubs, setAllSubs] = useState<SubmissionItem[]>([])

  const [projectActivity, setProjectActivity] = useState<ActivityItem[]>([])
  const [projectSubs, setProjectSubs] = useState<SubmissionItem[]>([])
  const [projectEvidence, setProjectEvidence] = useState<EvidenceItem[]>([])

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [buFilter, setBuFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Drag-and-drop card order for Row 3
  const [row3Order, setRow3Order] = useState<('esg' | 'submissions' | 'deadlines')[]>(['esg', 'submissions', 'deadlines'])
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({ esg: 340, submissions: 340, deadlines: 340 })

  // Real-time project edits
  const [editedProjects, setEditedProjects] = useState<Record<string, FlattenedProject>>({})
  const handleUpdateProject = useCallback((updated: FlattenedProject) => {
    setEditedProjects(prev => ({
      ...prev,
      [updated.id]: updated,
    }))
  }, [])

  const mountedRef = useRef(true)

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    Promise.all([
      fetch('/api/pu/overview', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      fetch('/api/pu/organization/tree', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      fetch('/api/pu/activity?take=5', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as ActivityItem[] }))
        .catch(() => ({ items: [] as ActivityItem[] })),
      fetch('/api/pu/submissions?take=200', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as SubmissionItem[] }))
        .catch(() => ({ items: [] as SubmissionItem[] })),
    ])
      .then(([ov, tr, act, subs]: [OverviewData, OrgTree, ActivityResponse, SubmissionResponse]) => {
        if (!mountedRef.current) return
        setOverview(ov)
        setTree(tr)
        setGlobalActivity(act.items ?? [])
        setAllSubs(subs.items ?? [])
        const projects = flattenProjects(tr)
        if (projects.length > 0) {
          const matched = appProjectId ? projects.find(p => p.id === appProjectId || p.projectCode === appProjectId) : null
          setSelectedProjectId(matched ? matched.id : projects[0].id)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!mountedRef.current) return
        setError(e instanceof Error ? e.message : 'Failed to load data')
        setLoading(false)
      })
    return () => { mountedRef.current = false }
  }, [appProjectId])

  /* ---- derived (see selection sync below) ---- */
  const allProjects = useMemo(() => {
    const base = flattenProjects(tree)
    return base.map(p => editedProjects[p.id] ? { ...p, ...editedProjects[p.id] } : p)
  }, [tree, editedProjects])

  const uniqueBUs = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) set.add(p.buName)
    return Array.from(set).sort()
  }, [allProjects])

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) set.add(p.buName.split(' ')[0] || 'Project')
    return Array.from(set).sort()
  }, [allProjects])

  const filteredProjects = useMemo(() => {
    let list = allProjects
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      const s = statusFilter.toUpperCase()
      list = list.filter(p => p.status.toUpperCase() === s)
    }
    if (buFilter !== 'all') {
      list = list.filter(p => p.buName === buFilter)
    }
    if (typeFilter !== 'all') {
      list = list.filter(p => (p.buName.split(' ')[0] || 'Project') === typeFilter)
    }
    return list
  }, [allProjects, search, statusFilter, buFilter, typeFilter])

  /* ---- selection sync: the visible selection auto-falls-back to the first
     filtered project when the current selection leaves the filter result —
     derived during render (the sanctioned alternative to setState-in-effect) ---- */
  const effectiveSelectedId = useMemo(() => {
    if (filteredProjects.length === 0) return null
    return filteredProjects.some(p => p.id === selectedProjectId) ? selectedProjectId : filteredProjects[0].id
  }, [filteredProjects, selectedProjectId])

  /* ---- project-scoped fetch (follows the effective selection) ---- */
  useEffect(() => {
    if (!effectiveSelectedId) return
    let cancelled = false
    Promise.all([
      fetch(`/api/pu/activity?projectId=${encodeURIComponent(effectiveSelectedId)}&take=5`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as ActivityItem[] }))
        .catch(() => ({ items: [] as ActivityItem[] })),
      fetch(`/api/pu/submissions?projectId=${encodeURIComponent(effectiveSelectedId)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as SubmissionItem[] }))
        .catch(() => ({ items: [] as SubmissionItem[] })),
      fetch(`/api/pu/evidence?projectId=${encodeURIComponent(effectiveSelectedId)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as EvidenceItem[] }))
        .catch(() => ({ items: [] as EvidenceItem[] })),
    ])
      .then(([a, s, e]: [ActivityResponse, SubmissionResponse, EvidenceResponse]) => {
        if (cancelled) return
        setProjectActivity(a.items ?? [])
        setProjectSubs(s.items ?? [])
        setProjectEvidence(e.items ?? [])
      })
    return () => { cancelled = true }
  }, [effectiveSelectedId])

  const selectedProject = useMemo(
    () => allProjects.find(p => p.id === effectiveSelectedId) ?? null,
    [allProjects, effectiveSelectedId],
  )

  const previewProject = useMemo(
    () => allProjects.find(p => p.id === previewProjectId) ?? selectedProject,
    [allProjects, previewProjectId, selectedProject],
  )

  const handleSelectBusinessUnit = (bu: string) => {
    setBuFilter(bu)
    const matching = bu === 'all' ? allProjects : allProjects.filter(p => p.buName === bu)
    if (matching.length > 0) {
      setSelectedProjectId(matching[0].id)
    }
  }

  /* ---- guards ---- */
  if (loading) return <MyProjectSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!overview || !tree) return <EmptyState message="No projects or reporting periods found." />

  const k = overview.kpis
  const currentPeriod = overview.periods[0]
  const currentPeriodLabel = currentPeriod?.label ?? '—'
  const totalSubs = k.totalSubs ?? 0
  const approvedSubs = k.approvedSubs ?? 0
  const draftSubs = k.draftSubs ?? 0
  const uniqueBUCount = uniqueBUs.length
  const pendingSubs = Math.max(0, totalSubs - approvedSubs - draftSubs)
  const trendTone = (approvedSubs / Math.max(1, totalSubs)) >= 0.5 ? 'status-approved' : 'status-missing'

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="kpi-tile bg-sky-50 text-sky-600"><Building2 className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Project</h1>
            <span className="status-pill status-approved">
              <CheckCircle2 className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Project-scoped ESG dashboard · {allProjects.length} project(s) visible
            {currentPeriod && <> · FY {currentPeriod.year}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact project switcher (replaces the removed BU / registry cards) */}
          <div className="glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <select
              value={effectiveSelectedId ?? ''}
              onChange={(e) => {
                setSelectedProjectId(e.target.value)
                try { setAppProjectId(e.target.value) } catch {}
              }}
              className="max-w-[260px] cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 outline-none"
              aria-label="Select project"
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.projectName}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
          {selectedProject && (
            <button
              onClick={() => setPreviewProjectId(selectedProject.id)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition shadow-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Preview Dossier
            </button>
          )}
        </div>
      </motion.div>

      {/* ====================================================== */}
      {/* PROJECT DETAILS — full-width, fills the window.         */}
      {/* (BU chooser + Project Registry removed by request;      */}
      {/*  project switching lives in the compact header picker.) */}
      {/* ====================================================== */}
      <ProjectDetailsPanel
        key={selectedProject?.id ?? 'none'}
        project={selectedProject}
        onUpdateProject={handleUpdateProject}
        onOpenPreview={() => selectedProject && setPreviewProjectId(selectedProject.id)}
        kpis={k}
        subs={projectSubs}
        activities={projectActivity.length > 0 ? projectActivity : globalActivity.filter(a => a.projectId === selectedProject?.id)}
        evidence={projectEvidence}
        periods={overview.periods}
        currentPeriodLabel={currentPeriodLabel}
        isExpanded
      />

      {/* ====================================================== */}
      {/* PROJECT PREVIEW MODAL                                   */}
      {/* ====================================================== */}
      <AnimatePresence>
        {previewProjectId && previewProject && (
          <ProjectPreviewModal
            project={previewProject}
            profile={getProjectProfile(previewProject)}
            onClose={() => setPreviewProjectId(null)}
          />
        )}
      </AnimatePresence>

      {/* ====================================================== */}
      {/* ROW 3: Drag-and-Drop + Resizable Cards                  */}
      {/* ====================================================== */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <GripVertical className="h-3.5 w-3.5 text-sky-500" />
          <span>Drag card headers to reorder · Drag bottom edge to adjust card height</span>
        </div>
        <Reorder.Group
          axis="x"
          values={row3Order}
          onReorder={setRow3Order}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          layoutScroll
        >
          {row3Order.map(cardId => {
            const h = cardHeights[cardId] ?? 340
            const setH = (newH: number) => setCardHeights(prev => ({ ...prev, [cardId]: newH }))
            const cardDragHandle = (
              <div
                className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                title="Drag card to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )

            return (
              <Reorder.Item
                key={cardId}
                value={cardId}
                className="relative"
                whileDrag={{ scale: 1.02, zIndex: 50, boxShadow: '0 20px 48px -8px rgba(2,132,199,0.25)' }}
              >
                <div className="relative" style={{ height: h }}>
                  <div className="h-full overflow-hidden">
                    {cardId === 'esg' && (
                      <ProjectEsgProgressCard
                        project={selectedProject}
                        subs={selectedProject ? projectSubs : allSubs}
                        kpis={k}
                        delay={0.2}
                        dragHandle={cardDragHandle}
                      />
                    )}
                    {cardId === 'submissions' && (
                      <SubmissionStatusCard
                        project={selectedProject}
                        allSubs={selectedProject ? projectSubs : allSubs}
                        delay={0.25}
                        dragHandle={cardDragHandle}
                      />
                    )}
                    {cardId === 'deadlines' && (
                      <UpcomingDeadlinesCard
                        project={selectedProject}
                        periods={overview.periods}
                        allSubs={selectedProject ? projectSubs : allSubs}
                        delay={0.3}
                        dragHandle={cardDragHandle}
                      />
                    )}
                  </div>

                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const startY = e.clientY
                      const startH = h
                      const onMove = (ev: MouseEvent) => {
                        setH(Math.max(260, Math.min(700, startH + ev.clientY - startY)))
                      }
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    className="absolute bottom-0 left-0 right-0 h-4 flex items-end justify-center pb-1 cursor-ns-resize group z-20"
                    title="Drag to resize card"
                  >
                    <div className="flex items-center gap-0.5">
                      <div className="w-6 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
                      <ChevronsUpDown className="h-3 w-3 text-slate-300 group-hover:text-sky-400 transition-colors" />
                      <div className="w-6 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      </div>
    </div>
  )
}
