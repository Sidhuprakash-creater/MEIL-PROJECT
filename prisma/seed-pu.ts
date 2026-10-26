/**
 * MEIL ESG / BRSR Reporting Platform — Seed Data
 * All data is explicitly marked ILLUSTRATIVE / replaceable (demo: true on users).
 * Mirrors the ESG data control chain: source → evidence → validate → calculate → consolidate → BRSR → report → audit.
 */
import { PrismaClient } from '../src/generated/pu'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding MEIL ESG platform...')

  // ---------- ROLES ----------
  // Site operations roles. Reviewer / governance roles (Group Admin, BU /
  // Subsidiary / Group Reviewers, ESG Manager, BRSR Manager, Auditor,
  // Executive) were removed — re-add them here when those users return.
  const roleDefs = [
    ['PROJECT_USER', 'Environment Data User', 'Project-level environmental source data entry', 1],
    ['FINANCE_USER', 'Finance & Resource Data Contributor', 'Financial turnover, CapEx/OpEx and resource expenditure collection', 1],
    ['HR_USER', 'HR User', 'Workforce & HR data', 1],
    ['EHS_USER', 'EHS / Safety User', 'Safety & environmental incidents', 1],
    ['PROCUREMENT_USER', 'Procurement / Supply Chain User', 'Supplier & value chain', 1],
    ['CSR_USER', 'CSR / Community User', 'CSR & community impact', 1],
    ['COMPLIANCE_USER', 'Compliance / Governance User', 'Governance & ethics', 1],
    ['ESG_ANALYST', 'ESG Analyst', 'Analytics & trends', 3],
  ] as const

  const roles = {} as Record<string, string>
  for (const [key, name, desc, phase] of roleDefs) {
    const r = await db.role.upsert({ where: { key }, update: {}, create: { key, name, description: desc, phase } })
    roles[key] = r.id
  }

  // ---------- PERMISSIONS ----------
  const perms = [
    ['organization.read', 'Organization'], ['organization.write', 'Organization'],
    ['user.read', 'Users'], ['user.create', 'Users'], ['user.update', 'Users'], ['user.disable', 'Users'],
    ['project.read', 'Project'], ['project.write', 'Project'],
    ['esg.energy.write', 'ESG'], ['esg.water.write', 'ESG'], ['esg.waste.write', 'ESG'],
    ['esg.people.write', 'ESG'], ['esg.safety.write', 'ESG'], ['esg.travel.write', 'ESG'],
    ['evidence.upload', 'Evidence'], ['evidence.read', 'Evidence'], ['evidence.verify', 'Evidence'],
    ['submission.submit', 'Submission'], ['submission.review', 'Submission'], ['submission.reject', 'Submission'],
    ['submission.approve', 'Submission'], ['submission.lock', 'Submission'],
    ['brsr.read', 'BRSR'], ['brsr.configure', 'BRSR'], ['brsr.generate', 'BRSR'],
    ['report.read', 'Report'], ['report.generate', 'Report'],
    ['audit.read', 'Audit'],
  ]
  const permIds = {} as Record<string, string>
  for (const [key, cat] of perms) {
    const p = await db.permission.upsert({ where: { key }, update: {}, create: { key, category: cat } })
    permIds[key] = p.id
  }
  const rolePermMap: Record<string, string[]> = {
    PROJECT_USER: ['organization.read', 'project.read', 'esg.energy.write', 'esg.water.write', 'esg.waste.write', 'esg.people.write', 'esg.safety.write', 'esg.travel.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    // Phase-1 data-entry roles — each can write its own ESG module, upload evidence, and submit
    FINANCE_USER: ['organization.read', 'project.read', 'esg.travel.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    HR_USER: ['organization.read', 'project.read', 'esg.people.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    EHS_USER: ['organization.read', 'project.read', 'esg.safety.write', 'esg.energy.write', 'esg.water.write', 'esg.waste.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    PROCUREMENT_USER: ['organization.read', 'project.read', 'esg.travel.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    CSR_USER: ['organization.read', 'project.read', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    COMPLIANCE_USER: ['organization.read', 'project.read', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
    ESG_ANALYST: ['organization.read', 'project.read', 'brsr.read', 'report.read'],
  }
  for (const [rkey, plist] of Object.entries(rolePermMap)) {
    for (const pkey of plist) {
      if (permIds[pkey]) {
        await db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roles[rkey], permissionId: permIds[pkey] } },
          update: {}, create: { roleId: roles[rkey], permissionId: permIds[pkey] },
        })
      }
    }
  }

  // ---------- ORG HIERARCHY (illustrative) ----------
  const group = await db.group.create({ data: { code: 'MEIL', name: 'MEIL Group', legalName: 'MEIL Engineering Group', status: 'ACTIVE', metadata: '{"illustrative": true}' } })

  const subA = await db.subsidiary.create({ data: { groupId: group.id, code: 'MEIL-POWER', name: 'MEIL Power Systems', legalName: 'MEIL Power Systems Ltd', cin: 'U40300MH2010PLC123456', status: 'ACTIVE' } })
  const subB = await db.subsidiary.create({ data: { groupId: group.id, code: 'MEIL-INFRA', name: 'MEIL Infrastructure', legalName: 'MEIL Infra Ventures Ltd', cin: 'U70102MH2011PLC654321', status: 'ACTIVE' } })

  const bu1 = await db.businessUnit.create({ data: { subsidiaryId: subA.id, code: 'MEIL-POWER-GEN', name: 'Power Generation', sector: 'Renewable Energy', status: 'ACTIVE' } })
  const bu2 = await db.businessUnit.create({ data: { subsidiaryId: subA.id, code: 'MEIL-POWER-TD', name: 'Transmission & Distribution', sector: 'Power T&D', status: 'ACTIVE' } })
  const bu3 = await db.businessUnit.create({ data: { subsidiaryId: subB.id, code: 'MEIL-INFRA-WATER', name: 'Water Infrastructure', sector: 'Water & Irrigation', status: 'ACTIVE' } })

  const projects = [
    { bu: bu1.id, code: 'MEIL-SOL-GJT', name: 'Gayatri Solar Plant', location: 'Gayatri, Telangana', country: 'India', state: 'Telangana' },
    { bu: bu1.id, code: 'MEIL-SOL-NZR', name: 'Nizamabad Solar Farm', location: 'Nizamabad, Telangana', country: 'India', state: 'Telangana' },
    { bu: bu2.id, code: 'MEIL-TD-HYD', name: 'Hyderabad 33kV Substation', location: 'Hyderabad, Telangana', country: 'India', state: 'Telangana' },
    { bu: bu3.id, code: 'MEIL-WTR-KPR', name: 'Kaleshwaram Lift Irrigation', location: 'Jayashankar, Telangana', country: 'India', state: 'Telangana' },
  ]
  const projIds = {} as Record<string, string>
  for (const p of projects) {
    const rec = await db.project.create({ data: { businessUnitId: p.bu, projectCode: p.code, projectName: p.name, location: p.location, country: p.country, state: p.state, status: 'ACTIVE' } })
    projIds[p.code] = rec.id
  }

  // ---------- USERS (demo, illustrative — site operations roles) ----------
  const pass = await bcrypt.hash('esg12345', 10)
  const users = [
    { email: 'rohit@meil-esg.in', name: 'Rohit Kumar', code: 'MEIL-PU-014', role: 'PROJECT_USER', scope: { type: 'PROJECT', id: projIds['MEIL-SOL-GJT'] } },
    { email: 'sunita@meil-esg.in', name: 'Sunita Rao', code: 'MEIL-HR-022', role: 'HR_USER', scope: { type: 'SUBSIDIARY', id: subA.id } },
    { email: 'kvenkat@meil-esg.in', name: 'K. Venkat', code: 'MEIL-EHS-009', role: 'EHS_USER', scope: { type: 'PROJECT', id: projIds['MEIL-SOL-GJT'] } },
    { email: 'priya@meil-esg.in', name: 'Priya Nair', code: 'MEIL-PRC-031', role: 'PROCUREMENT_USER', scope: { type: 'SUBSIDIARY', id: subA.id } },
    { email: 'imran@meil-esg.in', name: 'Imran Sheikh', code: 'MEIL-CSR-017', role: 'CSR_USER', scope: { type: 'SUBSIDIARY', id: subB.id } },
    { email: 'deepika@meil-esg.in', name: 'Deepika Joshi', code: 'MEIL-GOV-005', role: 'COMPLIANCE_USER', scope: { type: 'GROUP', id: group.id } },
    { email: 'finance@meil-esg.in', name: 'Rahul Verma', code: 'MEIL-FIN-001', role: 'FINANCE_USER', scope: { type: 'GROUP', id: group.id } },
    { email: 'sameer@meil-esg.in', name: 'Sameer Khan', code: 'MEIL-ANA-001', role: 'ESG_ANALYST', scope: { type: 'GROUP', id: group.id } },
  ] as const

  const userIds = {} as Record<string, { id: string; name: string; role: string }>
  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } })
    const id = existing?.id ?? (await db.user.create({
      data: { email: u.email, name: u.name, employeeCode: u.code, passwordHash: pass, groupId: (u as any).groupId ?? null, status: 'ACTIVE', demo: true,
        userRoles: { create: { roleId: roles[u.role] } },
        userScopes: (u as any).scope ? { create: { scopeType: (u as any).scope.type, scopeId: (u as any).scope.id } } : undefined,
      }
    })).id
    userIds[u.email] = { id, name: u.name, role: u.role }
  }

  // ---------- REPORTING YEAR + PERIODS ----------
  const rYear = await db.reportingYear.create({ data: { groupId: group.id, year: 2026, label: 'FY 2026-27', status: 'OPEN' } })
  const months = [
    { m: 3, label: 'April 2026', start: '2026-04-01', end: '2026-04-30', sub: '04-30', rev: '05-10', app: '05-20' },
    { m: 4, label: 'May 2026', start: '2026-05-01', end: '2026-05-31', sub: '05-31', rev: '06-10', app: '06-20' },
    { m: 5, label: 'June 2026', start: '2026-06-01', end: '2026-06-30', sub: '06-30', rev: '07-10', app: '07-20' },
  ]
  const periodIds = {} as Record<string, string>
  for (const mp of months) {
    const p = await db.reportingPeriod.create({
      data: {
        reportingYearId: rYear.id, periodType: 'MONTHLY', periodLabel: mp.label, year: 2026, month: mp.m,
        startDate: new Date(mp.start), endDate: new Date(mp.end),
        submissionDeadline: new Date(`2026-${mp.sub}T23:59:59Z`),
        reviewDeadline: new Date(`2026-${mp.rev}T23:59:59Z`),
        approvalDeadline: new Date(`2026-${mp.app}T23:59:59Z`),
        status: 'OPEN',
      }
    })
    periodIds[mp.label] = p.id
  }

  // ---------- UNITS, CONVERSIONS, EMISSION FACTORS ----------
  const units = [
    ['KWH', 'Kilowatt-hour', 'ENERGY', 'KWH'],
    ['MWH', 'Megawatt-hour', 'ENERGY', 'KWH'],
    ['GJ', 'Gigajoule', 'ENERGY', 'GJ'],
    ['L', 'Litre', 'VOLUME', 'L'],
    ['KL', 'Kilolitre', 'VOLUME', 'L'],
    ['M3', 'Cubic metre', 'VOLUME', 'L'],
    ['KG', 'Kilogram', 'MASS', 'KG'],
    ['TON', 'Metric tonne', 'MASS', 'KG'],
    ['TCO2E', 'tCO₂e', 'EMISSION', 'TCO2E'],
  ]
  for (const [code, name, cat, base] of units) {
    await db.unitMaster.upsert({ where: { code }, update: {}, create: { code, name, category: cat, baseUnit: base } })
  }
  const convs = [
    ['KWH', 'GJ', 0.0036, 'ENERGY', 1], ['MWH', 'KWH', 1000, 'ENERGY', 1], ['MWH', 'GJ', 3.6, 'ENERGY', 1],
    ['L', 'KL', 0.001, 'VOLUME', 1], ['M3', 'L', 1000, 'VOLUME', 1], ['KG', 'TON', 0.001, 'MASS', 1],
  ]
  for (const [f, t, factor, cat, v] of convs) {
    await db.conversionRule.create({ data: { fromUnit: f as string, toUnit: t as string, factor: factor as number, category: cat as string, version: v as number } })
  }
  // Emission factors (illustrative — Indian CEA grid factor + common fuels)
  const factors = [
    { name: 'Grid Electricity (India)', category: 'ELECTRICITY', fuelType: 'GRID', geography: 'IN', factorValue: 0.716, factorUnit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'CEA v19', sourceDocument: 'CEA CO2 Baseline Database v19' },
    { name: 'Diesel (HSD)', category: 'MOBILE', fuelType: 'DIESEL', geography: 'IN', factorValue: 2.637, factorUnit: 'kgCO2e/L', scope: 'SCOPE_1', methodology: 'IPCC 2006', sourceDocument: 'IPCC Guidelines 2006 Vol 2 Ch 2' },
    { name: 'Petrol (MS)', category: 'MOBILE', fuelType: 'PETROL', geography: 'IN', factorValue: 2.296, factorUnit: 'kgCO2e/L', scope: 'SCOPE_1', methodology: 'IPCC 2006' },
    { name: 'Coal (Sub-bituminous)', category: 'STATIONARY', fuelType: 'COAL', geography: 'IN', factorValue: 1.9, factorUnit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006' },
    { name: 'CNG', category: 'STATIONARY', fuelType: 'CNG', geography: 'IN', factorValue: 2.19, factorUnit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006' },
    { name: 'LPG', category: 'STATIONARY', fuelType: 'LPG', geography: 'IN', factorValue: 2.98, factorUnit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006' },
    { name: 'Renewable PPA Solar', category: 'ELECTRICITY', fuelType: 'SOLAR_PPA', geography: 'IN', factorValue: 0.04, factorUnit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'ISAE 3000' },
    { name: 'Air Travel (Domestic)', category: 'TRAVEL', fuelType: 'AVIATION', geography: 'IN', factorValue: 0.18, factorUnit: 'kgCO2e/pass-km', scope: 'SCOPE_3', methodology: 'GHG Protocol Scope 3' },
    { name: 'Rail Travel', category: 'TRAVEL', fuelType: 'RAIL', geography: 'IN', factorValue: 0.04, factorUnit: 'kgCO2e/pass-km', scope: 'SCOPE_3', methodology: 'GHG Protocol Scope 3' },
    { name: 'Road Travel (Car)', category: 'TRAVEL', fuelType: 'PETROL', geography: 'IN', factorValue: 0.11, factorUnit: 'kgCO2e/pass-km', scope: 'SCOPE_3', methodology: 'GHG Protocol Scope 3' },
  ]
  const factorIds = {} as Record<string, string>
  for (const f of factors) {
    const ef = await db.emissionFactor.create({ data: { ...f, source: (f as any).source || (f as any).methodology || 'IPCC', effectiveFrom: new Date('2025-04-01'), version: 1, status: 'ACTIVE' } })
    factorIds[f.name] = ef.id
  }

  // ---------- BRSR FRAMEWORK (config-driven, versioned) ----------
  const fw = await db.brsrFramework.create({ data: { name: 'BRSR', version: 'v3', reportingYear: 2026, tier: 'CORE', status: 'ACTIVE' } })
  const secA = await db.brsrSection.create({ data: { frameworkId: fw.id, code: 'A', name: 'General Disclosures', description: 'Entity identity & business overview', sortOrder: 1 } })
  const secB = await db.brsrSection.create({ data: { frameworkId: fw.id, code: 'B', name: 'Management & Process Disclosures', description: 'Policies, governance, performance', sortOrder: 2 } })
  const secC = await db.brsrSection.create({ data: { frameworkId: fw.id, code: 'C', name: 'Principle-wise Performance', description: 'Principles 1-9 indicator performance', sortOrder: 3 } })
  const principles = [
    ['P1', 'Ethics & Integrity', 'Business conducted ethically, transparently, with integrity'], ['P2', 'Sustainable Products & Services', 'Goods sustainable, safe, resource efficient'],
    ['P3', 'Employees & Communities', 'Respect & promote employee wellbeing & community development'], ['P4', 'Stakeholders', 'Respect, respond to stakeholder interests'],
    ['P5', 'Human Rights', 'Respect & promote human rights'], ['P6', 'Environment', 'Respect & make efforts to protect & restore environment'],
    ['P7', 'Public Policy & Advocacy', 'Respect & influence public policy per law'], ['P8', 'Inclusive Value Chain', 'Promote inclusive growth & equitable access'],
    ['P9', 'Customers & Consumers', 'Engage responsibly with customers & consumers'],
  ]
  const prIds = {} as Record<string, string>
  for (let i = 0; i < principles.length; i++) {
    const [code, name, title] = principles[i]
    const p = await db.brsrPrinciple.create({ data: { frameworkId: fw.id, code, name, title, description: title, sortOrder: i + 1 } })
    prIds[code] = p.id
  }

  // BRSR questions (config-driven — illustrative subset covering key quantitative indicators)
  const brsrQs = [
    // Section A
    { sec: 'A', p: null, code: 'A-1', text: 'CIN of the entity', type: 'TEXT', mapping: 'SUBSIDIARY.cin' },
    { sec: 'A', p: null, code: 'A-2', text: 'Name of the listed entity', type: 'TEXT', mapping: 'SUBSIDIARY.name' },
    { sec: 'A', p: null, code: 'A-3', text: 'Total number of employees (permanent + non-permanent)', type: 'NUMERIC', unit: 'count', mapping: 'WORKFORCE.total' },
    { sec: 'A', p: null, code: 'A-4', text: 'Total number of workers', type: 'NUMERIC', unit: 'count', mapping: 'WORKFORCE.workers' },
    { sec: 'A', p: null, code: 'A-5', text: 'Net turnover (₹ crore)', type: 'NUMERIC', unit: 'INR crore', mapping: 'FINANCIAL.turnover', sourceType: 'MANUAL' },
    // P3 — Employees
    { sec: 'C', p: 'P3', code: 'P3-1', text: 'Total permanent employees (Male / Female / Other)', type: 'SOURCE_MAPPED', mapping: 'WORKFORCE.permanent' },
    { sec: 'C', p: 'P3', code: 'P3-2', text: 'Total non-permanent employees', type: 'SOURCE_MAPPED', mapping: 'WORKFORCE.nonPermanent' },
    { sec: 'C', p: 'P3', code: 'P3-3', text: 'Number of fatalities (LTIFR)', type: 'SOURCE_MAPPED', mapping: 'SAFETY.fatalities', evidenceRequired: true },
    { sec: 'C', p: 'P3', code: 'P3-4', text: 'Lost Time Injury Frequency Rate (LTIFR)', type: 'NUMERIC', unit: 'per million hours', mapping: 'SAFETY.ltifr', calculationMethod: 'CALCULATED' },
    { sec: 'C', p: 'P3', code: 'P3-5', text: 'Total training hours (employee)', type: 'SOURCE_MAPPED', mapping: 'WORKFORCE.trainingHours' },
    // P6 — Environment
    { sec: 'C', p: 'P6', code: 'P6-1', text: 'Scope 1 emissions (tCO₂e)', type: 'NUMERIC', unit: 'tCO₂e', mapping: 'ENERGY.scope1', calculationMethod: 'CALCULATED', evidenceRequired: true },
    { sec: 'C', p: 'P6', code: 'P6-2', text: 'Scope 2 emissions (tCO₂e)', type: 'NUMERIC', unit: 'tCO₂e', mapping: 'ENERGY.scope2', calculationMethod: 'CALCULATED', evidenceRequired: true },
    { sec: 'C', p: 'P6', code: 'P6-3', text: 'Total energy consumption (GJ)', type: 'NUMERIC', unit: 'GJ', mapping: 'ENERGY.totalGJ', calculationMethod: 'CALCULATED' },
    { sec: 'C', p: 'P6', code: 'P6-4', text: 'Renewable energy share (%)', type: 'NUMERIC', unit: '%', mapping: 'ENERGY.renewableShare', calculationMethod: 'CALCULATED' },
    { sec: 'C', p: 'P6', code: 'P6-5', text: 'Water withdrawal (KL)', type: 'SOURCE_MAPPED', unit: 'KL', mapping: 'WATER.withdrawal', evidenceRequired: true },
    { sec: 'C', p: 'P6', code: 'P6-6', text: 'Water recycled / reused (%)', type: 'NUMERIC', unit: '%', mapping: 'WATER.recycledShare', calculationMethod: 'CALCULATED' },
    { sec: 'C', p: 'P6', code: 'P6-7', text: 'Hazardous waste generated (T)', type: 'SOURCE_MAPPED', unit: 'T', mapping: 'WASTE.hazardous', evidenceRequired: true },
    { sec: 'C', p: 'P6', code: 'P6-8', text: 'Waste recycled / recovered (%)', type: 'NUMERIC', unit: '%', mapping: 'WASTE.recycledShare', calculationMethod: 'CALCULATED' },
    // P8 — Inclusive value chain
    { sec: 'C', p: 'P8', code: 'P8-1', text: 'CSR spend (₹ crore)', type: 'NUMERIC', unit: 'INR crore', mapping: 'CSR.spend', sourceType: 'MANUAL' },
    // P9 — Customers
    { sec: 'C', p: 'P9', code: 'P9-1', text: 'Cybersecurity incidents', type: 'SOURCE_MAPPED', mapping: 'GOVERNANCE.cyberIncidents' },
    // P1 — Ethics
    { sec: 'C', p: 'P1', code: 'P1-1', text: 'Anti-corruption training coverage (%)', type: 'NUMERIC', unit: '%', mapping: 'GOVERNANCE.antiCorruptionTraining', sourceType: 'MANUAL' },
  ] as const
  for (let i = 0; i < brsrQs.length; i++) {
    const q = brsrQs[i]
    await db.brsrQuestion.create({
      data: {
        frameworkId: fw.id,
        sectionId: (q as any).sec === 'A' ? secA.id : (q as any).sec === 'B' ? secB.id : secC.id,
        principleId: (q as any).p ? prIds[(q as any).p] : null,
        questionCode: (q as any).code, questionText: (q as any).text,
        answerType: (q as any).type, unit: (q as any).unit ?? null,
        evidenceRequired: (q as any).evidenceRequired ?? false,
        mappingSource: (q as any).mapping, calculationMethod: (q as any).calculationMethod ?? null,
        sortOrder: i + 1,
      }
    })
  }

  // ---------- ESG SOURCE RECORDS (illustrative — clearly marked via demo users) ----------
  const gayatri = projIds['MEIL-SOL-GJT']
  const rohitId = userIds['rohit@meil-esg.in'].id
  const april = periodIds['April 2026']
  const may = periodIds['May 2026']
  const june = periodIds['June 2026']

  // Energy: Gayatri Solar — April (grid + diesel), May, June
  const e1 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'ENERGY', source: 'Grid Electricity', sourceCategory: 'NON_RENEWABLE', quantity: 384000, sourceUnit: 'KWH', normalizedValue: 1382.4, normalizedUnit: 'GJ', vendor: 'TSSPDCL', meterRef: 'MTR-GJT-33kV-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'APPROVED', enteredBy: rohitId } })
  const e2 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'ENERGY', source: 'Diesel (HSD)', sourceCategory: 'NON_RENEWABLE', quantity: 18650, sourceUnit: 'L', normalizedValue: 713.2, normalizedUnit: 'GJ', vendor: 'IOCL', meterRef: 'DSE-GJT-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'APPROVED', enteredBy: rohitId } })
  const e3 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'ENERGY', source: 'Solar PPA', sourceCategory: 'RENEWABLE', quantity: 510000, sourceUnit: 'KWH', normalizedValue: 1836, normalizedUnit: 'GJ', vendor: 'MEIL Solar', meterRef: 'PPA-GJT-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'APPROVED', enteredBy: rohitId } })
  const e4 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: may, module: 'ENERGY', source: 'Grid Electricity', sourceCategory: 'NON_RENEWABLE', quantity: 412000, sourceUnit: 'KWH', normalizedValue: 1483.2, normalizedUnit: 'GJ', vendor: 'TSSPDCL', meterRef: 'MTR-GJT-33kV-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'APPROVED', enteredBy: rohitId } })
  const e5 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: may, module: 'ENERGY', source: 'Diesel (HSD)', sourceCategory: 'NON_RENEWABLE', quantity: 17200, sourceUnit: 'L', normalizedValue: 657.8, normalizedUnit: 'GJ', vendor: 'IOCL', meterRef: 'DSE-GJT-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'APPROVED', enteredBy: rohitId } })
  const e6 = await db.energyRecord.create({ data: { projectId: gayatri, reportingPeriodId: june, module: 'ENERGY', source: 'Grid Electricity', sourceCategory: 'NON_RENEWABLE', quantity: 398000, sourceUnit: 'KWH', normalizedValue: 1432.8, normalizedUnit: 'GJ', vendor: 'TSSPDCL', meterRef: 'MTR-GJT-33kV-01', validationStatus: 'PASSED', calculationStatus: 'COMPLETED', status: 'DRAFT', enteredBy: rohitId } })

  // Calculation results for the energy records (deterministic: factor * quantity)
  await db.calculationResult.createMany({ data: [
    { recordType: 'ENERGY', recordId: e1.id, energyRecordId: e1.id, factorId: factorIds['Grid Electricity (India)'], factorVersion: 1, sourceValue: 384000, sourceUnit: 'KWH', normalizedValue: 1382.4, normalizedUnit: 'GJ', calculatedValue: 274.94, resultUnit: 'tCO2e', scope: 'SCOPE_2', methodologyNote: 'Grid factor 0.716 kgCO2e/kWh' },
    { recordType: 'ENERGY', recordId: e2.id, energyRecordId: e2.id, factorId: factorIds['Diesel (HSD)'], factorVersion: 1, sourceValue: 18650, sourceUnit: 'L', normalizedValue: 713.2, normalizedUnit: 'GJ', calculatedValue: 49.18, resultUnit: 'tCO2e', scope: 'SCOPE_1', methodologyNote: 'Diesel factor 2.637 kgCO2e/L' },
    { recordType: 'ENERGY', recordId: e3.id, energyRecordId: e3.id, factorId: factorIds['Renewable PPA Solar'], factorVersion: 1, sourceValue: 510000, sourceUnit: 'KWH', normalizedValue: 1836, normalizedUnit: 'GJ', calculatedValue: 20.4, resultUnit: 'tCO2e', scope: 'SCOPE_2', methodologyNote: 'Solar PPA 0.04 kgCO2e/kWh' },
    { recordType: 'ENERGY', recordId: e4.id, energyRecordId: e4.id, factorId: factorIds['Grid Electricity (India)'], factorVersion: 1, sourceValue: 412000, sourceUnit: 'KWH', normalizedValue: 1483.2, normalizedUnit: 'GJ', calculatedValue: 294.99, resultUnit: 'tCO2e', scope: 'SCOPE_2', methodologyNote: 'Grid factor 0.716 kgCO2e/kWh' },
    { recordType: 'ENERGY', recordId: e5.id, energyRecordId: e5.id, factorId: factorIds['Diesel (HSD)'], factorVersion: 1, sourceValue: 17200, sourceUnit: 'L', normalizedValue: 657.8, normalizedUnit: 'GJ', calculatedValue: 45.36, resultUnit: 'tCO2e', scope: 'SCOPE_1', methodologyNote: 'Diesel factor 2.637 kgCO2e/L' },
    { recordType: 'ENERGY', recordId: e6.id, energyRecordId: e6.id, factorId: factorIds['Grid Electricity (India)'], factorVersion: 1, sourceValue: 398000, sourceUnit: 'KWH', normalizedValue: 1432.8, normalizedUnit: 'GJ', calculatedValue: 284.97, resultUnit: 'tCO2e', scope: 'SCOPE_2', methodologyNote: 'Grid factor 0.716 kgCO2e/kWh' },
  ]})

  // Water — Gayatri April/May (ZLD active)
  await db.waterRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'WATER', source: 'Ground Water', withdrawal: 4200, consumption: 1260, discharge: 800, recycledReused: 2140, treatment: 'STP', destination: 'Irrigation', sourceUnit: 'KL', waterStress: true, zldActive: true, validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })
  await db.waterRecord.create({ data: { projectId: gayatri, reportingPeriodId: may, module: 'WATER', source: 'Ground Water', withdrawal: 4600, consumption: 1380, discharge: 900, recycledReused: 2320, treatment: 'STP', destination: 'Irrigation', sourceUnit: 'KL', waterStress: true, zldActive: true, validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })

  // Waste — Gayatri April
  await db.wasteRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'WASTE', wasteType: 'E-waste', hazardous: true, generatedQty: 0.8, recoveredQty: 0.75, recycledQty: 0.75, reusedQty: 0, disposedQty: 0.05, disposalRoute: 'Authorised Recycler', vendor: 'Ecoreco', manifestRef: 'EWM-GJT-04-01', sourceUnit: 'TON', validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })
  await db.wasteRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'WASTE', wasteType: 'DG Oil Sludge', hazardous: true, generatedQty: 1.2, recoveredQty: 0.9, recycledQty: 0.9, reusedQty: 0, disposedQty: 0.3, disposalRoute: 'TSDF', vendor: 'Ramky', manifestRef: 'EWM-GJT-04-02', sourceUnit: 'TON', validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })
  await db.wasteRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'WASTE', wasteType: 'Solar Panel Scrap', hazardous: false, generatedQty: 2.4, recoveredQty: 2.3, recycledQty: 2.3, reusedQty: 0, disposedQty: 0.1, disposalRoute: 'Recycler', vendor: 'Renewsys', manifestRef: 'EWM-GJT-04-03', sourceUnit: 'TON', validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })

  // Workforce — Gayatri April
  await db.workforceRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'PEOPLE', category: 'EMPLOYEE', permanent: 42, nonPermanent: 8, male: 38, female: 12, other: 0, differentlyAbled: 1, newHires: 2, exits: 1, trainingHours: 312, validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })
  await db.workforceRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'PEOPLE', category: 'WORKER', permanent: 18, nonPermanent: 34, male: 48, female: 4, other: 0, differentlyAbled: 0, trainingHours: 184, validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })

  // Safety — Gayatri April
  await db.safetyRecord.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'SAFETY', recordType: 'INCIDENT', fatalities: 0, injuries: 1, lostTimeIncidents: 0, recordableInjuries: 1, highConsequenceIncidents: 0, trainingHours: 96, safetyHours: 28800, manHoursWorked: 48600, correctiveActions: 'Toolbox talk + PPE audit', validationStatus: 'PASSED', status: 'APPROVED', enteredBy: rohitId } })

  // Evidence files (illustrative — stored metadata only)
  const ev1 = await db.evidence.create({ data: { fileName: 'GJT-Grid-Bill-Apr2026.pdf', documentType: 'INVOICE', documentDate: new Date('2026-04-30'), reportingPeriodId: april, projectId: gayatri, module: 'ENERGY', sourceRecordId: e1.id, uploaderId: rohitId, filePath: '/evidence/gjt-grid-bill-apr2026.pdf', fileSize: 284000, mimeType: 'application/pdf', hash: 'sha256:illustrative:grid-bill-apr', version: 1, status: 'VERIFIED', verifiedBy: rohitId, verifiedAt: new Date('2026-05-06') } })
  const ev2 = await db.evidence.create({ data: { fileName: 'GJT-Diesel-Register-Apr2026.pdf', documentType: 'REGISTER', documentDate: new Date('2026-04-30'), reportingPeriodId: april, projectId: gayatri, module: 'ENERGY', sourceRecordId: e2.id, uploaderId: rohitId, filePath: '/evidence/gjt-diesel-register-apr2026.pdf', fileSize: 196000, mimeType: 'application/pdf', hash: 'sha256:illustrative:diesel-reg-apr', version: 1, status: 'VERIFIED', verifiedBy: rohitId, verifiedAt: new Date('2026-05-06') } })
  await db.evidence.create({ data: { fileName: 'GJT-Water-STP-Apr2026.pdf', documentType: 'REGISTER', documentDate: new Date('2026-04-30'), reportingPeriodId: april, projectId: gayatri, module: 'WATER', uploaderId: rohitId, filePath: '/evidence/gjt-water-stp-apr2026.pdf', fileSize: 158000, mimeType: 'application/pdf', hash: 'sha256:illustrative:water-stp-apr', version: 1, status: 'VERIFIED', verifiedBy: rohitId, verifiedAt: new Date('2026-05-06') } })
  await db.evidence.create({ data: { fileName: 'GJT-Waste-Manifest-Apr2026.pdf', documentType: 'WASTE_MANIFEST', documentDate: new Date('2026-04-30'), reportingPeriodId: april, projectId: gayatri, module: 'WASTE', uploaderId: rohitId, filePath: '/evidence/gjt-waste-manifest-apr2026.pdf', fileSize: 312000, mimeType: 'application/pdf', hash: 'sha256:illustrative:waste-manifest-apr', version: 1, status: 'VERIFIED', verifiedBy: rohitId, verifiedAt: new Date('2026-05-06') } })

  // link evidence to records
  await db.energyRecord.update({ where: { id: e1.id }, data: { evidenceId: ev1.id } })
  await db.energyRecord.update({ where: { id: e2.id }, data: { evidenceId: ev2.id } })

  // Submission — Gayatri April ENERGY module
  const sub = await db.submission.create({ data: { projectId: gayatri, reportingPeriodId: april, module: 'ENERGY', title: 'Gayatri Solar — Energy April 2026', status: 'APPROVED', recordIds: JSON.stringify([e1.id, e2.id, e3.id]), completionPct: 100, evidenceCount: 2, validationPassed: 3, validationErrors: 0, submittedBy: rohitId, submittedAt: new Date('2026-05-03') } })
  await db.submissionStatusHistory.create({ data: { submissionId: sub.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'SUBMIT', comment: 'April energy data submitted with evidence', createdAt: new Date('2026-05-03T10:00:00Z') } })

  // Audit logs
  await db.auditLog.createMany({ data: [
    { actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'CREATE', entityType: 'EnergyRecord', entityId: e1.id, newState: JSON.stringify({ quantity: 384000, source: 'Grid Electricity', status: 'DRAFT' }), reason: 'April grid electricity entry', createdAt: new Date('2026-05-02T08:20:00Z') },
    { actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'EVIDENCE_UPLOAD', entityType: 'Evidence', entityId: ev1.id, newState: JSON.stringify({ fileName: 'GJT-Grid-Bill-Apr2026.pdf' }), reason: 'Evidence attached to grid record', createdAt: new Date('2026-05-02T08:45:00Z') },
    { actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'CALCULATION', entityType: 'EnergyRecord', entityId: e1.id, newState: JSON.stringify({ calculatedValue: 274.94, scope: 'SCOPE_2', factorVersion: 1 }), reason: 'Emission calculation: 384000 kWh * 0.716', createdAt: new Date('2026-05-02T09:00:00Z') },
    { actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'SUBMIT', entityType: 'Submission', entityId: sub.id, newState: JSON.stringify({ status: 'SUBMITTED' }), reason: 'Energy module submission April 2026', createdAt: new Date('2026-05-03T10:00:00Z') },
    { actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Environment Data User', action: 'EVIDENCE_VERIFY', entityType: 'Evidence', entityId: ev1.id, newState: JSON.stringify({ status: 'VERIFIED' }), reason: 'Grid bill verified against meter reading', createdAt: new Date('2026-05-06T11:00:00Z') },
  ]})

  // Activity feed
  await db.activity.createMany({ data: [
    { projectId: gayatri, actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Site Officer', action: 'DATA_ENTRY', title: 'HSD Fuel Log Submitted', description: 'Batch #HMR-01 (18,650 L) logged for DG Heavy Fleet', module: 'ENERGY', status: 'SUBMITTED', createdAt: new Date('2026-05-03T10:00:00Z') },
    { projectId: gayatri, actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Site Officer', action: 'APPROVE', title: 'Grid Power Log Verified', description: '384,000 kWh verified against TSSPDCL invoice', module: 'ENERGY', status: 'APPROVED', createdAt: new Date('2026-05-06T11:30:00Z') },
    { projectId: gayatri, actorId: rohitId, actorName: 'Rohit Kumar', actorRole: 'Site Officer', action: 'EVIDENCE_UPLOAD', title: 'STP Water Log Draft Saved', description: 'Water STP register uploaded, awaiting validation', module: 'WATER', status: 'DRAFT', createdAt: new Date('2026-05-04T14:20:00Z') },
    { projectId: gayatri, actorId: userIds['kvenkat@meil-esg.in'].id, actorName: 'K. Venkat', actorRole: 'Plant Mech', action: 'CALCULATION', title: 'Emission Calculation Completed', description: 'Scope 1+2 = 344.5 tCO₂e computed for April', module: 'ENERGY', status: 'COMPLETED', createdAt: new Date('2026-05-05T16:45:00Z') },
  ]})

  // Notifications
  await db.notification.createMany({ data: [
    { userId: rohitId, type: 'SUBMISSION_DUE', title: 'June 2026 submission due', message: 'Energy data for June 2026 is due by 30 Jun.', severity: 'WARNING', read: false, linkEntity: 'PROJECT', linkId: gayatri, createdAt: new Date('2026-06-25T09:00:00Z') },
    { userId: userIds['kvenkat@meil-esg.in'].id, type: 'ANOMALY_DETECTED', title: 'Diesel consumption spike', message: 'May diesel usage 8% below April — within range.', severity: 'INFO', read: true, createdAt: new Date('2026-06-02T08:00:00Z') },
  ]})

  // BRSR answers — map from real approved data (illustrative of source-mapped answers)
  const allQs = await db.brsrQuestion.findMany({ where: { frameworkId: fw.id } })
  for (const q of allQs) {
    // For April, derive answers from Gayatri approved records
    await db.brsrAnswer.create({
      data: {
        frameworkId: fw.id, questionId: q.id, projectId: gayatri, reportingPeriodId: april,
        answerValue: q.mappingSource ?? null,
        sourceType: q.mappingSource?.startsWith('MANUAL') || q.mappingSource === 'FINANCIAL.turnover' || q.mappingSource === 'CSR.spend' ? 'MANUAL' : (q.mappingSource?.includes('ENERGY') || q.mappingSource?.includes('WATER') || q.mappingSource?.includes('WASTE') || q.mappingSource?.includes('WORKFORCE') || q.mappingSource?.includes('SAFETY') ? 'CONSOLIDATED_KPI' : 'MANUAL'),
        status: q.mappingSource && (q.mappingSource.includes('ENERGY') || q.mappingSource.includes('WATER') || q.mappingSource.includes('WASTE') || q.mappingSource.includes('WORKFORCE') || q.mappingSource.includes('SAFETY')) ? 'APPROVED' : 'MISSING',
        readinessWeight: 1,
      }
    })
  }

  // Report (one generated BRSR preview report)
  await db.report.create({ data: { reportType: 'BRSR', frameworkId: fw.id, reportingYear: 2026, periodLabel: 'April 2026 (illustrative)', scopeType: 'PROJECT', scopeId: gayatri, scopeName: 'Gayatri Solar Plant', generatedBy: rohitId, generatedByName: 'Rohit Kumar', status: 'COMPLETED', fileName: 'BRSR-Gayatri-Apr2026-preview.pdf', fileType: 'PDF', content: 'BRSR report content (illustrative)', version: 1 } })

  console.log('✅ Seed complete. Users: rohit@meil-esg.in / finance@meil-esg.in / ... (password: esg12345)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
