/* Integration checks use isolated temporary uploads and real route/auth handlers. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-video-check-'));
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



const vm=require('vm');
async function main(){
 const {parseByteRange}=require('../lib/http-byte-range.ts');
 assert.deepEqual(parseByteRange('bytes=-3',10),{start:7,end:9});assert.deepEqual(parseByteRange('bytes=5-',10),{start:5,end:9});assert.deepEqual(parseByteRange('bytes=0-99',10),{start:0,end:9});
 for(const value of ['bytes=-','bytes=-0','bytes=10-','bytes=4-2','bytes=0-1,4-5','bytes=9007199254740993-'])assert.equal(parseByteRange(value,10),null);
 const route=require('../app/media/[...path]/route.ts');
 fs.writeFileSync(path.join(temporary,'sample.mp4'),'0123456789');
 const context=()=>({params:Promise.resolve({path:['sample.mp4']})});
 const response=await route.GET(new Request('http://localhost/media/sample.mp4',{headers:{Range:'bytes=-3'}}),context());
 assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 7-9/10');assert.equal(await response.text(),'789');
 const head=await route.HEAD(new Request('http://localhost/media/sample.mp4',{method:'HEAD'}),context());assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
 const invalid=await route.GET(new Request('http://localhost/media/sample.mp4',{headers:{Range:'bytes=10-'}}),context());assert.equal(invalid.status,416);
 const slots=[];let cursor=0,effects=[],timerCount=0,clearCount=0,intersectionCallback,visibilityCallback;const observers=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const hook=()=>slots[cursor++]??(slots[cursor-1]={});
 const react={useState(initial){const s=hook();if(!('value'in s))s.value=initial;return[s.value,value=>s.value=typeof value==='function'?value(s.value):value];},useRef(value){const s=hook();return s.value??={current:value};},useEffect(callback,deps){const s=hook();if(!same(s.deps,deps)){s.deps=deps;effects.push(()=>{s.cleanup?.();s.cleanup=callback();});}}};
 const document={hidden:false,addEventListener(name,callback){visibilityCallback=callback;},removeEventListener(){}};
 class Observer{constructor(callback){intersectionCallback=callback;observers.push(this);}observe(){}disconnect(){}}
 const mod={};
 const output=ts.transpileModule(fs.readFileSync(path.join(root,'components/banner-carousel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(output,{exports:mod,require:name=>name==='react'?react:name==='next/image'?{default:'optimized-image'}:name==='next/link'?{default:()=>null}:require(name),document,IntersectionObserver:Observer,TextEncoder,btoa,setTimeout(){timerCount++;return timerCount;},clearTimeout(){clearCount++;}});
 function nodes(n,type){if(Array.isArray(n))return n.flatMap(x=>nodes(x,type));if(!n||typeof n!=='object')return[];return[...(n.type===type?[n]:[]),...nodes(n.props?.children,type)];}
 const slides=[{src:'/img/banners/week-1-alk-web.mp4',alt:'Video'},{src:'/img/cooperation/supply.png',alt:'Image'},{src:'/second.mp4',alt:'Hidden video'}];
 function render(list=slides){cursor=0;effects=[];const tree=mod.default({slides:list});effects.forEach(fn=>fn());return tree;}
 let tree=render();const optimizedImages=nodes(tree,'optimized-image');assert.equal(optimizedImages.length,1);assert.equal(optimizedImages[0].props.quality,75);assert.ok(optimizedImages[0].props.sizes.includes('100vw'));assert.equal(nodes(tree,'img').length,0);assert.equal(nodes(tree,'video').length,1);assert.equal(timerCount,0);assert.equal(nodes(tree,'video')[0].props.loop,false);
 let plays=0,pauses=0;nodes(tree,'video')[0].props.ref({play(){plays++;return Promise.resolve();},pause(){pauses++;}});
 document.hidden=true;visibilityCallback();tree=render();assert.ok(pauses>0);assert.equal(nodes(tree,'video')[0].props.preload,'none');
 document.hidden=false;visibilityCallback();tree=render();assert.ok(plays>0);
 intersectionCallback([{isIntersecting:false}]);tree=render();assert.equal(nodes(tree,'video')[0].props.autoPlay,false);intersectionCallback([{isIntersecting:true}]);tree=render();
 nodes(tree,'video')[0].props.onEnded();tree=render();assert.equal(nodes(tree,'video').length,0);assert.equal(timerCount,1);
 nodes(tree,'button')[2].props.onClick();tree=render();assert.equal(nodes(tree,'video').length,1);assert.equal(nodes(tree,'video')[0].props.src,'/second.mp4');assert.ok(clearCount>0);
 tree=render([slides[0]]);tree=render([slides[0]]);assert.equal(nodes(tree,'video')[0].props.loop,true);
 const bytes=fs.readFileSync(path.join(root,'public/img/banners/week-1-alk-web.mp4'));let position=0,moov=-1,mdat=-1;while(position+8<=bytes.length){const size=bytes.readUInt32BE(position);const type=bytes.toString('ascii',position+4,position+8);if(type==='moov')moov=position;if(type==='mdat')mdat=position;if(size<8)break;position+=size;}assert.ok(moov>=0&&moov<mdat,'MP4 metadata must precede video data');assert.ok(bytes.length<8*1024*1024);
 console.log('PASS: only active video loads; no timed switch during video; ended advances slideshow; one video loops; offscreen/hidden playback pauses; images keep slideshow timer; suffix/open/invalid byte ranges; HEAD; optimized MP4 faststart.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{const resolved=path.resolve(temporary);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('pchilka-video-check-'));fs.rmSync(resolved,{recursive:true,force:true});});
