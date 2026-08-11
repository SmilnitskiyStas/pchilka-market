import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getRfmSegmentCustomers } from '@/lib/marketing-rfm';
export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ segmentId: string }> }) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { const { segmentId } = await params; return NextResponse.json({ ok:true, customers: await getRfmSegmentCustomers(Number(request.nextUrl.searchParams.get('days') ?? 180), segmentId) }); } catch (e) { return NextResponse.json({ ok:false,error:e instanceof Error?e.message:'Помилка' },{status:500}); } }
