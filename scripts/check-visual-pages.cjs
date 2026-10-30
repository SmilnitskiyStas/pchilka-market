// Real repository SQL, API authorization and page rendering; all storage is in memory.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args);
};
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText, filename);

async function main() {
  const data = new Map();
  const fakePool = { query: async (sql, args) => {
    if (sql.startsWith('SELECT') && sql.includes('LEFT(setting_key')) return [[...data].filter(([key]) => key.startsWith(args[1])).map(([, value]) => ({setting_value:value}))];
    if (sql.startsWith('SELECT')) return [data.has(args[0]) ? [{setting_value:data.get(args[0])}] : []];
    if (sql.startsWith('INSERT')) {
      if (data.has(args[0])) throw Object.assign(new Error('Duplicate'), {code:'ER_DUP_ENTRY'});
      data.set(args[0], args[1]); return [{affectedRows:1}];
    }
    if (sql.startsWith('UPDATE')) {
      const [value, key, revision] = args;
      if (JSON.parse(data.get(key) || '{}').revision !== revision) return [{affectedRows:0}];
      data.set(key, value); return [{affectedRows:1}];
    }
    throw new Error('Unexpected query');
  }};
  fakePool.getConnection = async () => { let backup; return { query:fakePool.query, beginTransaction:async()=>{backup=new Map(data);},commit:async()=>{},rollback:async()=>{data.clear();for(const [key,value] of backup)data.set(key,value);},release:()=>{} }; };
  require('../lib/db.ts').getDbPool = () => fakePool;
  const { NextResponse } = require('next/server');
  const auth = require('../lib/admin-auth.ts');
  function cookieFor(role, permissions) {
    const response = NextResponse.json({});
    auth.applyAdminSessionCookie(response, {username:'page-test',sub:'test:pages',role,permissions});
    return response.headers.get('set-cookie').split(';')[0];
  }
  const cookie = cookieFor('editor', ['content:write']);
  const reader = cookieFor('editor', ['content:read']);
  const unrelated = cookieFor('editor', ['media:write']);
  const api = require('../app/api/admin/pages/route.ts');
  const repo = require('../lib/visual-pages-repository.ts');
  const model = require('../lib/visual-pages.ts');
  const extraBlocks = [
    {id:'cols',type:'columns',left:'**Ліва**',right:'_Права_'},
    {id:'hero',type:'banner',title:'Банер',text:'Опис',src:'/img/logo.png',label:'Далі',href:'/cooperation/rental'},
    {id:'film',type:'video',src:'/media/demo.mp4',title:'Наше відео'},
    {id:'form',type:'form',form:'rental'}
  ];
  const extended = {slug:'blocks-test',title:'Блоки',description:'',blocks:extraBlocks};
  assert.deepEqual(model.validateVisualPage(extended,true).blocks,extraBlocks);
  assert.deepEqual(model.validateVisualPage({...extended,slug:'rental-intro'},true).blocks,extraBlocks);
  assert.throws(()=>model.validateVisualPage({...extended,blocks:[extraBlocks[3],{...extraBlocks[3],id:'second-form'}]},true));
  assert.throws(()=>model.validateVisualPage({...extended,blocks:[{...extraBlocks[2],src:'javascript:alert(1)'}]},true));
  assert.throws(()=>model.validateVisualPage({...extended,blocks:[{...extraBlocks[1],href:'',label:'Далі'}]},true));
  assert.deepEqual(model.reorderVisualBlocks(extraBlocks,'cols','film').map(block=>block.id),['hero','film','cols','form']);
  assert.deepEqual(extraBlocks.map(block=>block.id),['cols','hero','film','form']);
  const request = (method, body, session = cookie) => new Request('http://localhost/api/admin/pages', {
    method, headers:{'Content-Type':'application/json', ...(session ? {cookie:session} : {})}, ...(body ? {body:JSON.stringify(body)} : {})
  });
  const draft = {slug:'test-page',title:'Публічна назва',description:'Публічний опис',blocks:[
    {id:'text',type:'text',text:'Публічний текст'},
    {id:'heading',type:'heading',text:'Умови'},
    {id:'image',type:'image',src:'/img/logo.png',alt:'Пчілка'},
    {id:'button',type:'button',label:'Оренда',href:'/cooperation/rental'}
  ]};
  const post = (page, revision, action = 'save', session = cookie) => api.POST(request('POST', {page,revision,action},session));
  assert.equal((await post(extended,0,'publish')).status,200);
  assert.deepEqual((await repo.getVisualPage('blocks-test')).published.blocks,extraBlocks);
  assert.equal((await post({...extended,blocks:[{...extraBlocks[0],right:''}]},1,'publish')).status,400);
  assert.equal((await post({...extended,blocks:[{...extraBlocks[1],src:'javascript:alert(1)'}]},1)).status,400);
  assert.equal((await api.GET(request('GET',null,''))).status,401);
  assert.equal((await api.GET(request('GET',null,unrelated))).status,401);
  assert.equal((await post(draft,0,'save',reader)).status,401);
  assert.equal((await post(draft,0)).status,200);
  assert.equal((await repo.getVisualPage(draft.slug)).published,null);
  assert.equal((await post(draft,0)).status,409);
  assert.equal((await api.GET(request('GET',null,reader))).status,200);

  let currentToken;
  const headersPath = require.resolve('next/headers');
  require(headersPath);
  require.cache[headersPath].exports = { cookies: async () => ({get:() => currentToken ? {value:currentToken} : undefined}) };
  const screen = require('../app/pages/[slug]/page.tsx');
  const props = preview => ({params:Promise.resolve({slug:draft.slug}),searchParams:Promise.resolve(preview ? {preview:'1'} : {})});
  const {renderToStaticMarkup} = require('react-dom/server');
  const Body = require('../components/visual-page-body.tsx').default;
  const youtube = require('../lib/youtube-video.ts');
  const videoId = 'HNGyDiMRKS4';
  const youtubeLinks = [
    `https://www.youtube.com/watch?v=${videoId}&si=share`,
    `https://youtu.be/${videoId}?si=share`,
    `https://m.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/shorts/${videoId}`,
    `https://www.youtube.com/live/${videoId}`,
    `https://www.youtube.com/embed/${videoId}?autoplay=1`,
    `https://www.youtube-nocookie.com/embed/${videoId}`
  ];
  const withVideo = (src) => ({slug:'youtube-test',title:'YouTube',description:'',blocks:[{id:'video',type:'video',src,title:'Наше відео'}]});
  for (const src of youtubeLinks) {
    assert.equal(youtube.getYouTubeEmbedUrl(src),`https://www.youtube.com/embed/${videoId}`);
    const page = model.validateVisualPage(withVideo(`  ${src}  `),true);
    assert.equal(page.blocks[0].src,src);
    for (const editing of [true,false]) {
      const html = renderToStaticMarkup(require('react').createElement(Body,{page,editing}));
      assert.ok(html.includes('<iframe') && html.includes(`/embed/${videoId}`) && html.includes('Наше відео'));
      assert.ok(!html.includes('<video') && !html.includes('autoplay=1') && !html.includes('si=share'));
    }
  }
  for (const src of ['https://youtube.com/playlist?list=test','https://youtu.be/short','https://youtube.com/watch?v=bad','https://youtube.com/embed/HNGyDiMRKS4/extra']) {
    assert.equal(youtube.getYouTubeEmbedUrl(src),null);
    assert.throws(()=>model.validateVisualPage(withVideo(src),true),/YouTube/);
  }
  for (const src of ['https://youtube.com.evil.test/watch?v=HNGyDiMRKS4','https://user:pass@youtube.com/watch?v=HNGyDiMRKS4','javascript:alert(1)','https://youtube.com:444/watch?v=HNGyDiMRKS4']) {
    assert.equal(youtube.getYouTubeEmbedUrl(src),null);
    assert.ok(!renderToStaticMarkup(require('react').createElement(Body,{page:withVideo(src)})).includes('<iframe'));
  }
  for (const src of ['/media/demo.mp4','/media/demo.webm','https://example.com/demo.mp4']) {
    const html = renderToStaticMarkup(require('react').createElement(Body,{page:model.validateVisualPage(withVideo(src),true)}));
    assert.ok(html.includes('<video') && !html.includes('<iframe'));
  }
  const ytSaved = await repo.saveVisualPage(withVideo(youtubeLinks[0]),0,'publish');
  assert.equal((await repo.getVisualPage('youtube-test')).published.blocks[0].src,youtubeLinks[0]);
  assert.equal(ytSaved.published.blocks[0].type,'video');
  console.log('PASS: YouTube watch/share/Shorts/live/embed, safe iframe rendering in preview and public pages, published persistence, invalid URLs and MP4/WebM compatibility.');
  const extendedHtml = renderToStaticMarkup(require('react').createElement(Body,{page:extended,editing:true}));
  assert.ok(extendedHtml.includes('<strong>Ліва</strong>') && extendedHtml.includes('<em>Права</em>'));
  assert.ok(extendedHtml.includes('<video') && extendedHtml.includes('visual-page-columns') && !extendedHtml.includes('<form'));
  const publicBlocksHtml = renderToStaticMarkup(require('react').createElement(Body,{page:extended}));
  assert.equal((publicBlocksHtml.match(/<form/g)||[]).length,1);
  const Fields = require('../components/admin/visual-block-fields.tsx').default;
  for (const block of extraBlocks) {
    assert.ok(renderToStaticMarkup(require('react').createElement(Fields,{block,onChange:()=>{},onBusy:()=>{}})).length > 0);
  }
  const unsafeText = {...extended,blocks:[{id:'unsafe',type:'text',text:'[Bad](javascript:alert(1)) <script>alert(1)</script>'}]};
  const safeHtml = renderToStaticMarkup(require('react').createElement(Body,{page:unsafeText}));
  assert.ok(!safeHtml.includes('href="javascript:') && !safeHtml.includes('<script>'));
  await assert.rejects(screen.default(props(false)), /404/);
  await assert.rejects(screen.default(props(true)), /404/);
  currentToken = cookie.slice(cookie.indexOf('=')+1);
  const previewHtml = renderToStaticMarkup(await screen.default(props(true)));
  assert.ok(previewHtml.includes('Публічний текст') && previewHtml.includes('Редагувати сторінку'));
  const privateDraft = {...draft,title:'Секретна чернетка',description:'Секретний опис',blocks:[{id:'new',type:'text',text:'Неопубліковані зміни'}]};
  assert.equal((await post(draft,1,'publish')).status,200);
  assert.equal((await post(privateDraft,2)).status,200);
  currentToken = undefined;
  const html = renderToStaticMarkup(await screen.default(props(false)));
  assert.ok(html.includes('Публічний текст') && html.includes('/cooperation/rental') && html.includes('/img/logo.png'));
  assert.ok(!html.includes('Неопубліковані зміни') && !html.includes('Редагувати сторінку'));
  const metadata = await screen.generateMetadata(props(true));
  assert.ok(!JSON.stringify(metadata).includes('Секрет'));
  assert.equal(metadata.robots.index,false);
  await assert.rejects(screen.default(props(true)), /404/);
  assert.equal((await post({...draft,blocks:[]},3,'publish')).status,400);
  assert.equal((await post({...draft,blocks:[{id:'bad',type:'button',label:'Bad',href:'javascript:alert(1)'}]},3)).status,400);
  assert.equal((await post({...draft,blocks:[draft.blocks[0],draft.blocks[0]]},3)).status,400);
  assert.equal((await post({...draft,slug:'../admin'},0)).status,400);
  for (const url of ['//example.com','javascript:alert(1)','data:text/html,test','https://user:password@example.com','/\\example.com']) assert.equal(model.isSafePageUrl(url),false);
  const races = await Promise.all([post(privateDraft,3),post(privateDraft,3)]);
  assert.deepEqual(races.map(item=>item.status).sort(),[200,409]);
  assert.equal((await post({...draft,slug:'never-public',title:'Прихована сторінка'},0)).status,200);
  require('../lib/promotion-catalog-pages.ts').getPromotionCatalogPages = async () => [];
  require('../lib/seo-rules-repository.ts').getSeoRulesFromDb = async () => [
    {path:'/pages/never-public',includeInSitemap:true,robots:'index,follow'},
    {path:'/pages/test-page',includeInSitemap:true,robots:'index,follow'}
  ];
  const sitemap = require('../app/sitemap.ts').default;
  let paths = (await sitemap()).map(item => new URL(item.url).pathname);
  assert.ok(paths.includes('/pages/test-page') && !paths.includes('/pages/never-public'));
  const publicMenu = require('../lib/public-menu.ts');
  assert.ok((await publicMenu.getPopulatedMenuPaths()).populatedPaths.includes('/pages/test-page'));
  assert.equal((await post(privateDraft,4,'unpublish')).status,200);
  await assert.rejects(screen.default(props(false)), /404/);
  paths = (await sitemap()).map(item => new URL(item.url).pathname);
  assert.ok(!paths.includes('/pages/test-page') && !paths.includes('/pages/never-public'));
  assert.ok(!(await publicMenu.getPopulatedMenuPaths()).populatedPaths.includes('/pages/test-page'));
  currentToken = reader.slice(reader.indexOf('=')+1);
  assert.ok(renderToStaticMarkup(await screen.default(props(true))).includes('Неопубліковані зміни'));
  const management = (body, session=cookie) => api.PUT(request('PUT',body,session));
  assert.equal((await management({action:'restore',slug:'blocks-test',revision:1,restoreRevision:1},reader)).status,401);
  const changed = {...extended,title:'Нова чернетка',seo:{title:'SEO чернетки',image:'/img/share.png',noIndex:true}};
  assert.equal((await post(changed,1)).status,200);
  assert.equal((await management({action:'restore',slug:'blocks-test',revision:2,restoreRevision:1})).status,200);
  let restored = await repo.getVisualPage('blocks-test');
  assert.equal(restored.draft.title,'Блоки');
  assert.equal(restored.published.title,'Блоки');
  assert.equal(restored.history.length,2);
  assert.equal((await management({action:'rename',slug:'blocks-test',revision:3,newSlug:'renamed-blocks'})).status,200);
  const renamed = await repo.getVisualPage('blocks-test');
  assert.equal(renamed.draft.slug,'renamed-blocks');
  assert.equal(renamed.published.slug,'renamed-blocks');
  assert.ok(!(await repo.listVisualPages()).some(item=>item.draft.slug==='blocks-test'));
  const aliasProps={params:Promise.resolve({slug:'blocks-test'}),searchParams:Promise.resolve({})};
  await assert.rejects(screen.default(aliasProps),error=>error.digest?.includes('/pages/renamed-blocks') && error.digest.includes('308'));
  assert.equal((await post({...extended,slug:'blocks-test'},0)).status,409);
  assert.equal((await management({action:'rename',slug:'renamed-blocks',revision:4,newSlug:'never-public'})).status,409);
  assert.equal((await repo.getVisualPage('renamed-blocks')).revision,4);
  assert.equal((await management({action:'rename',slug:'renamed-blocks',revision:3,newSlug:'stale'})).status,409);
  assert.equal(await repo.getVisualPage('stale'),null);
  assert.equal((await management({action:'rename',slug:'rental-intro',revision:1,newSlug:'other'})).status,400);
  assert.equal((await management({action:'restore',slug:'renamed-blocks',revision:4,restoreRevision:1})).status,200);
  assert.equal((await repo.getVisualPage('renamed-blocks')).draft.slug,'renamed-blocks');
  const privateSeo={...changed,slug:'renamed-blocks'};
  assert.equal((await post(privateSeo,5,'publish')).status,200);
  const seoProps={params:Promise.resolve({slug:'renamed-blocks'}),searchParams:Promise.resolve({})};
  const seoMetadata=await screen.generateMetadata(seoProps);
  assert.equal(seoMetadata.title,'SEO чернетки');
  assert.equal(seoMetadata.robots.index,false);
  assert.equal(seoMetadata.alternates.canonical,'/pages/renamed-blocks');
  assert.ok(!(await sitemap()).some(item=>item.url.endsWith('/pages/renamed-blocks')));
  const templates=require('../lib/visual-page-templates.ts');
  for(const template of templates.visualPageTemplates) model.validateVisualPage({...extended,blocks:template.blocks},true);
  let sequence=0;
  const duplicate=templates.copyVisualPage(changed,()=>`copy-${++sequence}`);
  assert.equal(duplicate.slug,'');
  assert.notEqual(duplicate.blocks[0].id,changed.blocks[0].id);
  duplicate.blocks[0].left='Незалежна копія';
  assert.equal(changed.blocks[0].left,'**Ліва**');
  let capped=await repo.getVisualPage('renamed-blocks');
  for(let index=0;index<22;index++) capped=await repo.saveVisualPage(capped.draft,capped.revision,'save');
  assert.equal(capped.history.length,20);
  assert.ok(capped.history.every(item=>!('history' in item)));
  console.log('PASS: bounded revision history; restore as draft; atomic rename and rollback; aliases and canonical redirects; duplicate isolation; templates; published SEO and noindex sitemap filtering.');
  console.log('PASS: API and permissions; draft/published isolation and preview authorization; public rendering and safe URLs; metadata privacy; duplicate and concurrent-save conflicts; only published pages enter sitemap/menu; unpublish retains draft.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
