/* Integration checks use isolated temporary uploads and real route/auth handlers. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-video-optimization-check-'));
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



const {execFileSync}=require('child_process');
async function main(){
 process.env.FFMPEG_PATH ||= path.join(root,'tmp/video-tools/node_modules/ffmpeg-static/ffmpeg.exe');
 process.env.FFPROBE_PATH ||= path.join(root,'tmp/video-tools/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe');
 const{NextResponse}=require('next/server');const auth=require('../lib/admin-auth.ts');
 const api=require('../app/api/admin/video-optimization/route.ts');const assets=require('../app/api/admin/assets/route.ts');const images=require('../app/api/admin/images/route.ts');const media=require('../app/media/[...path]/route.ts');const service=require('../lib/video-optimization.ts');
 function cookie(role,permissions=[]){const response=NextResponse.json({});auth.applyAdminSessionCookie(response,{username:'video-test',sub:'test:video',role,permissions});return response.headers.get('set-cookie').split(';')[0];}
 const admin=cookie('admin');const writer=cookie('editor',['media:write']);
 const req=(method,body,session=admin)=>new Request('http://localhost/api/admin/video-optimization',{method,headers:{'Content-Type':'application/json',...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{})});
 fs.mkdirSync(path.join(temporary,'video'),{recursive:true});
 const source=path.join(temporary,'video','fixture.mp4');
 execFileSync(process.env.FFMPEG_PATH,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=25','-t','1','-c:v','libx264','-preset','ultrafast','-crf','8','-an',source],{windowsHide:true});
 const bytes=fs.readFileSync(source);
 const wait=async id=>{for(let attempt=0;attempt<300;attempt++){const job=await service.getVideoOptimizationJob(id);if(job.status==='completed'||job.status==='failed')return job;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Job timeout');};
 assert.equal((await api.GET(req('GET',null,''))).status,401);
 assert.equal((await api.POST(req('POST',{path:'/media/video/fixture.mp4',keepOriginal:false},writer))).status,401);
 assert.equal((await api.POST(req('POST',{path:'/media/../secret.mp4'}))).status,400);
 assert.equal((await api.POST(req('POST',{path:'https://example.com/video.mp4'}))).status,400);
 const started=await(await api.POST(req('POST',{path:'/media/video/fixture.mp4',keepOriginal:true},writer))).json();assert.equal(started.ok,true);
 const deletion=await assets.DELETE(new Request('http://localhost/api/admin/assets',{method:'DELETE',headers:{cookie:admin,'Content-Type':'application/json'},body:JSON.stringify({path:'/media/video/fixture.mp4'})}));assert.equal(deletion.status,409);
 const kept=await wait(started.job.id);assert.equal(kept.status,'completed',kept.message);assert.equal(kept.originalDeleted,false);assert.ok(kept.outputBytes<bytes.length);assert.ok(fs.existsSync(source));assert.ok(kept.outputUrl.endsWith('.mp4'));
 fs.writeFileSync(path.join(temporary,'video','delete.mp4'),bytes);
 const removed=await wait((await service.startVideoOptimization('/media/video/delete.mp4',false)).id);assert.equal(removed.status,'completed',removed.message);assert.equal(removed.originalDeleted,true);assert.ok(!fs.existsSync(path.join(temporary,'video','delete.mp4')));
 const redirected=await media.GET(new Request('http://localhost/media/video/delete.mp4'),{params:Promise.resolve({path:['video','delete.mp4']})});assert.equal(redirected.status,307);assert.equal(redirected.headers.get('location'),removed.outputUrl);
 const listing=await(await assets.GET()).json();assert.ok(!listing.assets.some(asset=>asset.url.includes('.video-optimization')));
 const privateResponse=await media.GET(new Request('http://localhost/media/.video-optimization/replacements.json'),{params:Promise.resolve({path:['.video-optimization','replacements.json']})});assert.equal(privateResponse.status,404);
 for(const route of [assets,images]){
  const form=new FormData();form.append('file',new File([bytes],'uploaded.mp4',{type:'video/mp4'}));form.append('optimizeVideo','true');form.append('keepOriginal','true');
  const response=await route.POST(new Request('http://localhost/api/admin/'+(route===assets?'assets':'images'),{method:'POST',headers:{cookie:admin},body:form}));const payload=await response.json();assert.equal(payload.ok,true);assert.ok(payload.optimization,JSON.stringify(payload));const job=await wait(payload.optimization.id);assert.equal(job.status,'completed',job.message);assert.equal(job.originalDeleted,false);
 }
 const noDelete=new FormData();noDelete.append('file',new File([bytes],'denied.mp4'));noDelete.append('optimizeVideo','true');noDelete.append('keepOriginal','false');assert.equal((await images.POST(new Request('http://localhost/api/admin/images',{method:'POST',headers:{cookie:writer},body:noDelete}))).status,401);
 // A tiny already-compressed video must never be removed when the new output is larger.
 const tiny=path.join(temporary,'video','tiny.mp4');execFileSync(process.env.FFMPEG_PATH,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=black:size=32x32:rate=1','-t','1','-c:v','libx264','-an',tiny],{windowsHide:true});
 const unchanged=await wait((await service.startVideoOptimization('/media/video/tiny.mp4',false)).id);assert.equal(unchanged.originalDeleted,false);assert.ok(fs.existsSync(tiny));
 fs.writeFileSync(path.join(temporary,'video','invalid.mp4'),'broken video');const invalid=await wait((await service.startVideoOptimization('/media/video/invalid.mp4',false)).id);assert.equal(invalid.status,'failed');assert.ok(fs.existsSync(path.join(temporary,'video','invalid.mp4')));
 const previous=process.env.FFMPEG_PATH;process.env.FFMPEG_PATH=path.join(temporary,'missing-ffmpeg');fs.writeFileSync(path.join(temporary,'video','missing.mp4'),bytes);const failed=await wait((await service.startVideoOptimization('/media/video/missing.mp4',false)).id);assert.equal(failed.status,'failed');assert.ok(fs.existsSync(path.join(temporary,'video','missing.mp4')));process.env.FFMPEG_PATH=previous;
 console.log('PASS: real FFmpeg optimization; keep/delete choices; unchanged larger result preserves original; failed/invalid/missing-tool jobs preserve original; async upload through assets and images; deletion permission and active-job protection; old URL redirect; private job files excluded and inaccessible.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{const resolved=path.resolve(temporary);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('pchilka-video-optimization-check-'));fs.rmSync(resolved,{recursive:true,force:true});});
