import HomeGate, { type Gate } from "@/components/home-gate";
import { getSessionPayload } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const val = params[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const pEnter = first("enter");
  const pPortal = first("portal");
  const pDashboard = first("dashboard");
  const pLinkGoogle = first("linkGoogle") === "1";
  const pResetToken = first("resetToken") ?? null;

  const initialGate: Gate = pResetToken
    ? "landing"
    : pDashboard === "1"
      ? "workspace"
      : pPortal === "project"
        ? "project-portal"
        : pEnter === "1" || pEnter === "true" || pPortal === "enter" || pLinkGoogle
          ? "enter"
          : "landing";

  const initialSession =
    initialGate !== "landing"
      ? ((await getSessionPayload()) ?? { authenticated: false })
      : null;

  return (
    <HomeGate
      initialGate={initialGate}
      initialSession={initialSession}
      initialResetToken={pResetToken}
      initialLinkGoogle={pLinkGoogle}
    />
  );
}
