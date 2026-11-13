const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=p=>fs.readFileSync(__dirname+'/'+p,'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j)};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
async function ideas(){
 let request=deferred(),calls=0,messages=[],refresh=async()=>{},error=null;
 const close={disabled:false},other={disabled:false},form={querySelector(s){return s==='[data-action-error]'?error:null},insertBefore(e){error=e},setAttribute(){},removeAttribute(){}},button={disabled:false,textContent:'Post comment',closest:()=>form};
 const modal={open:true,querySelectorAll:()=>[button,other,close],close(){this.open=false}};
 const c={modal,document:{createElement:()=>({dataset:{},setAttribute(){}})},$:()=>close,revisions:{one:4},AbortSignal,call:()=>{calls++;return request.promise},loadIdeas:()=>refresh(),toast:m=>messages.push(m)};vm.createContext(c);vm.runInContext(slice(src('app.js'),'const pendingIdeas=','let state='),c);
 let p=c.ideaAction('comment','one',{},button);assert.equal(button.disabled,true);assert.equal(button.textContent,'Please wait…');assert.equal(other.disabled,true);assert.equal(await c.ideaAction('comment','one',{},button),false);assert.equal(calls,1);request.resolve({});assert.equal(await p,true);assert.equal(button.disabled,false);assert.equal(other.disabled,false);
 request=deferred();p=c.ideaAction('comment','one',{},button);request.reject(Error('lost response'));assert.equal(await p,false);assert.equal(button.textContent,'Retry');assert.match(error.textContent,/Retry safely/);
 request=deferred();p=c.ideaAction('comment','one',{},button);request.reject(Object.assign(Error('conflict'),{status:409}));assert.equal(await p,false);assert.match(messages.at(-1),/refreshed idea/);assert.equal(calls,3);
 modal.open=true;refresh=async()=>{throw Error('offline')};request=deferred();p=c.ideaAction('comment','one',{},button);request.resolve({});assert.equal(await p,false);assert.match(messages.at(-1),/^Saved\./);assert.equal(modal.open,false);
}
async function initiatives(){
 let request=deferred(),calls=[],stored=null,mode='pending',messages=[];const button={disabled:false,textContent:'New initiative',dataset:{}};
 const c={CAN_WRITE:true,NO_DB:false,ME:'test',document:{querySelectorAll:()=>[button],getElementById:()=>null},crypto:{randomUUID:()=> 'test-uuid'},shape:x=>x,today:()=> '2026-11-13',clone:x=>JSON.parse(JSON.stringify(x)),stable:x=>JSON.stringify(x),revisions:{projects:{}},S:{projects:[]},sync:()=>{},go:()=>{},toast:x=>messages.push(x),setTimeout:()=>{},P:id=>c.S.projects.find(p=>p.id===id),db:{doc:path=>({set:async p=>{calls.push({path,p});if(mode==='pending')return request.promise;throw Object.assign(Error('conflict'),{status:409})},get:async()=>({exists:true,data:()=>stored,revision:7})})}};
 vm.createContext(c);vm.runInContext(slice(src('pipeline.html'),'let creatingInitiative','async function delDocs'),c);
 const p=c.newIdea(button);assert.equal(button.disabled,true);assert.equal(button.textContent,'Please wait…');await c.newIdea(button);assert.equal(calls.length,1);stored=calls[0].p;request.reject(Error('response lost'));await p;assert.equal(button.textContent,'Retry');assert.equal(c.S.projects.length,0);
 mode='conflict';await c.newIdea(button);assert.equal(calls.length,2);assert.equal(calls[1].path,calls[0].path);assert.equal(c.S.projects.length,1);assert.equal(c.revisions.projects['HZ-test-uuid'],7);assert.match(messages.at(-1),/created/);
}
(async()=>{await ideas();await initiatives();console.log('action feedback and safe retries: passed')})().catch(e=>{console.error(e);process.exitCode=1});
