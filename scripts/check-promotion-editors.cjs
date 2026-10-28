/* Real API/auth handlers with an in-memory content repository; no live database writes. */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args);
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename);
}



const vm = require('vm');
function harness(file,fetcher) {
 const slots=[];let cursor=0,effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hook=()=>slots[cursor++]??(slots[cursor-1]={});
 const react={
  useState(initial){const s=hook();if(!('value'in s))s.value=typeof initial==='function'?initial():initial;return[s.value,v=>s.value=typeof v==='function'?v(s.value):v];},
  useMemo(fn,deps){const s=hook();if(!same(s.deps,deps)){s.value=fn();s.deps=deps;}return s.value;},
  useEffect(fn,deps){const s=hook();if(!same(s.deps,deps)){s.deps=deps;effects.push(fn);}}
 };
 const out={};
 const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports:out,require:name=>name==='react'?react:name.startsWith('@/components/')||name==='next/link'?{default:()=>null}:require(name),fetch:fetcher,FormData,File,console,Date,Set});
 return()=>{cursor=0;effects=[];const tree=out.default();effects.forEach(fn=>fn());return tree;};
}
function nodes(n,predicate){if(Array.isArray(n))return n.flatMap(x=>nodes(x,predicate));if(!n||typeof n!=='object')return[];return[...(predicate(n)?[n]:[]),...nodes(n.props?.children,predicate)];}
function text(n){if(n==null||typeof n==='boolean')return'';if(typeof n==='string'||typeof n==='number')return String(n);if(Array.isArray(n))return n.map(text).join('');return text(n.props?.children);}
const buttons=(tree,label)=>nodes(tree,n=>n.type==='button'&&text(n)===label);
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
async function main(){
 let captured;
 const original={id:'card-1',title:'Original title',imageUrl:'/img/original.png',isActive:false,sortOrder:1,updatedAt:'2026-10-28'};
 const cards=harness('components/admin/admin-shock-price-manager.tsx',async(url,options={})=>{
  if(url==='/api/admin/images'&&options.method==='POST')return{ok:true,json:async()=>({ok:true,path:'/media/uploaded.png'})};
  if(url==='/api/admin/images')return{ok:true,json:async()=>({images:['/img/new.png','/media/video.mp4']})};
  if(options.method==='PUT'){captured=JSON.parse(options.body).items;return{ok:true,json:async()=>({ok:true,items:captured})};}
  return{ok:true,json:async()=>({ok:true,items:[original]})};
 });
 let tree=cards();await flush();tree=cards();
 assert.equal(nodes(tree,n=>n.type==='form').length,0);
 buttons(tree,'Додати картку')[0].props.onClick();tree=cards();
 assert.equal(nodes(tree,n=>n.type==='form').length,1);
 buttons(tree,'Скасувати')[0].props.onClick();tree=cards();
 assert.equal(nodes(tree,n=>n.type==='form').length,0);
 buttons(tree,'Обрати з медіафайлів')[0].props.onClick();await flush();tree=cards();
 assert.ok(!text(tree).includes('/media/video.mp4'));
 const pick=nodes(tree,n=>n.type==='button'&&text(n)==='/img/new.png')[0];assert.ok(pick);pick.props.onClick();tree=cards();
 let row=nodes(tree,n=>n.type==='li')[0];
 assert.equal(nodes(row,n=>n.type==='img')[0].props.src,'/img/new.png');
 assert.equal(nodes(row,n=>n.type==='input'&&n.props.placeholder==='Назва картки')[0].props.value,'Original title');
 assert.equal(nodes(row,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.checked,false);
 const input=nodes(row,n=>n.type==='input'&&n.props.type==='file')[0];input.props.onChange({target:{files:[new File(['fixture'],'new.png',{type:'image/png'})],value:'file'}});await flush();tree=cards();
 row=nodes(tree,n=>n.type==='li')[0];assert.equal(nodes(row,n=>n.type==='img')[0].props.src,'/media/uploaded.png');
 buttons(tree,'Зберегти порядок і картки')[0].props.onClick();await flush();tree=cards();
 assert.equal(captured[0].id,original.id);assert.equal(captured[0].title,original.title);assert.equal(captured[0].isActive,false);assert.equal(captured[0].sortOrder,1);assert.equal(captured[0].imageUrl,'/media/uploaded.png');
 buttons(tree,'Додати картку')[0].props.onClick();tree=cards();
 nodes(tree,n=>n.props?.id==='shock-card-url')[0].props.onChange({target:{value:'/img/add.png'}});tree=cards();
 nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});tree=cards();
 assert.equal(nodes(tree,n=>n.type==='form').length,0);assert.equal(nodes(tree,n=>n.type==='li').length,2);
 let fail=true;
 const promotions=harness('components/admin/admin-promotions-manager.tsx',async(url,options={})=>{
  if(options.method==='PUT'&&url==='/api/admin/promotions')return{ok:!fail,json:async()=>fail?{ok:false,error:'Save failed'}:{ok:true,promotions:JSON.parse(options.body).promotions}};
  return{ok:true,json:async()=>({ok:true,promotions:[],settings:{}})};
 });
 tree=promotions();await flush();tree=promotions();assert.equal(nodes(tree,n=>n.props?.id==='promotion-editor').length,0);
 buttons(tree,'Створити акцію')[0].props.onClick();tree=promotions();
 nodes(tree,n=>n.props?.id==='promo-title')[0].props.onChange({target:{value:'New promotion'}});tree=promotions();
 await nodes(tree,n=>n.props?.id==='promotion-editor')[0].props.onSubmit({preventDefault(){}});tree=promotions();
 assert.ok(text(tree).includes('Save failed'));assert.equal(nodes(tree,n=>n.props?.id==='promo-title')[0].props.value,'New promotion');
 fail=false;await nodes(tree,n=>n.props?.id==='promotion-editor')[0].props.onSubmit({preventDefault(){}});tree=promotions();assert.equal(nodes(tree,n=>n.props?.id==='promotion-editor').length,0);assert.ok(text(tree).includes('Акцію збережено.'));
 buttons(tree,'Редагувати')[0].props.onClick();tree=promotions();assert.equal(nodes(tree,n=>n.props?.id==='promo-title')[0].props.value,'New promotion');
 buttons(tree,'Скасувати')[0].props.onClick();tree=promotions();assert.equal(nodes(tree,n=>n.props?.id==='promotion-editor').length,0);
 console.log('PASS: promotion/card creation forms start hidden and open/cancel correctly; failed promotion save retains data; successful save closes form; editing reopens form; media selection and upload replace only the target card image and preserve title/status/order; new card form closes after adding.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
