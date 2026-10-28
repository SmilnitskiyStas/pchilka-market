const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
for (const extension of ['.ts','.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true }
}).outputText,filename);

async function main() {
  const model = require('../lib/media-catalog.ts');
  const assets = Array.from({length:101},(_,index)=>({url:`/media/image-${index}.jpg`}));
  assert.equal(model.mediaCatalogPage(assets,1).items.length,24);
  assert.equal(model.mediaCatalogPage(assets,5).items.length,5);
  assert.equal(model.mediaCatalogPage(assets,100).page,5);
  assert.equal(model.mediaCatalogPage([],3).page,1);
  assert.deepEqual(model.mediaCatalogPage(assets,2).items,assets.slice(24,48));
  assert.equal(model.mediaPreviewUrl('/img/Пчілка банер.png'),'/img/%D0%9F%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%B1%D0%B0%D0%BD%D0%B5%D1%80.png');
  assert.equal(model.mediaPreviewUrl('/media/banner%20one.jpg'),'/media/banner%20one.jpg');
  assert.equal(model.mediaPreviewUrl('/img/100%.png'),'/img/100%25.png');

  // A small hook lifecycle harness: state changes trigger re-renders and effect
  // cleanup only runs when dependencies change, matching React's contract.
  const React = require('react');
  const originals = {useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};
  const originalNow = Date.now;
  const slots = [];
  let cursor=0, effects=[], now=1000, latest;
  const requests=[];
  React.useState = initial => {
    const index=cursor++;
    if(!(index in slots)) slots[index]=typeof initial==='function'?initial():initial;
    return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];
  };
  React.useRef = initial => { const index=cursor++; return slots[index]??(slots[index]={current:initial}); };
  React.useEffect = (effect,deps) => {
    const index=cursor++, previous=slots[index];
    if(!previous || deps.some((value,i)=>!Object.is(value,previous.deps[i]))) effects.push(()=>{
      previous?.cleanup?.(); slots[index]={deps,cleanup:effect()};
    });
  };
  Date.now=()=>now;
  const hook=require('../lib/use-media-catalog.ts').useMediaCatalog;
  const load=signal=>new Promise((resolve,reject)=>requests.push({signal,resolve,reject}));
  function render(open) { cursor=0; effects=[]; latest=hook(open,load); effects.forEach(effect=>effect()); return latest; }
  const settle=async()=>{ await new Promise(resolve=>setImmediate(resolve)); };
  try {
    render(false); render(true); render(true);
    assert.equal(requests.length,1);
    assert.equal(requests[0].signal.aborted,false,'Loading-state render must not cancel its own request');
    requests[0].resolve(assets); await settle(); render(true);
    assert.equal(latest.isLoading,false); assert.equal(latest.items.length,101);
    render(false); render(true);
    assert.equal(requests.length,1,'Reopening reuses the cached catalog');
    latest.refresh(); render(true); render(true);
    assert.equal(requests.length,2);
    render(false);
    assert.equal(requests[1].signal.aborted,true);
    requests[1].resolve([{url:'/media/stale.jpg'}]); await settle();
    render(true); render(true);
    assert.equal(requests.length,3,'Reopen during loading starts a new request instead of remaining stuck');
    requests[2].resolve(assets.slice(0,2)); await settle(); render(true);
    assert.deepEqual(latest.items,assets.slice(0,2),'Late responses from closed dialogs do not overwrite results');
    now+=31000; render(false); render(true);
    assert.equal(requests.length,4);
    requests[3].reject(new Error('Unavailable')); await settle(); render(true);
    assert.equal(latest.error,'Unavailable'); assert.equal(latest.isLoading,false);
    latest.refresh(); render(true); render(true);
    assert.equal(latest.error,''); assert.equal(requests.length,5);
    requests[4].resolve([]); await settle(); render(true); render(false); render(true);
    assert.equal(latest.isLoading,false); assert.equal(requests.length,5,'Empty catalogs are cached too');
    console.log('PASS: catalog request survives loading renders; close abort/reopen; stale response isolation; 30-second cache; refresh/error recovery; empty result caching; 24-item pages; safe encoded preview paths.');
  } finally {
    slots.forEach(slot=>slot?.cleanup?.());
    Object.assign(React,originals); Date.now=originalNow;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
