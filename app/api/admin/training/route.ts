import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { createTrainingCategory, createTrainingTest, listTrainingAdminData, type TrainingTestInput } from '@/lib/training-tests-repository';

export const runtime = 'nodejs';
export async function GET(request: Request) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { return NextResponse.json({ ok:true, ...(await listTrainingAdminData()) }); } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Помилка.'},{status:500}); } }
export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { const body=await request.json() as { action?:string; category?:{title?:string;description?:string}; test?:TrainingTestInput };
    if(body.action==='category') { if(!body.category?.title?.trim()) throw new Error('Вкажіть назву категорії.'); return NextResponse.json({ok:true,id:await createTrainingCategory({title:body.category.title,description:body.category.description})}); }
    if(body.action==='test' && body.test) return NextResponse.json({ok:true,id:await createTrainingTest(body.test)});
    return NextResponse.json({ok:false,error:'Невідома дія.'},{status:400});
  } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Помилка.'},{status:400}); }
}
