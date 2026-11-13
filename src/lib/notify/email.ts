import nodemailer from "nodemailer";

export interface EmailSendResult {
  sent: boolean;
  skipped?: boolean;
  id?: string;
  reason?: string;
  previewUrl?: string;
  transport?: "SMTP";
}

let cachedSmtp: nodemailer.Transporter | null | undefined;
let currentSmtpKey = "";

export function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = process.env.SMTP_PORT?.trim() || "587";
  if (!host && !user) {
    cachedSmtp = null;
    currentSmtpKey = "";
    return null;
  }
  const key = `${host}:${port}:${user}:${pass}`;
  if (cachedSmtp && currentSmtpKey === key) return cachedSmtp;

  currentSmtpKey = key;
  cachedSmtp = nodemailer.createTransport({
    host: host || "smtp.gmail.com",
    port: Number(port) || 587,
    secure: process.env.SMTP_SECURE === "true" || Number(port) === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedSmtp;
}

export async function verifySmtp(): Promise<{
  connected: boolean;
  host?: string;
  user?: string;
  error?: string;
}> {
  const smtp = getSmtpTransporter();
  if (!smtp) {
    return {
      connected: false,
      error: "SMTP is not configured in .env (missing SMTP_HOST / SMTP_USER)",
    };
  }
  try {
    await smtp.verify();
    return {
      connected: true,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      user: process.env.SMTP_USER,
    };
  } catch (err) {
    return {
      connected: false,
      host: process.env.SMTP_HOST,
      error: err instanceof Error ? err.message : "SMTP connection failed",
    };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() || process.env.SMTP_USER?.trim()
  );
}

export function getAppOrigin(fallbackOrigin?: string): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function fromAddress(): string {
  if (process.env.SMTP_FROM?.trim()) return process.env.SMTP_FROM.trim();
  if (process.env.SMTP_USER?.trim()) {
    return `MEIL ESG Platform <${process.env.SMTP_USER.trim()}>`;
  }
  return "MEIL ESG Platform <no-reply@meil.in>";
}

function escHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapLayout(title: string, badge: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#ffffff;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">${escHtml(badge)}</div>
          <div style="font-size:18px;font-weight:600;margin-top:4px;">${escHtml(title)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          MEIL ESG &amp; BRSR Governance Platform &bull; Automated security &amp; compliance notification
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { sent: false, skipped: true, reason: "No recipient addresses" };
  }

  const smtp = getSmtpTransporter();
  if (!smtp) {
    return {
      sent: false,
      skipped: true,
      reason: "SMTP service is not configured (missing SMTP_HOST/SMTP_USER in .env)",
    };
  }

  try {
    const info = await smtp.sendMail({
      from: fromAddress(),
      to: recipients,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    return {
      sent: true,
      id: info.messageId,
      previewUrl: typeof preview === "string" ? preview : undefined,
      transport: "SMTP",
    };
  } catch (smtpErr) {
    console.error("SMTP delivery failed:", smtpErr);
    return {
      sent: false,
      reason: smtpErr instanceof Error ? smtpErr.message : "SMTP delivery failed",
      transport: "SMTP",
    };
  }
}

export async function sendUserInviteEmail(opts: {
  to: string;
  name: string;
  roleLabel: string;
  employeeId?: string | null;
  tempPassword?: string | null;
  googleEmail?: string | null;
  orgScopeLabel: string;
  invitedByName: string;
  origin?: string;
}): Promise<EmailSendResult> {
  const appUrl = getAppOrigin(opts.origin);
  const loginUrl = `${appUrl}/?enter=1`;
  const credentialRows = [
    opts.employeeId ? `<li><strong>Employee / Handle ID:</strong> <code>${escHtml(opts.employeeId)}</code></li>` : "",
    `<li><strong>Assigned Email:</strong> ${escHtml(opts.to)}</li>`,
    opts.googleEmail
      ? `<li><strong>Google Sign-In Linked:</strong> ${escHtml(opts.googleEmail)} (Continue with Google enabled)</li>`
      : "",
    opts.tempPassword
      ? `<li><strong>One-Time Temporary Password:</strong> <code>${escHtml(opts.tempPassword)}</code> (you will be asked to change this upon sign-in)</li>`
      : `<li><strong>Sign-In Method:</strong> Use <em>Continue with Google</em> with your registered corporate email or request credentials from your admin.</li>`,
  ]
    .filter(Boolean)
    .join("");

  const html = wrapLayout(
    "Your MEIL ESG Account Is Ready",
    "Account Provisioned",
    `<p>Hello ${escHtml(opts.name)},</p>
     <p>${escHtml(opts.invitedByName)} has provisioned your access on the MEIL ESG &amp; BRSR Platform as <strong>${escHtml(opts.roleLabel)}</strong> (${escHtml(opts.orgScopeLabel)}).</p>
     <ul style="padding-left:20px;margin:16px 0;">${credentialRows}</ul>
     <p style="margin:24px 0;">
       <a href="${escHtml(loginUrl)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open MEIL ESG Platform</a>
     </p>`
  );

  const text = [
    `Hello ${opts.name},`,
    `${opts.invitedByName} has provisioned your MEIL ESG account (${opts.roleLabel} — ${opts.orgScopeLabel}).`,
    opts.employeeId ? `Handle ID: ${opts.employeeId}` : "",
    `Email: ${opts.to}`,
    opts.googleEmail ? `Google Sign-In: ${opts.googleEmail}` : "",
    opts.tempPassword ? `Temporary Password: ${opts.tempPassword} (change required on first login)` : "",
    `Sign in: ${loginUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: opts.to,
    subject: `Your MEIL ESG Platform account (${opts.roleLabel})`,
    html,
    text,
  });
}

export async function sendUserCreatedAdminAlertEmail(opts: {
  adminEmails: string[];
  creatorName: string;
  user: {
    name: string;
    email: string;
    employeeId?: string | null;
    googleEmail?: string | null;
    roleLabel: string;
    orgScopeLabel: string;
    authProvider: string;
  };
  origin?: string;
}): Promise<EmailSendResult> {
  const appUrl = getAppOrigin(opts.origin);
  const usersUrl = `${appUrl}/?dashboard=1&portal=group`;
  const html = wrapLayout(
    "New Account Provisioned — MEIL ESG",
    "Security & Access Audit",
    `<p>A new user account has been provisioned on the MEIL ESG &amp; BRSR Platform by <strong>${escHtml(opts.creatorName)}</strong>.</p>
     <table cellpadding="6" cellspacing="0" style="margin:16px 0;width:100%;border-collapse:collapse;font-size:13px;">
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;width:140px;">Full Name:</td><td><strong>${escHtml(opts.user.name)}</strong></td></tr>
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Account Email:</td><td>${escHtml(opts.user.email)}</td></tr>
       ${opts.user.employeeId ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Employee / Handle:</td><td><code>${escHtml(opts.user.employeeId)}</code></td></tr>` : ""}
       ${opts.user.googleEmail ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Google SSO:</td><td>${escHtml(opts.user.googleEmail)}</td></tr>` : ""}
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Assigned Role:</td><td><strong>${escHtml(opts.user.roleLabel)}</strong></td></tr>
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Organization Scope:</td><td>${escHtml(opts.user.orgScopeLabel)}</td></tr>
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Authentication:</td><td>${escHtml(opts.user.authProvider)}</td></tr>
     </table>
     <p style="margin:24px 0;">
       <a href="${escHtml(usersUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">View in All Users Directory</a>
     </p>`
  );

  const text = `New user provisioned by ${opts.creatorName}: ${opts.user.name} (${opts.user.email}, ${opts.user.roleLabel} — ${opts.user.orgScopeLabel}). View: ${usersUrl}`;

  return sendEmail({
    to: opts.adminEmails,
    subject: `[Audit] New account provisioned: ${opts.user.name} (${opts.user.roleLabel})`,
    html,
    text,
  });
}

export async function sendPasswordResetAdminAlertEmail(opts: {
  adminEmails: string[];
  requesterName: string;
  requesterEmail: string;
  requesterRoleLabel: string;
  employeeId?: string | null;
  portal: string;
  reason?: string;
  origin?: string;
}): Promise<EmailSendResult> {
  const appUrl = getAppOrigin(opts.origin);
  const reviewUrl = `${appUrl}/?dashboard=1`;
  const html = wrapLayout(
    "Password Reset Request Requires Review",
    "Security Approval Needed",
    `<p>A user has submitted a password recovery request on the MEIL ESG Platform:</p>
     <ul style="padding-left:20px;margin:16px 0;">
       <li><strong>User:</strong> ${escHtml(opts.requesterName)} (${escHtml(opts.requesterRoleLabel)})</li>
       <li><strong>Email / Handle:</strong> ${escHtml(opts.requesterEmail)}${opts.employeeId ? ` / <code>${escHtml(opts.employeeId)}</code>` : ""}</li>
       <li><strong>Portal:</strong> ${escHtml(opts.portal || "platform")}</li>
       ${opts.reason ? `<li><strong>Note:</strong> ${escHtml(opts.reason)}</li>` : ""}
     </ul>
     <p>Please review and approve or reject this request in your Admin User Management console.</p>
     <p style="margin:24px 0;">
       <a href="${escHtml(reviewUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Review Reset Queue</a>
     </p>`
  );

  const text = `Password reset request from ${opts.requesterName} (${opts.requesterEmail}, ${opts.requesterRoleLabel}). Review in admin console: ${reviewUrl}`;

  return sendEmail({
    to: opts.adminEmails,
    subject: `[Security] Password reset request: ${opts.requesterName}`,
    html,
    text,
  });
}

export async function sendPasswordResetLinkEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
  tempPassword?: string | null;
  approvedByName?: string | null;
}): Promise<EmailSendResult> {
  const html = wrapLayout(
    opts.approvedByName ? "Password Reset Approved" : "Reset Your Password",
    "Account Recovery",
    `<p>Hello ${escHtml(opts.name)},</p>
     <p>${
       opts.approvedByName
         ? `Your password reset request was approved by ${escHtml(opts.approvedByName)}.`
         : "We received a request to reset your MEIL ESG Platform password."
     }</p>
     ${
       opts.tempPassword
         ? `<p><strong>One-Time Temporary Password:</strong> <code>${escHtml(opts.tempPassword)}</code> (you must set a new password right after signing in)</p>`
         : ""
     }
     <p>You can set a new password directly using the secure 15-minute single-use link below:</p>
     <p style="margin:24px 0;">
       <a href="${escHtml(opts.resetUrl)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Set New Password</a>
     </p>
     <p style="font-size:12px;color:#64748b;">If you did not request this, contact your Group ESG Administrator immediately.</p>`
  );

  const text = [
    `Hello ${opts.name},`,
    opts.approvedByName
      ? `Your password reset was approved by ${opts.approvedByName}.`
      : "We received a password reset request for your MEIL ESG account.",
    opts.tempPassword ? `Temporary Password: ${opts.tempPassword}` : "",
    `Reset link (expires in 15 minutes): ${opts.resetUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: opts.to,
    subject: "MEIL ESG Platform — Password Recovery",
    html,
    text,
  });
}

export async function sendPasswordResetRejectedEmail(opts: {
  to: string;
  name: string;
  reason: string;
}): Promise<EmailSendResult> {
  const html = wrapLayout(
    "Password Reset Request Declined",
    "Security Notice",
    `<p>Hello ${escHtml(opts.name)},</p>
     <p>Your recent password reset request was declined by an administrator.</p>
     <p><strong>Reason:</strong> ${escHtml(opts.reason)}</p>
     <p>Please contact your Subsidiary or Group ESG Administrator if you need assistance.</p>`
  );
  const text = `Hello ${opts.name}, your password reset request was declined. Reason: ${opts.reason}`;
  return sendEmail({
    to: opts.to,
    subject: "MEIL ESG Platform — Password Reset Request Declined",
    html,
    text,
  });
}

export async function sendSubmissionReceivedEmail(opts: {
  to: string | string[];
  adminName: string;
  submitterName: string;
  submitterRole: string;
  projectName: string;
  periodLabel: string;
  levelsSubmitted: number;
  levelsTotal: number;
  packageRef?: string | null;
  origin?: string;
}): Promise<EmailSendResult> {
  const appUrl = getAppOrigin(opts.origin);
  const reviewUrl = `${appUrl}/?enter=1`;
  const html = wrapLayout(
    "New ESG Disclosure Package Awaiting Your Review",
    "Submission Alert",
    `<p>Hello ${escHtml(opts.adminName)},</p>
     <p><strong>${escHtml(opts.submitterName)}</strong> (${escHtml(opts.submitterRole)}) has submitted a complete site ESG disclosure package on the MEIL ESG &amp; BRSR Platform.</p>
     <table cellpadding="6" cellspacing="0" style="margin:16px 0;width:100%;border-collapse:collapse;font-size:13px;">
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;width:150px;">Project / Site:</td><td><strong>${escHtml(opts.projectName)}</strong></td></tr>
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Reporting Period:</td><td>${escHtml(opts.periodLabel)}</td></tr>
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Levels Submitted:</td><td><strong>${escHtml(String(opts.levelsSubmitted))} of ${escHtml(String(opts.levelsTotal))}</strong> BRSR disclosure levels</td></tr>
       ${opts.packageRef ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Package Reference:</td><td><code>${escHtml(opts.packageRef)}</code></td></tr>` : ""}
       <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;">Next Step:</td><td>Your review &amp; approval is required before the data consolidates upward.</td></tr>
     </table>
     <p style="margin:24px 0;">
       <a href="${escHtml(reviewUrl)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Review the Submission</a>
     </p>
     <p style="font-size:12px;color:#64748b;">This is an automated notification from the MEIL ESG Platform. You are receiving this because you are the Project Admin for this site.</p>`
  );

  const text = [
    `Hello ${opts.adminName},`,
    `${opts.submitterName} (${opts.submitterRole}) submitted the site ESG package for ${opts.projectName} — ${opts.periodLabel}.`,
    `Levels: ${opts.levelsSubmitted}/${opts.levelsTotal}${opts.packageRef ? `, Ref: ${opts.packageRef}` : ""}.`,
    `Review: ${reviewUrl}`,
  ].filter(Boolean).join("\n");

  return sendEmail({
    to: opts.to,
    subject: `[Action Needed] ESG package submitted — ${opts.projectName} (${opts.periodLabel})`,
    html,
    text,
  });
}

export async function sendDeadlineAlertEmail(opts: {
  to: string;
  name: string;
  scopeName: string;
  dueDateLabel: string;
  daysRemainingLabel: string;
  senderName: string;
  customMessage?: string;
  origin?: string;
}): Promise<EmailSendResult> {
  const appUrl = getAppOrigin(opts.origin);
  const portalUrl = `${appUrl}/?enter=1`;
  const html = wrapLayout(
    "ESG Reporting Deadline Reminder",
    opts.daysRemainingLabel,
    `<p>Hello ${escHtml(opts.name)},</p>
     <p>${escHtml(opts.customMessage || `This is an automated reminder regarding pending ESG disclosures for ${opts.scopeName}.`)}</p>
     <ul style="padding-left:20px;margin:16px 0;">
       <li><strong>Organization / Site:</strong> ${escHtml(opts.scopeName)}</li>
       <li><strong>Effective Due Date:</strong> ${escHtml(opts.dueDateLabel)}</li>
       <li><strong>Status:</strong> ${escHtml(opts.daysRemainingLabel)}</li>
       <li><strong>Issued By:</strong> ${escHtml(opts.senderName)}</li>
     </ul>
     <p style="margin:24px 0;">
       <a href="${escHtml(portalUrl)}" style="display:inline-block;padding:10px 18px;background:#b45309;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Submit ESG Data</a>
     </p>`
  );
  const text = `ESG Deadline Reminder (${opts.daysRemainingLabel}) for ${opts.scopeName}. Due: ${opts.dueDateLabel}. Open: ${portalUrl}`;
  return sendEmail({
    to: opts.to,
    subject: `[${opts.daysRemainingLabel}] ESG Reporting Due — ${opts.scopeName}`,
    html,
    text,
  });
}

