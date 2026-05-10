import { NextRequest, NextResponse } from "next/server";
import { getPipelineHealthPayload } from "@/lib/debug/getPipelineHealth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function allowPreviewAccess(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.VERCEL_ENV === "preview") return true;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const isPreviewHost = host.endsWith(".vercel.app") && host.includes("-git-");
  if (isPreviewHost) return true;
  const expected = process.env.ADMIN_PREVIEW_SECRET;
  if (!expected) return false;
  const received = req.headers.get("x-admin-preview") ?? "";
  return received === expected;
}

export async function GET(req: NextRequest) {
  const nowIso = new Date().toISOString();
  if (!allowPreviewAccess(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await getPipelineHealthPayload();
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        generatedAt: nowIso,
        overallStatus: "red",
        error: msg,
      },
      { status: 500 },
    );
  }
}
