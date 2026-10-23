import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ingestRuleDiscountLines, type RuleDiscountLine } from '@/lib/loyalty-rule-analytics';
export const runtime='nodejs';
export async function POST(req:Request){const expected=process.env.LOYALTY_RULE_ANALYTICS_SECRET?.trim()??'', given=req.headers.get('x-loyalty-rule-analytics-secret')?.trim()??''; if(!expected||expected.length!==given.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(given)))return NextResponse.json({ok:false},{status:401}); const body=await req.json().catch(()=>null) as {rows?:RuleDiscountLine[]}|null; if(!Array.isArray(body?.rows)||body.rows.length>2000)return NextResponse.json({ok:false},{status:400}); try{return NextResponse.json({ok:true,stored:await ingestRuleDiscountLines(body.rows)})}catch{return NextResponse.json({ok:false},{status:500})}}
