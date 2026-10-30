/* Concurrent receipt checks against an in-memory SQL adapter and real form handlers. No live writes. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),Module=require('module'),ts=require('typescript'),vm=require('vm');
const root=path.resolve(__dirname,'..'),originalResolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...args){return originalResolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args);};
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true};
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions}).outputText;
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions}).outputText,file);
const tick=()=>new Promise(setImmediate);
const records=[],locks=new Map(),queues=new Map();let connectionId=0,destroyed=0,failInsert=false,failRead=false,failRelease=false,lockTimeout=false;
function unlock(name,connection){
 assert.equal(locks.get(name),connection);
 const next=queues.get(name)?.shift();
 if(next){locks.set(name,next.connection);next.resolve();}else locks.delete(name);
}
async function query(connection,sql,values=[]){
 if(sql.includes('GET_LOCK')){
  if(lockTimeout)return[[{acquired:0}]];
  assert.ok(values[0].length<=64);
  if(locks.has(values[0]))await new Promise(resolve=>{const queue=queues.get(values[0])||[];queue.push({connection,resolve});queues.set(values[0],queue);});
  else locks.set(values[0],connection);
  return[[{acquired:1}]];
 }
 if(sql.includes('RELEASE_LOCK')){if(failRelease){failRelease=false;throw Error('Release failed');}unlock(values[0],connection);return[[{released:1}]];}
 if(sql.includes('INSERT INTO incoming_requests')){
  await tick();if(failInsert){failInsert=false;throw Error('Insert failed');}
  const keys=['request_type','full_name','company_name','contact_person','phone','email','city','vacancy','subject','target_store','message','metadata_json','source_page'];
  const row={id:records.length+1,status:'new',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};keys.forEach((key,i)=>{row[key]=values[i];});records.push(row);return[{insertId:row.id}];
 }
 if(sql.includes('AS submission_fingerprint'))return[records.filter(row=>row.request_type===values[0]&&JSON.parse(row.metadata_json||'{}')._submissionKey===values[1]&&new Date(row.created_at).getTime()>=Date.now()-24*3600*1000).sort((a,b)=>b.id-a.id).slice(0,1).map(row=>({id:row.id,submission_fingerprint:JSON.parse(row.metadata_json)._submissionFingerprint}))];
 if(sql.includes('WHERE id = ?')){if(failRead){failRead=false;throw Error('Read after insert failed');}return[records.filter(row=>row.id===values[0])];}
 throw Error('Unexpected query; live database access prohibited');
}
global.__mysqlPool={query:(sql,values)=>query(null,sql,values),async getConnection(){
 const connection={id:++connectionId,query:(sql,values)=>query(connection,sql,values),release(){assert.ok(![...locks.values()].includes(connection),'Connection returned while holding receipt lock');},destroy(){destroyed++;for(const [name,owner] of [...locks])if(owner===connection)unlock(name,connection);}};return connection;
}};
function nodes(node,predicate){if(Array.isArray(node))return node.flatMap(child=>nodes(child,predicate));if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
function text(node){if(node==null||typeof node==='boolean')return'';if(Array.isArray(node))return node.map(text).join('');return typeof node==='object'?text(node.props?.children):String(node);}

function formHarness(file,props,fetcher,uploader){
 const slots=[];let cursor=0,effects=[];const slot=()=>slots[cursor++]??(slots[cursor-1]={});
 const hooks={useState(initial){const s=slot();if(!('value'in s))s.value=typeof initial==='function'?initial():initial;return[s.value,value=>{s.value=typeof value==='function'?value(s.value):value;}];},useRef(initial){const s=slot();return s.ref??(s.ref={current:initial});},useEffect(callback,deps){const s=slot();if(!s.deps||deps.some((value,i)=>!Object.is(value,s.deps[i]))){s.deps=deps;effects.push(callback);}}};
 const cache=new Map();let nextKey=0;
 const window={location:{pathname:'/cooperation/test',href:''}};
 function load(filename){
  if(cache.has(filename))return cache.get(filename);
  const exports={};cache.set(filename,exports);
  vm.runInNewContext(compile(filename),{exports,require:name=>name==='react'?hooks:name==='@/lib/request-submission-client'?load('lib/request-submission-client.ts'):name==='@/lib/request-attachment-client'?{uploadRequestAttachment:uploader}:name==='@/lib/analytics-events'?{trackAnalyticsEvent(){}}:require(name),fetch:fetcher,window,Date,Math,Error,crypto:{randomUUID:()=>`test-submission-key-${++nextKey}`}});
  return exports;
 }
 const component=load(file).default;
 const render=()=>{cursor=0;effects=[];const tree=component(props);effects.forEach(effect=>effect());return tree;};
 function fill(){
  for(let pass=0;pass<2;pass++){
   let tree=render();
   for(const node of nodes(tree,node=>node.type==='input'&&node.props.type!=='file')){
    const id=node.props.id||'';const value=id.includes('email')?'check@example.com':id.includes('phone')?'0501234567':node.props.type==='number'?'10':'Test';node.props.onChange?.({target:{value}});
   }
   for(const node of nodes(tree,node=>node.type==='select')){const option=nodes(node,node=>node.type==='option'&&node.props.value)[0];if(option)node.props.onChange({target:{value:option.props.value}});}
   for(const node of nodes(tree,node=>node.type==='textarea'))node.props.onChange({target:{value:'An isolated request submission check.'}});
  }
  return render();
 }
 return{render,fill,window};
}

async function main(){
 const api=require('../app/api/requests/route.ts');
 const body={requestType:'cooperation_general',fullName:'Test',companyName:'Company',phone:'0501234567',email:'check@example.com',message:'An isolated submission verification.',sourcePage:'/cooperation/offer-equipment',metadata:{attachment:{url:'/media/test.pdf',fileName:'test.pdf',fileSize:100,lastModified:42,fileType:'application/pdf'},selectedCategory:''}};
 const req=(input=body,key)=>new Request('http://localhost/api/requests',{method:'POST',headers:{'Content-Type':'application/json',...(key===undefined?{}:{'Idempotency-Key':key})},body:JSON.stringify(input)});
 assert.equal((await api.POST(req(null))).status,400);
 assert.equal((await api.POST(req(body,'bad'))).status,400);assert.equal(records.length,0);
 const key='isolated-receipt-0123456789';
 const concurrent=await Promise.all(Array.from({length:20},()=>api.POST(req(body,key))));
 assert.ok(concurrent.every(response=>response.status===200));
 const payloads=await Promise.all(concurrent.map(response=>response.json()));assert.equal(new Set(payloads.map(payload=>payload.request.id)).size,1);assert.equal(records.length,1);
 assert.ok(!('_submissionKey'in payloads[0].request.metadata)&&!('_submissionFingerprint'in payloads[0].request.metadata));assert.equal(locks.size,0);
 records[0].status='done';
 const reordered={...body,metadata:{selectedCategory:'',attachment:{fileType:'application/pdf',lastModified:42,fileSize:100,fileName:'test.pdf',url:'/media/test.pdf'}}};
 assert.equal((await(await api.POST(req(reordered,key))).json()).request.status,'done');assert.equal(records.length,1);
 assert.equal((await api.POST(req({...body,message:'A different request with a reused key.'},key))).status,409);assert.equal(records.length,1);
 assert.equal((await api.POST(req(body,'another-receipt-0123456789'))).status,200);assert.equal(records.length,2,'A new intentional submission must remain possible');
 await api.POST(req(body));await api.POST(req(body));assert.equal(records.length,4,'Existing callers without receipt keys remain compatible');
 lockTimeout=true;let response=await api.POST(req(body,'timeout-receipt-0123456789'));lockTimeout=false;assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'1');assert.equal(locks.size,0);
 failInsert=true;response=await api.POST(req(body,'insert-retry-0123456789'));assert.equal(response.status,500);assert.equal(locks.size,0);assert.equal(records.length,4);
 assert.equal((await api.POST(req(body,'insert-retry-0123456789'))).status,200);assert.equal(records.length,5);
 failRead=true;response=await api.POST(req(body,'response-lost-0123456789'));assert.equal(response.status,500);assert.equal(records.length,6);assert.equal(locks.size,0);
 response=await api.POST(req(body,'response-lost-0123456789'));assert.equal(response.status,200);assert.equal((await response.json()).request.id,'6');assert.equal(records.length,6,'A committed request must not be inserted again when the first response fails');
 failRelease=true;response=await api.POST(req(body,'release-retry-0123456789'));assert.equal(response.status,200);assert.equal(destroyed,1);assert.equal(locks.size,0);
 assert.equal((await api.POST(req(body,'release-retry-0123456789'))).status,200);assert.equal(records.length,7);
 records[0].created_at=new Date(Date.now()-25*3600*1000).toISOString();assert.equal((await api.POST(req(body,key))).status,200);assert.equal(records.length,8,'Receipt retention is limited to 24 hours');

 const forms=[['components/cooperation-offer-form.tsx',{}],['components/cooperation-offer-form.tsx',{mode:'product',productCategories:[{label:'Test category',recipientEmail:'test@example.com'}]}],['components/cooperation-rental-form.tsx',{}],['components/cooperation-marketing-services-form.tsx',{}],['components/cooperation-search-room-form.tsx',{}]];
 const file={name:'test.pdf',size:100,type:'application/pdf',lastModified:42};
 const uploaded={fileName:'test.pdf',fileSize:100,fileType:'application/pdf',lastModified:42,url:'/media/test.pdf'};
 for(const [form,props]of forms){
  let resolveUpload,resolvePost,uploadCount=0;const posts=[];
  const h=formHarness(form,props,async(url,options)=>{posts.push(options);return new Promise(resolve=>{resolvePost=()=>resolve({ok:true,json:async()=>({ok:true,request:{id:'1'}})});});},async()=>{uploadCount++;return new Promise(resolve=>{resolveUpload=()=>resolve(uploaded);});});
  let tree=h.fill();nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[file]}});tree=h.render();
  assert.equal(nodes(tree,node=>node.type==='button'&&node.props.type==='submit')[0].props.disabled,false,form);
  const submit=nodes(tree,node=>node.type==='form')[0].props.onSubmit,event={preventDefault(){}};
  const first=submit(event);const repeats=Array.from({length:6},()=>submit(event));tree=h.render();
  assert.equal(uploadCount,1,form);assert.equal(posts.length,0);assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,true);
  assert.equal(nodes(tree,node=>node.type==='button'&&node.props.type==='submit')[0].props.disabled,true);assert.ok(text(tree).includes('Надсилання'));
  resolveUpload();await tick();assert.equal(posts.length,1);await submit(event);assert.equal(posts.length,1,'Block duplicate submit while the POST is pending');
  resolvePost();await Promise.all([first,...repeats]);tree=h.render();assert.equal(nodes(tree,node=>node.type==='form')[0].props['aria-busy'],false);assert.ok(posts[0].headers['Idempotency-Key']);
  if(props.mode==='product')assert.ok(h.window.location.href.startsWith('mailto:'),'Only a mock mail draft is opened; no message is sent');

  let uploads=0,calls=0;const retryPosts=[];
  const retry=formHarness(form,props,async(url,options)=>{retryPosts.push(options);if(++calls===1)throw Error('Response lost');return{ok:true,json:async()=>({ok:true})};},async()=>{uploads++;return uploaded;});
  tree=retry.fill();nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[file]}});tree=retry.render();
  await nodes(tree,node=>node.type==='form')[0].props.onSubmit(event);tree=retry.render();assert.equal(nodes(tree,node=>node.type==='form')[0].props['aria-busy'],false);assert.ok(text(tree).includes('Response lost'));
  await nodes(tree,node=>node.type==='form')[0].props.onSubmit(event);assert.equal(uploads,1,'Reuse the uploaded attachment during a retry');assert.equal(retryPosts[0].headers['Idempotency-Key'],retryPosts[1].headers['Idempotency-Key']);assert.equal(retryPosts[0].body,retryPosts[1].body);
  tree=retry.fill();nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[file]}});tree=retry.render();await nodes(tree,node=>node.type==='form')[0].props.onSubmit(event);assert.notEqual(retryPosts[1].headers['Idempotency-Key'],retryPosts[2].headers['Idempotency-Key'],'Successful submission resets the receipt for a new request');

  let attempt=0,failedPosts=0;
  const failed=formHarness(form,props,async()=>{failedPosts++;return{ok:true,json:async()=>({ok:true})};},async()=>{if(++attempt===1)throw Error('Upload failed');return uploaded;});
  tree=failed.fill();nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.onChange({target:{files:[file]}});tree=failed.render();await nodes(tree,node=>node.type==='form')[0].props.onSubmit(event);tree=failed.render();assert.equal(failedPosts,0);assert.ok(text(tree).includes('Upload failed'));assert.equal(nodes(tree,node=>node.type==='button'&&node.props.type==='submit')[0].props.disabled,false);
  await nodes(tree,node=>node.type==='form')[0].props.onSubmit(event);assert.equal(failedPosts,1);
 }
 console.log('PASS: 20 concurrent retries create one receipt; changed-body conflict; response-loss replay; lock cleanup/timeout/retention; bot compatibility; all cooperation forms block repeated clicks before upload and POST, preserve retry keys/uploads, and recover after upload failure. No live requests or messages created.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
