/* Integration checks use isolated temporary uploads and real route/auth handlers. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-cooperation-check-'));
process.env.UPLOADS_DIR = temporary;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args);
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename);
}


async function main() {
  const { NextResponse }=require('next/server');
  const auth=require('../lib/admin-auth.ts');
  const permissions=require('../lib/admin-permissions.ts');
  const model=require('../lib/offer-product-settings.ts');
  const repo=require('../lib/offer-product-repository.ts');
  const api=require('../app/api/admin/cooperation/offer-product/route.ts');
  const page=require('../app/cooperation/offer-product/page.tsx');
  const { renderToStaticMarkup }=require('react-dom/server');
  function cookie(role,permissions=[]) {
    const response=NextResponse.json({});
    auth.applyAdminSessionCookie(response,{username:'cooperation-test',sub:'test:cooperation',role,permissions});
    return response.headers.get('set-cookie').split(';')[0];
  }
  const admin=cookie('admin');
  function req(method,settings,session=admin) {return new Request('http://localhost/api/admin/cooperation/offer-product',{
    method,headers:{'Content-Type':'application/json',...(session?{cookie:session}:{})},...(settings?{body:JSON.stringify({settings})}:{})
  });}
  assert.equal(permissions.resourceForAdminPath('/admin/cooperation/offer-product'),'content');
  assert.equal(permissions.resourceForAdminPath('/api/admin/cooperation/offer-product'),'content');
  assert.equal((await api.GET(req('GET',null,''))).status,401);
  assert.equal((await api.GET(req('GET',null,cookie('editor',['content:read'])))).status,200);
  const defaults=await repo.getOfferProductSettings();
  assert.deepEqual(defaults,model.defaultOfferProductSettings);
  assert.equal(fs.existsSync(path.join(temporary,'cooperation','offer-product.json')),false);
  assert.equal(model.offerProductCategories(defaults).length,14);
  assert.ok(!model.offerProductCategories(defaults).some(item=>item.recipientEmail==='sb.pchelka@gmail.com'));
  assert.equal((await api.PUT(req('PUT',defaults,cookie('editor',['content:read'])))).status,401);
  const changed=structuredClone(defaults);
  changed.title='Нова пропозиція';
  changed.intro='Текст зі збережених налаштувань';
  changed.showForm=false;
  changed.departments[0].contacts[0].name='Новий менеджер';
  changed.departments[0].contacts[0].email='new@example.com';
  changed.departments[0].contacts.push({id:'new',title:'Новий напрям',name:'Менеджер',email:'extra@example.com',includeInForm:true});
  changed.departments.reverse();
  assert.equal((await api.PUT(req('PUT',changed,cookie('editor',['content:write'])))).status,200);
  assert.deepEqual(await repo.getOfferProductSettings(),changed);
  assert.equal(model.offerProductCategories(changed).find(item=>item.label==='Імпорт менеджер').recipientEmail,'new@example.com');
  assert.equal(model.offerProductCategories(changed).length,15);
  const html=renderToStaticMarkup(await page.default());
  assert.ok(html.includes('Нова пропозиція') && html.includes('Новий менеджер') && html.includes('mailto:new@example.com'));
  assert.ok(html.includes('/img/cooperation/security.png'));
  assert.ok(!html.includes('<form') && !html.includes('не знайдено'));
  assert.equal((await page.generateMetadata()).title,'Нова пропозиція | Pchilka Market');
  const invalid=structuredClone(changed);invalid.departments[0].imageUrl='javascript:alert(1)';
  assert.equal((await api.PUT(req('PUT',invalid))).status,400);
  invalid.departments[0].imageUrl='//example.com/x.png';
  assert.equal((await api.PUT(req('PUT',invalid))).status,400);
  invalid.departments[0].imageUrl='https://example.com/x.png';invalid.departments[0].contacts[0].email='invalid';
  assert.equal((await api.PUT(req('PUT',invalid))).status,400);
  assert.deepEqual(await repo.getOfferProductSettings(),changed);
  const duplicates=structuredClone(defaults);duplicates.departments[0].contacts[1].title=duplicates.departments[0].contacts[0].title;
  assert.throws(()=>model.normalizeOfferProductSettings(duplicates),/унікальними/);
  duplicates.departments[0].contacts[1].includeInForm=false;
  assert.doesNotThrow(()=>model.normalizeOfferProductSettings(duplicates));
  changed.departments=changed.departments.filter(item=>item.id!=='supply');
  await repo.saveOfferProductSettings(changed);
  assert.ok(!(await repo.getOfferProductSettings()).departments.some(item=>item.id==='supply'));
  await Promise.all([repo.saveOfferProductSettings(defaults),repo.saveOfferProductSettings(changed)]);
  assert.deepEqual(await repo.getOfferProductSettings(),changed);
  assert.deepEqual(fs.readdirSync(path.join(temporary,'cooperation')),['offer-product.json']);
  for(const file of ['public/img/cooperation/supply.png','public/img/cooperation/production.png','public/img/cooperation/security.png','public/fonts/appetite.otf','public/fonts/source-sans-pro-regular.ttf','public/fonts/source-sans-pro-bold.ttf']) assert.ok(fs.statSync(path.join(root,file)).size>0);
  console.log('PASS: default contacts and assets; authorized settings round trip; read-only denial; add/remove/reorder contacts and departments; email and URL validation; form recipient mapping; public page and metadata; atomic concurrent saves.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
 const resolved=path.resolve(temporary);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('pchilka-cooperation-check-'));fs.rmSync(resolved,{recursive:true,force:true});
});
