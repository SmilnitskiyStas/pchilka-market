import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { ruleAnalytics } from '@/lib/loyalty-rule-analytics';
export const runtime='nodejs';
export async function GET(req:Request){if(!isAdminRequestAuthorized(req))return unauthorizedAdminResponse(); const u=new URL(req.url),rule=Number(u.searchParams.get('rule')||836); if(!Number.isInteger(rule)||rule<1)return NextResponse.json({ok:false,error:'Некоректне правило.'},{status:400}); try{return NextResponse.json({ok:true,data:await ruleAnalytics(rule,u.searchParams.get('from'),u.searchParams.get('to'),u.searchParams.get('store'))})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'DB error'},{status:500})}}
