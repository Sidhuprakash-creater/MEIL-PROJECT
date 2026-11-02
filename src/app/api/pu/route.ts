import { NextResponse } from "next/server";

// GET /api/pu — Project User Portal API identity/health marker.
export async function GET() {
  return NextResponse.json({
    service: "meil-project-user-portal-api",
    version: 1,
    time: new Date().toISOString(),
  });
}