// Real catalog APIs over temporary files, without a live DB or filesystem changes outside the fixture.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),Module=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cwd=process.cwd(),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pchilka-media-order-'));
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,parent,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
async function main(){
  process.chdir(temporary);process.env.UPLOADS_DIR=path.join(temporary,'uploads');
  function file(name,seconds){const target=path.join(temporary,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'fixture');fs.utimesSync(target,seconds,seconds);}
  file('uploads/a/1700000000000-old.png',2000000000);
  file('uploads/z/1800000000000-new.png',1000000000);
  file('uploads/b/1800000000000-video.mp4',1000000000);
  file('uploads/legacy.png',1750000000);
  file('uploads/docs/1850000000000-guide.pdf',1000000000);
  file('uploads/.private.png',2000000000);
  file('uploads/nope.exe',2000000000);
  file('public/img/bundled.png',2100000000);
  file('public/img/.hidden.png',2200000000);
  const imagesApi=require(path.join(root,'app/api/admin/images/route.ts')),assetsApi=require(path.join(root,'app/api/admin/assets/route.ts'));
  const imageResponse=await imagesApi.GET(),images=(await imageResponse.json()).images;
  assert.deepEqual(images,['/media/b/1800000000000-video.mp4','/media/z/1800000000000-new.png','/media/legacy.png','/media/a/1700000000000-old.png','/img/bundled.png']);
  assert.equal(imageResponse.headers.get('cache-control'),'no-store');
  const assets=(await(await assetsApi.GET()).json()).assets;
  assert.deepEqual(assets.map(item=>item.url),['/media/docs/1850000000000-guide.pdf',...images.filter(url=>url.startsWith('/media/'))]);
  assert.ok(assets.every(item=>item.metadata&&typeof item.metadata.alt==='string'));
  file('uploads/first-folder/1900000000000-latest.jpg',900000000);
  assert.equal((await(await imagesApi.GET()).json()).images[0],'/media/first-folder/1900000000000-latest.jpg');
  assert.equal((await(await assetsApi.GET()).json()).assets[0].url,'/media/first-folder/1900000000000-latest.jpg');
  fs.renameSync(path.join(temporary,'public'),path.join(temporary,'removed-public'));
  assert.ok((await(await imagesApi.GET()).json()).images.length>0,'Missing bundled directory must not hide uploads');
  console.log('PASS: newest first across folders; filename date survives changed mtime; legacy mtime; deterministic ties; uploads precede bundled files; PDF/media metadata and filters preserved; fresh reads.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{process.chdir(cwd);fs.rmSync(temporary,{recursive:true,force:true});});
