// Temporary upload storage and mocked banner/store queries; no live database or network writes.
const fs=require('fs'), path=require('path'), os=require('os'), assert=require('node:assert/strict'), Module=require('module'), ts=require('typescript');
const root=path.resolve(__dirname,'..'), temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pchilka-loyalty-'));
process.env.UPLOADS_DIR=temporary;
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
async function main(){
  require('next/cache').revalidatePath=()=>{};
  const model=require('../lib/home-loyalty-image-settings.ts'), repo=require('../lib/home-loyalty-image-repository.ts');
  const api=require('../app/api/admin/home-slides/loyalty-image/route.ts');
  const auth=require('../lib/admin-auth.ts'), {NextResponse}=require('next/server');
  function cookie(permissions){const response=NextResponse.json({});auth.applyAdminSessionCookie(response,{username:'test',sub:'test:loyalty-image',role:'editor',permissions});return response.headers.get('set-cookie').split(';')[0];}
  const writer=cookie(['banners:write']),reader=cookie(['banners:read']);
  const req=(method,settings,session=writer)=>new Request('http://localhost/api/admin/home-slides/loyalty-image',{method,headers:{'Content-Type':'application/json',...(session?{cookie:session}:{})},...(method==='PUT'?{body:JSON.stringify({settings})}:{})});
  assert.deepEqual(await repo.readHomeLoyaltyImage(),model.defaultHomeLoyaltyImage);
  assert.equal((await api.GET(req('GET',null,''))).status,401);
  assert.equal((await api.GET(req('GET',null,cookie(['content:read'])))).status,401);
  assert.equal((await api.GET(req('GET',null,reader))).status,200);
  assert.equal((await api.PUT(req('PUT',{src:'/media/new.png',alt:'New'},reader))).status,401);
  for(const settings of [null,{}, {src:'javascript:alert(1)',alt:'Bad'},{src:'//evil.test/p.png',alt:'Bad'},{src:'/media/new.png',alt:''}])assert.equal((await api.PUT(req('PUT',settings))).status,400);
  const settings={src:'/media/home/loyalty/new.png',alt:'Нове зображення'};
  assert.equal((await api.PUT(req('PUT',settings))).status,200);
  assert.deepEqual(await repo.readHomeLoyaltyImage(),settings);
  assert.deepEqual((await(await api.GET(req('GET',null,reader))).json()).settings,settings);
  require('../lib/banners-repository.ts').listBannersFromDb=async()=>[];
  require('../lib/stores-repository.ts').listStoresFromDb=async()=>[];
  const home=require('../app/page.tsx').default,render=require('react-dom/server').renderToStaticMarkup;
  let html=render(await home());
  const start=html.indexOf('class="home-app-presentation"'), end=html.indexOf('</a>',start), block=html.slice(start,end);
  assert.ok(block.includes(settings.src)&&block.includes(settings.alt)&&block.includes('<img'));
  assert.ok(!block.includes('home-app-copy')&&!block.includes('home-phone'));
  await Promise.all([repo.saveHomeLoyaltyImage(settings),repo.saveHomeLoyaltyImage(model.defaultHomeLoyaltyImage)]);
  assert.deepEqual(await repo.readHomeLoyaltyImage(),model.defaultHomeLoyaltyImage);
  const file=path.join(temporary,'home','loyalty-image.json');
  assert.deepEqual(fs.readdirSync(path.dirname(file)),['loyalty-image.json']);
  fs.writeFileSync(file,'{invalid');
  assert.equal((await api.GET(req('GET'))).status,500);
  html=render(await home());assert.ok(html.includes(model.defaultHomeLoyaltyImage.src),'Corrupt settings keep default image on public home');
  const png=fs.readFileSync(path.join(root,'public/img/loyalty/mobile-app-home.png'));
  assert.equal(png.readUInt32BE(16),1440);assert.equal(png.readUInt32BE(20),600);assert.equal(png[25],6,'Original PNG retains alpha channel');
  console.log('PASS: default PNG and transparency; API permissions/validation; atomic persistence; selected image on public home; safe default after load failure.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));
