// Upload/read/catalog and document rendering over isolated temporary storage; no live writes.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),Module=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pchilka-pdf-'));
process.env.UPLOADS_DIR=temporary;
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,parent,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
async function main(){
 const {isPdfDocumentUrl,createPdfMarkdown}=require('../lib/pdf-document.ts');
 const model=require('../lib/visual-pages.ts'),{renderToStaticMarkup:render}=require('react-dom/server'),React=require('react');
 const Body=require('../components/visual-page-body.tsx').default,Article=require('../components/article-body.tsx').default;
 const page=src=>({slug:'pdf-test',title:'PDF',description:'',blocks:[{id:'doc',type:'pdf',src,title:'Наш документ'}]});
 for(const src of ['/media/report.pdf','https://example.com/doc.PDF?version=1#page=2']) {
  assert.equal(isPdfDocumentUrl(src),true);const valid=model.validateVisualPage(page(src),true);
  for(const editing of [true,false]){const html=render(React.createElement(Body,{page:valid,editing}));assert.ok(html.includes('<iframe')&&html.includes('Відкрити PDF')&&html.includes('Наш документ'));}
  const html=render(React.createElement(Article,{body:`Before\n${createPdfMarkdown(src,'Документ')}\nAfter`}));assert.ok(html.includes('<iframe')&&html.includes('Before')&&html.includes('After'));
 }
 for(const src of ['javascript:alert(1)','//evil.test/doc.pdf','/media/page.html','http://example.com/doc.pdf','https://user:pass@example.com/doc.pdf']){assert.equal(isPdfDocumentUrl(src),false);assert.throws(()=>model.validateVisualPage(page(src),true));}
 assert.equal(model.validateVisualPage(page('')).blocks[0].src,'');assert.throws(()=>model.validateVisualPage(page(''),true));
 assert.ok(createPdfMarkdown('/media/guide(1).pdf','[Document]').includes('guide%281%29.pdf'));
 assert.ok(!render(React.createElement(Article,{body:'[Bad](/media/page.html)'})).includes('<iframe'));
 const auth=require('../lib/admin-auth.ts'),{NextResponse}=require('next/server');
 function cookie(permissions){const res=NextResponse.json({});auth.applyAdminSessionCookie(res,{username:'pdf-test',sub:'test:pdf',role:'editor',permissions});return res.headers.get('set-cookie').split(';')[0];}
 const assets=require('../app/api/admin/assets/route.ts');
 function upload(session){const data=new FormData();data.append('file',new File(['%PDF-1.4\n%%EOF'], 'rules.pdf',{type:'application/pdf'}));data.append('folder','documents/pages');return new Request('http://localhost/api/admin/assets',{method:'POST',headers:session?{cookie:session}:{},body:data});}
 assert.equal((await assets.POST(upload(cookie(['content:write'])))).status,401);
 const response=await assets.POST(upload(cookie(['media:write'])));assert.equal(response.status,200);const uploaded=await response.json();assert.ok(isPdfDocumentUrl(uploaded.path));
 const list=(await(await assets.GET()).json()).assets;assert.equal(list[0].url,uploaded.path);
 const media=require('../app/media/[...path]/route.ts');
 const params={params:Promise.resolve({path:uploaded.path.replace('/media/','').split('/')})};
 const file=await media.GET(new Request('http://localhost'+uploaded.path),params);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'application/pdf');assert.equal(await file.text(),'%PDF-1.4\n%%EOF');
 console.log('PASS: PDF upload permissions, media catalog and PDF response; visual block drafts/publishing; inline reader/open link; article Markdown; invalid destinations rejected.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));
