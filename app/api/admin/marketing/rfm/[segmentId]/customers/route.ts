import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmSegmentCustomersWithProfiles } from '@/lib/marketing-rfm';
export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string }> }) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { const { segmentId } = await params; const rawStoreId = request.nextUrl.searchParams.get('storeId'); const storeId = rawStoreId ? Number(rawStoreId) : undefined; return NextResponse.json({ ok:true, customers: await getRfmSegmentCustomersWithProfiles(Number(request.nextUrl.searchParams.get('days') ?? 180), segmentId, Number.isInteger(storeId) ? storeId : undefined) }); } catch (e) { return NextResponse.json({ ok:false,error:e instanceof Error?e.message:'Помилка' },{status:500}); } }
