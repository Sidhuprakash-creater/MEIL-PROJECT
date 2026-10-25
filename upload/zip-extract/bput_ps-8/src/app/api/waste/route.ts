import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import { apiError, rollupValidationStatus, type ValidationIssue } from '@/lib/engines'

export const runtime = 'nodejs'

const RECORD_TYPE = 'WASTE'

// ---------------------------------------------------------------------------
// GET /api/waste?projectId=&periodId=
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined

    const records = await db.wasteRecord.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(periodId ? { reportingPeriodId: periodId } : {}),
      },
      orderBy: { enteredAt: 'desc' },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        validationResults: { where: { status: 'OPEN' } },
      },
    })
    return NextResponse.json({ records, count: records.length })
  } catch (e: any) {
    return apiError(e)
  }
}

// ---------------------------------------------------------------------------
// POST /api/waste
// Validation: generatedQty >= recovered + recycled + reused + disposed
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('esg.waste.write')
    const body = await req.json()
    const {
      projectId,
      reportingPeriodId,
      wasteType,
      hazardous,
      generatedQty,
      recoveredQty,
      recycledQty,
      reusedQty,
      disposedQty,
      disposalRoute,
      vendor,
      manifestRef,
      sourceUnit,
      evidenceId,
    } = body || {}

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!reportingPeriodId) missing.push('reportingPeriodId')
    if (!wasteType) missing.push('wasteType')
    if (generatedQty === undefined || generatedQty === null) missing.push('generatedQty')
    if (!sourceUnit) missing.push('sourceUnit')
    if (missing.length > 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Missing required fields: ${missing.join(', ')}` } }
    }

    const g = Number(generatedQty)
    const rec = recoveredQty !== undefined && recoveredQty !== null ? Number(recoveredQty) : 0
    const cyc = recycledQty !== undefined && recycledQty !== null ? Number(recycledQty) : 0
    const reu = reusedQty !== undefined && reusedQty !== null ? Number(reusedQty) : 0
    const dis = disposedQty !== undefined && disposedQty !== null ? Number(disposedQty) : 0
    const outflow = rec + cyc + reu + dis

    const issues: ValidationIssue[] = []
    if (!Number.isFinite(g) || g < 0) {
      issues.push({
        ruleCode: 'WST-GEN-NONNEG',
        severity: 'ERROR',
        message: `Generated quantity must be >= 0 (received ${generatedQty})`,
        field: 'generatedQty',
      })
    }
    if (outflow > g) {
      issues.push({
        ruleCode: 'WST-OUTFLOW-LE-GEN',
        severity: 'ERROR',
        message: `Outflow (recovered ${rec} + recycled ${cyc} + reused ${reu} + disposed ${dis} = ${outflow}) exceeds generated (${g})`,
        field: 'generatedQty',
        suggestedAction: 'Reconcile manifest weights with gate register.',
      })
    }
    if (hazardous && !manifestRef) {
      issues.push({
        ruleCode: 'WST-HAZ-MANIFEST',
        severity: 'ERROR',
        message: 'Hazardous waste requires a manifest reference',
        field: 'manifestRef',
        suggestedAction: 'Attach the authorised recycler/TSDF manifest number.',
      })
    }
    if (hazardous && !vendor) {
      issues.push({
        ruleCode: 'WST-HAZ-VENDOR',
        severity: 'WARNING',
        message: 'Hazardous waste should name an authorised vendor',
        field: 'vendor',
      })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw { message: 'VALIDATION_ERROR', payload: { error: `Project not found: ${projectId}` } }
    const period = await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
    if (!period) throw { message: 'VALIDATION_ERROR', payload: { error: `Reporting period not found: ${reportingPeriodId}` } }

    const { validationStatus } = rollupValidationStatus(issues)

    const created = await db.$transaction(async (tx) => {
      const record = await tx.wasteRecord.create({
        data: {
          projectId,
          reportingPeriodId,
          module: RECORD_TYPE,
          wasteType,
          hazardous: Boolean(hazardous),
          generatedQty: g,
          recoveredQty: rec,
          recycledQty: cyc,
          reusedQty: reu,
          disposedQty: dis,
          disposalRoute: disposalRoute ?? null,
          vendor: vendor ?? null,
          manifestRef: manifestRef ?? null,
          sourceUnit,
          evidenceId: evidenceId ?? null,
          validationStatus,
          status: 'DRAFT',
          enteredBy: user.id,
        },
      })

      if (issues.length > 0) {
        await Promise.all(
          issues.map(i =>
            tx.validationResult.create({
              data: {
                ruleCode: i.ruleCode,
                recordId: record.id,
                recordType: RECORD_TYPE,
                severity: i.severity,
                message: i.message,
                field: i.field ?? null,
                suggestedAction: i.suggestedAction ?? null,
                status: 'OPEN',
              },
            }),
          ),
        )
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.roles.map(r => r.name).join(', ') || 'User',
          action: 'CREATE',
          entityType: 'WasteRecord',
          entityId: record.id,
          newState: JSON.stringify({ wasteType, generatedQty: g, hazardous, validationStatus }),
          reason: 'Waste record created via API',
        },
      })

      return record
    })

    const full = await db.wasteRecord.findUnique({
      where: { id: created.id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        validationResults: true,
      },
    })

    return NextResponse.json({ record: full, issues }, { status: 201 })
  } catch (e: any) {
    return apiError(e)
  }
}
