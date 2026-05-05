/**
 * Cron routes: set `CRON_SECRET` in the environment. Vercel may send
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export function verifyCronRequest(request: Request): boolean {
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
