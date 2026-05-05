import { NextResponse } from "next/server";

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization")?.trim();
  if (!auth) {
    return false;
  }
  return auth === secret || auth === `Bearer ${secret}`;
}

export function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    type: "weekly",
    message: "Weekly refresh endpoint is working",
  });
}
