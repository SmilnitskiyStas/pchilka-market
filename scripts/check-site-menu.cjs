/* Integration checks use isolated temporary uploads and real route/auth handlers. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-menu-check-'));
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



async function main(){
 const model=require('../lib/site-menu.ts');
 const repo=require('../lib/site-menu-repository.ts');
 const contentRepo=require('../lib/blog-content-repository.ts');
 contentRepo.getBlogContentFromDb=async()=>({entries:[{contentType:'blog',pagePath:'/about/why-pchilka-not-bdzhilka',status:'published'}],categories:[]});
 const {filterContentMenu}=require('../lib/menu-content.ts');
 const auth=require('../lib/admin-auth.ts');const{NextResponse}=require('next/server');
 const permissions=require('../lib/admin-permissions.ts');
 const api=require('../app/api/admin/menu/route.ts');const publicApi=require('../app/api/site/menu/route.ts');
 function cookie(role,permissions=[]){const response=NextResponse.json({});auth.applyAdminSessionCookie(response,{username:'menu-test',sub:'test:menu',role,permissions});return response.headers.get('set-cookie').split(';')[0];}
 const admin=cookie('admin');
 function req(method,settings,session=admin){return new Request('http://localhost/api/admin/menu',{method,headers:{'Content-Type':'application/json',...(session?{cookie:session}:{})},...(settings?{body:JSON.stringify({settings})}:{})});}
 assert.equal(permissions.resourceForAdminPath('/admin/menu'),'content');assert.equal(permissions.resourceForAdminPath('/api/admin/menu'),'content');
 assert.equal((await api.GET(req('GET',null,''))).status,401);
 const defaults=await repo.getSiteMenuSettings();assert.deepEqual(defaults,model.defaultSiteMenu);
 assert.ok(!fs.existsSync(path.join(temporary,'navigation','menu.json')));
 const payload=await(await api.GET(req('GET',null,cookie('editor',['content:read'])))).json();assert.equal(payload.ok,true);assert.ok(payload.destinations.some(item=>item.href==='/promotions/catalog/f1'));
 assert.equal((await api.PUT(req('PUT',defaults,cookie('editor',['content:read'])))).status,401);
 const original=structuredClone(defaults.items);
 let moved=model.moveMenuItem(original,original[0].id,null,2);assert.equal(moved[2].id,original[0].id);assert.deepEqual(defaults.items,original);
 const child=original[1].children[0];moved=model.moveMenuItem(original,child.id,null,0);assert.equal(moved[0].id,child.id);assert.ok(!moved.find(item=>item.id===original[1].id).children.some(item=>item.id===child.id));
 moved=model.moveMenuItem(original,child.id,original[2].id,0);assert.equal(moved[2].children[0].id,child.id);
 assert.throws(()=>model.moveMenuItem(original,original[1].id,original[2].id,0));assert.throws(()=>model.moveMenuItem(original,original[0].id,original[0].id,0));
 const custom={items:[{id:'group',label:'Інформація',href:'#',visibility:'auto',children:[{id:'story',label:'Історія',href:'/about/why-pchilka-not-bdzhilka',visibility:'auto'},{id:'empty',label:'Порожня',href:'/new-empty',visibility:'auto'},{id:'hidden',label:'Таємна',href:'/about/stores',visibility:'hidden'}]},{id:'partner',label:'Партнер',href:'https://example.com',visibility:'auto'},{id:'forced',label:'Завжди',href:'/ready-page',visibility:'always'}]};
 assert.equal((await api.PUT(req('PUT',custom,cookie('editor',['content:write'])))).status,200);
 assert.deepEqual(await repo.getSiteMenuSettings(),custom);
 const visible=await(await publicApi.GET()).json();assert.deepEqual(visible.menu.map(item=>item.id),['group','partner','forced']);assert.deepEqual(visible.menu[0].children.map(item=>item.id),['story']);
 assert.deepEqual(filterContentMenu(custom.items,new Set())[0].id,'partner');
 const hiddenParent=structuredClone(custom);hiddenParent.items[0].visibility='hidden';assert.equal(filterContentMenu(hiddenParent.items,new Set(['/about/why-pchilka-not-bdzhilka'])).length,2);
 for(const href of ['javascript:alert(1)','//evil.example/x','/\\evil.example','https://user:password@example.com','data:text/html,test']){const invalid=structuredClone(custom);invalid.items[1].href=href;assert.equal((await api.PUT(req('PUT',invalid))).status,400);}
 const duplicate=structuredClone(custom);duplicate.items[1].id='group';assert.throws(()=>model.normalizeSiteMenu(duplicate));
 const deep=structuredClone(custom);deep.items[0].children[0].children=[{id:'deep',label:'Глибоко',href:'/'}];assert.throws(()=>model.normalizeSiteMenu(deep));
 const emptyGroup={items:[{id:'empty',label:'Група',href:'#',visibility:'auto'}]};assert.throws(()=>model.normalizeSiteMenu(emptyGroup));
 assert.deepEqual(await repo.getSiteMenuSettings(),custom);
 contentRepo.getBlogContentFromDb=async()=>{throw new Error('Offline');};
 const offline=await(await publicApi.GET()).json();assert.equal(offline.contentAvailable,false);assert.ok(offline.menu.some(item=>item.id==='partner'));
 await Promise.all([repo.saveSiteMenuSettings(defaults),repo.saveSiteMenuSettings(custom)]);assert.deepEqual(await repo.getSiteMenuSettings(),custom);
 await repo.saveSiteMenuSettings({items:[]});assert.deepEqual((await(await publicApi.GET()).json()).menu,[]);
 console.log('PASS: default menu migration; authorized CRUD; read-only denial; reorder and reparent; depth/cycle/duplicate checks; safe links; hidden/automatic/always visibility; public menu with unavailable content; empty menu; atomic persistence.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{const resolved=path.resolve(temporary);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('pchilka-menu-check-'));fs.rmSync(resolved,{recursive:true,force:true});});
