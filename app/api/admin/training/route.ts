import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { archiveTrainingTest, createTrainingCategory, createTrainingTest, deleteTrainingCategory, deleteTrainingTest, getTrainingTestForAdmin, getTrainingTestStatisticsForAdmin, listTrainingAdminData, restoreTrainingTest, setTrainingTestPublished, updateTrainingTest, type TrainingTestInput } from '@/lib/training-tests-repository';

export const runtime = 'nodejs';
export async function GET(request: Request) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { const url = new URL(request.url); const statisticsTestId=Number(url.searchParams.get('statisticsTestId')); if (Number.isInteger(statisticsTestId) && statisticsTestId > 0) return NextResponse.json({ ok:true, statistics:await getTrainingTestStatisticsForAdmin(statisticsTestId) }); const testId=Number(url.searchParams.get('testId')); if (Number.isInteger(testId) && testId > 0) return NextResponse.json({ ok:true, test:await getTrainingTestForAdmin(testId) }); return NextResponse.json({ ok:true, ...(await listTrainingAdminData()) }); } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Помилка.'},{status:500}); } }
export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { const body=await request.json() as { action?:string; category?:{title?:string;description?:string}; test?:TrainingTestInput };
    if(body.action==='category') { if(!body.category?.title?.trim()) throw new Error('Вкажіть назву категорії.'); return NextResponse.json({ok:true,id:await createTrainingCategory({title:body.category.title,description:body.category.description})}); }
    if(body.action==='test' && body.test) return NextResponse.json({ok:true,id:await createTrainingTest(body.test)});
    return NextResponse.json({ok:false,error:'Невідома дія.'},{status:400});
  } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Помилка.'},{status:400}); }
}
export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as { action?: string; testId?: number; categoryId?: number; isPublished?: boolean; test?: TrainingTestInput };
    if (body.action === 'delete-category') { const categoryId = Number(body.categoryId); if (!Number.isInteger(categoryId) || categoryId < 1) throw new Error('Некоректна категорія.'); await deleteTrainingCategory(categoryId); return NextResponse.json({ ok: true }); }
    const testId = Number(body.testId);
    if (!Number.isInteger(testId) || testId < 1) throw new Error('Некоректний тест.');
    if (body.action === 'update' && body.test) await updateTrainingTest(testId, body.test);
    else if (body.action === 'set-published') await setTrainingTestPublished(testId, Boolean(body.isPublished));
    else if (body.action === 'archive') await archiveTrainingTest(testId);
    else if (body.action === 'restore') await restoreTrainingTest(testId);
    else if (body.action === 'delete') await deleteTrainingTest(testId);
    else return NextResponse.json({ ok:false, error:'Невідома дія.' }, { status:400 });
    return NextResponse.json({ ok:true });
  } catch (error) { return NextResponse.json({ ok:false,error:error instanceof Error ? error.message : 'Помилка.' }, { status:400 }); }
}
