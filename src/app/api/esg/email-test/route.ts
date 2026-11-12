import { NextRequest } from "next/server";
import { handle, ok, fail, body, requireGroupAdmin } from "@/lib/esg/server";
import {
  sendUserInviteEmail,
  sendUserCreatedAdminAlertEmail,
  sendPasswordResetLinkEmail,
  sendDeadlineAlertEmail,
  isEmailConfigured,
  verifySmtp,
  type EmailSendResult,
} from "@/lib/notify/email";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireGroupAdmin({ readOnly: true });
    const smtpCheck = await verifySmtp();
    const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
    return ok({
      activeTransport: smtpCheck.connected ? "SMTP" : hasResend ? "RESEND" : "NONE",
      smtp: smtpCheck,
      resend: {
        configured: hasResend,
        fromEmail: process.env.RESEND_FROM_EMAIL || "MEIL ESG Platform <onboarding@resend.dev>",
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireGroupAdmin();
    const b = await body<{
      recipient?: string;
      template?: "INVITE" | "ADMIN_ALERT" | "PASSWORD_RESET" | "DEADLINE";
      sampleName?: string;
    }>(req);

    const recipient = b.recipient?.trim().toLowerCase();
    if (!recipient || !recipient.includes("@")) {
      return fail("A valid recipient email address is required.", 400);
    }

    if (!isEmailConfigured()) {
      return fail("Email service is not configured (SMTP or RESEND credentials missing in .env).", 400);
    }

    const template = b.template ?? "INVITE";
    const sampleName = b.sampleName?.trim() || "ESG Team Member";
    const origin = new URL(req.url).origin;
    let result: EmailSendResult;

    switch (template) {
      case "INVITE":
        result = await sendUserInviteEmail({
          to: recipient,
          name: sampleName,
          roleLabel: "Site Data Entry",
          employeeId: "PRJ-TEST-001",
          tempPassword: "DemoTempPass123!",
          googleEmail: recipient,
          orgScopeLabel: "Kaleshwaram Lift Irrigation Package-06 (MEIL Core)",
          invitedByName: actor.name,
          origin,
        });
        break;

      case "ADMIN_ALERT":
        result = await sendUserCreatedAdminAlertEmail({
          adminEmails: [recipient],
          creatorName: actor.name,
          user: {
            name: sampleName,
            email: recipient,
            employeeId: "PRJ-TEST-001",
            googleEmail: recipient,
            roleLabel: "Environment Data User",
            orgScopeLabel: "HH-300 Automated Hydraulic Rigs Line",
            authProvider: "BOTH",
          },
          origin,
        });
        break;

      case "PASSWORD_RESET":
        result = await sendPasswordResetLinkEmail({
          to: recipient,
          name: sampleName,
          resetUrl: `${origin}/?resetToken=test-token-demo-only`,
          tempPassword: "TempReset987!",
          approvedByName: actor.name,
        });
        break;

      case "DEADLINE":
        result = await sendDeadlineAlertEmail({
          to: recipient,
          name: sampleName,
          scopeName: "Solar Park Phase II (Clean Energy BU)",
          dueDateLabel: "November 30, 2026",
          daysRemainingLabel: "3 Days Remaining",
          senderName: actor.name,
          customMessage: "This is a test notification verifying the ESG automated deadline alert system.",
          origin,
        });
        break;

      default:
        return fail(`Unknown template: ${template}`, 400);
    }

    return ok({
      template,
      recipient,
      sent: result.sent,
      transport: result.transport,
      messageId: result.id,
      previewUrl: result.previewUrl,
      note: result.reason,
    });
  });
}

