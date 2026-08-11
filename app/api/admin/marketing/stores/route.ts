import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { withMarketingSource } from '@/lib/marketing-source-db';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  const stores = await withMarketingSource(async (client) => (await client.query<{ id: string; name: string }>("SELECT code_shop::text id, name_shop name FROM pos.shops WHERE COALESCE(sign_activity, 1) <> 0 ORDER BY name_shop")).rows);
  return NextResponse.json({ ok: true, stores });
}
