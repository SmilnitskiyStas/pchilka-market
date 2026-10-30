// Public page rendering with in-memory content: no live requests or database writes.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...args); };
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
const vm = require('vm');
const { renderToStaticMarkup: render } = require('react-dom/server');
async function main() {
  const { insertContentImage } = require('../lib/content-images.ts');
  const ArticleBody = require('../components/article-body.tsx').default;
  const markdown = insertContentImage('before SELECT after', '/media/копчення (1).jpg', 7, 13);
  assert.ok(markdown.startsWith('before \n\n![') && markdown.endsWith('\n\n after'));
  let html = render(ArticleBody({body:markdown}));
  assert.ok(html.includes('<img') && html.includes('%281%29.jpg') && !html.includes('SELECT'));
  assert.equal(insertContentImage('', '/media/already%20encoded.jpg',0,0).includes('%2520'),false);
  for (const body of ['/media/demo.jpg', '[/media/demo.jpg](/media/demo.jpg)', '/uploads/demo.png']) assert.ok(render(ArticleBody({body})).includes('<img'), body);
  const youtube = require('../lib/youtube-video.ts');
  const embed = 'https://www.youtube.com/embed/HNGyDiMRKS4';
  const iframe = '<iframe width="560" height="315" src="https://www.youtube.com/embed/HNGyDiMRKS4?si=share" title="YouTube video player" onload="alert(1)" allowfullscreen></iframe>';
  assert.equal(youtube.getYouTubeInputEmbedUrl(iframe),embed);
  assert.equal(youtube.getYouTubeInputEmbedUrl("<iframe src='https://youtu.be/HNGyDiMRKS4'></iframe>"),embed);
  for (const body of [iframe, iframe.replace(' width=', '\n width='), 'https://youtu.be/HNGyDiMRKS4', '[Відео](https://youtu.be/HNGyDiMRKS4)']) {
    const html=render(ArticleBody({body:`Перед відео\n${body}\nПісля відео`}));
    assert.equal((html.match(/<iframe/g)||[]).length,1);
    assert.ok(html.includes(embed)&&html.includes('Перед відео')&&html.includes('Після відео'));
    assert.ok(!html.includes('onload=')&&!html.includes('si=share'));
  }
  for (const input of ['<iframe src="https://evil.test/"></iframe>','<iframe src="javascript:alert(1)"></iframe>','<iframe srcdoc="test"></iframe>','<iframe src="https://www.youtube.com/embed/HNGyDiMRKS4" src="https://evil.test/"></iframe>']) {
    assert.equal(youtube.getYouTubeInputEmbedUrl(input),null);
    assert.ok(!render(ArticleBody({body:input})).includes('<iframe'));
  }
  assert.equal((render(ArticleBody({body:`${iframe}\n${iframe}`})).match(/<iframe/g)||[]).length,2);
  const content = require('../lib/blog-content-repository.ts');
  let entries = [];
  content.getBlogContentFromDb = async () => ({entries});
  const own = require('../app/own-brand/[slug]/page.tsx');
  const props = {params:Promise.resolve({slug:'natural-smoking'})};
  html = render(await own.default(props));
  assert.ok(html.includes('Натуральне копчення') && !html.includes('min-h-screen'));
  entries = [
    {id:'before',slug:'before',pagePath:'/own-brand/natural-smoking',placement:'before-content',status:'published',body:'Before text',updatedAt:'2026-10-30',coverImage:''},
    {id:'after',slug:'after',pagePath:'/own-brand/natural-smoking',placement:'after-content',status:'published',body:markdown,updatedAt:'2026-10-30',coverImage:'/media/cover.jpg'},
    {id:'draft',slug:'draft',pagePath:'/own-brand/natural-smoking',status:'draft',body:'Private draft',updatedAt:'2026-10-30'},
    {id:'other',slug:'other',pagePath:'/own-brand/bakery',status:'published',body:'Other page',updatedAt:'2026-10-30'}
  ];
  html = render(await own.default(props));
  assert.ok(html.includes('Before text') && html.includes('/media/cover.jpg') && html.includes('%281%29.jpg'));
  assert.ok(html.indexOf('Before text') < html.indexOf('id="article-after"'));
  assert.ok(!html.includes('Private draft') && !html.includes('Other page') && !html.includes('Добірні продукти'));
  assert.equal((html.match(/id="article-after"/g)||[]).length,1);
  const headers = require('next/headers'); headers.cookies = async () => ({get:()=>undefined});
  const auth = require('../lib/admin-auth.ts'); auth.getCurrentAdminAccessFromToken = async () => null;
  const repo = require('../lib/visual-pages-repository.ts');
  const page = {slug:'rental-intro',title:'Rental title',description:'',blocks:[{id:'text',type:'text',text:'Rental terms'}]};
  let record = {draft:page,published:page}; repo.getVisualPage = async () => record;
  require('../lib/public-content-repository.ts').listPublishedFormEntries = async () => [];
  const rental = require('../app/cooperation/rental/page.tsx');
  html = render(await rental.default({})); assert.ok(html.includes('Rental terms') && !html.includes('<form'));
  const form = {id:'request',type:'form',form:'rental'};
  record = {draft:{...page,blocks:[form]},published:page};
  html = render(await rental.default({searchParams:Promise.resolve({preview:'1'})})); assert.ok(!html.includes('<form'), 'Unauthorized preview cannot reveal draft form');
  record = {draft:page,published:{...page,blocks:[form]}};
  html = render(await rental.default({})); assert.equal((html.match(/<form/g)||[]).length,1);
  record = null; html = render(await rental.default({})); assert.ok(!html.includes('<form'));
  // Exercise the actual content editor: choosing/uploading a body image must not change its cover.
  require('../lib/blog-content-client.ts').fetchBlogContentPayload = async () => ({entries:[],categories:[]});
  const slots = []; let cursor = 0, effects = [];
  const slot = () => slots[cursor++] ?? (slots[cursor-1] = {});
  const react = {
    useState(initial) { const item=slot(); if (!('value' in item)) item.value=typeof initial==='function'?initial():initial; return [item.value, value=>{item.value=typeof value==='function'?value(item.value):value;}]; },
    useRef(initial) { const item=slot(); if (!('current' in item)) item.current=initial; return item; },
    useMemo(fn) { slot(); return fn(); },
    useEffect(fn,deps) { const item=slot(); if (!item.deps || deps.some((value,i)=>value!==item.deps[i])) {item.deps=deps;effects.push(fn);} }
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'components/admin/admin-content-manager.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
    exports, require:name=>name==='react'?react:require(name), FormData, requestAnimationFrame:fn=>fn(),
    fetch:async (url, options)=>({ok:true,json:async()=>options?.method==='POST'?{ok:true,path:'/media/uploaded.jpg'}:{images:['/media/selected.jpg','/media/video.mp4']}})
  });
  function editor() {cursor=0;effects=[];const tree=exports.default();effects.forEach(fn=>fn());return tree;}
  function nodes(tree,match) { if (!tree || typeof tree!=='object') return []; if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,match));return [...(match(tree)?[tree]:[]),...nodes(tree.props?.children,match)]; }
  function text(tree) { if(Array.isArray(tree))return tree.map(text).join('');return tree&&typeof tree==='object'?text(tree.props?.children):tree==null?'':String(tree); }
  const button=(tree,label)=>nodes(tree,n=>n.type==='button'&&text(n)===label)[0];
  const tick=()=>new Promise(done=>setImmediate(done));
  editor(); await tick(); let tree=editor();
  nodes(tree,n=>n.props?.id==='content-body')[0].props.onChange({target:{value:'Existing text'}}); tree=editor();
  nodes(tree,n=>n.props?.id==='content-cover')[0].props.onChange({target:{value:'/media/original-cover.jpg'}}); tree=editor();
  button(tree,'Зображ.').props.onClick(); await tick(); tree=editor();
  assert.equal(nodes(tree,n=>n.type==='img'&&n.props.src==='/media/video.mp4').length,0);
  button(tree,'/media/selected.jpg').props.onClick(); tree=editor();
  assert.ok(nodes(tree,n=>n.props?.id==='content-body')[0].props.value.includes('Existing text\n\n!['));
  assert.equal(nodes(tree,n=>n.props?.id==='content-cover')[0].props.value,'/media/original-cover.jpg');
  const bodyBeforeCover=nodes(tree,n=>n.props?.id==='content-body')[0].props.value;
  await button(tree,'Обрати з сервера').props.onClick(); tree=editor();button(tree,'/media/selected.jpg').props.onClick();tree=editor();
  assert.equal(nodes(tree,n=>n.props?.id==='content-cover')[0].props.value,'/media/selected.jpg');
  assert.equal(nodes(tree,n=>n.props?.id==='content-body')[0].props.value,bodyBeforeCover);
  const upload=nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0];
  upload.props.onChange({target:{files:[new Blob(['image'],{type:'image/jpeg'})],value:'image.jpg'}}); await tick();tree=editor();
  assert.ok(nodes(tree,n=>n.props?.id==='content-body')[0].props.value.includes('/media/uploaded.jpg'));
  const originalBody=nodes(tree,n=>n.props?.id==='content-body')[0].props.value;
  button(tree,'YouTube').props.onClick(); tree=editor();
  nodes(tree,n=>n.props?.id==='content-youtube-input')[0].props.onChange({target:{value:'https://evil.test'}}); tree=editor();
  button(tree,'Вставити відео').props.onClick();tree=editor();
  assert.equal(nodes(tree,n=>n.props?.id==='content-body')[0].props.value,originalBody);
  assert.ok(nodes(tree,n=>n.props?.role==='alert').length>0);
  nodes(tree,n=>n.props?.id==='content-youtube-input')[0].props.onChange({target:{value:iframe}});tree=editor();
  button(tree,'Вставити відео').props.onClick();tree=editor();
  const withVideo=nodes(tree,n=>n.props?.id==='content-body')[0].props.value;
  assert.ok(withVideo.startsWith(originalBody)&&withVideo.includes(embed)&&!withVideo.includes('onload'));
  assert.equal(nodes(tree,n=>n.props?.id==='content-youtube-input').length,0);
  assert.ok(render(ArticleBody({body:withVideo})).includes('<iframe'));
  button(tree,'PDF').props.onClick(); tree=editor();
  const PdfField = require('../components/admin/pdf-media-field.tsx').default;
  nodes(tree,n=>n.type===PdfField)[0].props.onChange('/media/terms.pdf'); tree=editor();
  nodes(tree,n=>n.props?.id==='content-pdf-title')[0].props.onChange({target:{value:'Умови програми'}});tree=editor();
  button(tree,'Вставити PDF').props.onClick();tree=editor();
  const withPdf=nodes(tree,n=>n.props?.id==='content-body')[0].props.value;
  assert.ok(withPdf.includes('[Умови програми](/media/terms.pdf)')&&withPdf.includes(embed));
  const renderedPdf=render(ArticleBody({body:withPdf}));
  assert.ok(renderedPdf.includes('src="/media/terms.pdf"')&&renderedPdf.includes('Відкрити PDF'));
  console.log('PASS: YouTube URL/iframe insertion, multi-line embeds, multiple videos, preserved surrounding text, rejected external frames and sanitized attributes.');
  console.log('Page content: inline own-brand articles, image URLs, draft isolation and explicit rental forms passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
