import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { startVideoOptimization, getVideoOptimizationJob, listVideoOptimizationJobs } from '@/lib/video-optimization';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const id = new URL(request.url).searchParams.get('id');
    return NextResponse.json(id ? { ok: true, job: await getVideoOptimizationJob(id) } : { ok: true, jobs: await listVideoOptimizationJobs() });
  } catch { return NextResponse.json({ ok: false, error: 'Завдання оптимізації не знайдено.' }, { status: 404 }); }
}
export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as { path?: string; keepOriginal?: boolean };
    const keepOriginal = body.keepOriginal !== false;
    if (!keepOriginal && !isAdminRequestAuthorized(new Request(request.url, { method: 'DELETE', headers: request.headers }))) return unauthorizedAdminResponse();
    return NextResponse.json({ ok: true, job: await startVideoOptimization(String(body.path ?? ''), keepOriginal) }, { status: 202 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося запустити оптимізацію.' }, { status: 400 }); }
}
