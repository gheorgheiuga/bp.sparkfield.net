const ENDPOINT=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const ANON=()=>process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
const SERVICE=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN=/^(?:[^\s@]+@blueprojects\.com|gheorghe\.iuga@gmail\.com)$/i;
const ROLES=['admin','user','dt_lead','managing_partner'];
const ID=/^[\w-]{1,100}$/;
const result=(res,status,body)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(body)};
async function request(path,{method='GET',body,key=SERVICE(),token=key,headers={}}={}){
 const r=await fetch(ENDPOINT()+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>null);return {ok:r.ok,status:r.status,data};
}
async function identity(req){
 const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('horizon_session='))?.slice(16);if(!token)return null;
 try {if(!JSON.parse(Buffer.from(token.split('.')[1],'base64url')).amr?.some(x=>x.method==='otp'))return null;}catch{return null}
 const user=await request('/auth/v1/user',{key:ANON(),token});if(!user.ok||!user.data?.id||!user.data.email_confirmed_at||!DOMAIN.test(user.data.email||''))return null;
 const p=await request('/rest/v1/horizon_access?user_id=eq.'+encodeURIComponent(user.data.id)+'&select=email,status,role');
 if(!p.ok)throw Error('Access store unavailable');const row=p.data?.[0];if(!row||row.status!=='approved'||row.email.toLowerCase()!==user.data.email.toLowerCase()||!ROLES.includes(row.role))return null;
 return {id:user.data.id,email:user.data.email.toLowerCase(),role:row.role};
}
const table={ideas:'horizon_ideas',projects:'horizon_projects',settings:'horizon_settings'};
const q=id=>encodeURIComponent(id);
async function getRow(kind,id){const r=await request('/rest/v1/'+table[kind]+'?id=eq.'+q(id)+'&select=id,record,revision');if(!r.ok)throw Error('Read failed');return r.data[0]||null}
async function write(kind,id,record,revision){
 if(revision===0){let r=await request('/rest/v1/'+table[kind],{method:'POST',body:{id,record},headers:{Prefer:'return=representation'}});return r.ok?r.data[0]:null}
 let r=await request('/rest/v1/'+table[kind]+'?id=eq.'+q(id)+'&revision=eq.'+Number(revision),{method:'PATCH',body:{record,revision:revision+1,updated_at:new Date().toISOString()},headers:{Prefer:'return=representation'}});if(!r.ok)throw Error('Write failed');return r.data[0]||null;
}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return result(res,405,{error:'Method not allowed'});
 if(!ENDPOINT()||!ANON()||!SERVICE())return result(res,503,{error:'Storage unavailable'});
 if(req.headers.origin&&req.headers.origin!=='https://'+req.headers.host)return result(res,403,{error:'Invalid origin'});
 try{
  const me=await identity(req);if(!me)return result(res,401,{error:'Approved sign-in required'});
  const {action,kind,id,record,revision}=req.body||{};const lead=me.role!=='user';const settingsAdmin=['admin','managing_partner'].includes(me.role);
  if(action==='list'){
   if(!table[kind]||(kind!=='ideas'&&!lead))return result(res,403,{error:'Access denied'});
   let rows=[],offset=0;for(;;){const r=await request('/rest/v1/'+table[kind]+'?select=id,record,revision&order=id.asc&limit=500&offset='+offset);if(!r.ok)throw Error('Read failed');rows.push(...r.data);if(r.data.length<500)break;offset+=500;}if(kind==='ideas')rows=rows.map(row=>{const {likedBy=[],...rest}=row.record;return {...row,record:{...rest,liked:likedBy.includes(me.id)}}});return result(res,200,{rows});
  }
  if(action==='create_idea'){
   const fields=['title','problem','solution','dimension','theme'];if(!record||fields.some(k=>typeof record[k]!=='string'||record[k].length>1000)||!record.title.trim()||!record.problem.trim())return result(res,400,{error:'Invalid idea'});
   const now=new Date(),newId='IDEA-'+crypto.randomUUID();const idea={id:newId,...Object.fromEntries(fields.map(k=>[k,record[k].trim()])),author:me.email,authorId:me.id,date:now.toISOString().slice(0,10),status:'New',likes:0,likedBy:[],comments:[],history:[{date:now.toISOString(),text:'Idea submitted by '+me.email}],feedback:'Awaiting stream lead review.',illustrative:false};
   const row=await write('ideas',newId,idea,0);if(!row)throw Error('Create failed');return result(res,200,{row});
  }
  if(['comment','like','review'].includes(action)){
   if(!ID.test(String(id||''))||!Number.isSafeInteger(revision)||revision<1)return result(res,400,{error:'Invalid idea'});
   if(action==='review'&&!lead)return result(res,403,{error:'Review access required'});
   const row=await getRow('ideas',id);if(!row)return result(res,404,{error:'Idea not found'});if(row.revision!==revision)return result(res,409,{error:'This idea changed. Reload it before saving.'});
   let x=row.record;const date=new Date().toISOString();
   if(action==='comment'){const text=String(req.body.text||'').trim();if(!text||text.length>1000)return result(res,400,{error:'Invalid contribution'});x.comments=[...(x.comments||[]),{author:me.email,text}];x.history=[...(x.history||[]),{date,text:me.email+' added a contribution.'}];}
   if(action==='like'){const set=new Set(x.likedBy||[]);set.has(me.id)?set.delete(me.id):set.add(me.id);x.likedBy=[...set];x.likes=set.size;}
   if(action==='review'){const review=req.body.review||{};if(!['New','In Discussion','Under Review','Promoted','Closed'].includes(review.status)||!String(review.feedback||'').trim()||(review.status==='Promoted'&&!String(review.handoff||'').trim())||x.initiativeId)return result(res,400,{error:'Invalid review'});for(const k of ['status','dimension','feedback','handoff','merge']){if(typeof review[k]!=='string'||review[k].length>1000)return result(res,400,{error:'Invalid review'});x[k]=review[k].trim()}x.history=[...(x.history||[]),{date,text:me.email+' reviewed the idea: '+x.status+'. '+x.feedback}];}
   const updated=await write('ideas',id,x,revision);if(!updated)return result(res,409,{error:'This idea changed. Reload it before saving.'});return result(res,200,{row:updated});
  }
  if(action==='pickup'){
   if(!lead)return result(res,403,{error:'Initiative access required'});
   const owner=String(req.body.owner||'').trim(),note=String(req.body.note||'').trim();if(!ID.test(String(id||''))||!Number.isSafeInteger(revision)||revision<1||!owner||owner.length>100||!note||note.length>1000)return result(res,400,{error:'Invalid handoff'});
   const r=await request('/rest/v1/rpc/horizon_pickup',{method:'POST',body:{p_idea_id:id,p_revision:revision,p_project_id:'HZ-'+crypto.randomUUID(),p_actor:me.email,p_owner:owner,p_note:note}});
   if(!r.ok)throw Error('Handoff failed');if(!r.data)return result(res,409,{error:'The idea changed or was already picked up.'});return result(res,200,{handoff:r.data});
  }
  if(action==='import_local'){
   if(me.role!=='admin')return result(res,403,{error:'Administrator access required'});
   let ideas=req.body.ideas,projects=req.body.projects;
   if(!Array.isArray(ideas)||!Array.isArray(projects)||ideas.length+projects.length>300||JSON.stringify({ideas,projects}).length>1000000)return result(res,400,{error:'Invalid import'});
   if(ideas.some(x=>!x||!ID.test(String(x.id||''))||typeof x.title!=='string'||typeof x.problem!=='string'||!Array.isArray(x.comments)||!Array.isArray(x.history))||projects.some(x=>!x||!ID.test(String(x.id||''))||!x.idea||typeof x.idea!=='object'))return result(res,400,{error:'Invalid records'});
   ideas=ideas.map(x=>({...x,author:x.author==='You'?me.email+' (imported from this browser)':x.author,likedBy:[],likes:0,liked:false,history:[...x.history,{date:new Date().toISOString(),text:'Imported by '+me.email+' from browser-local data; previous authorship may be illustrative.'}]}));
   projects=projects.map(x=>({...x,importedBy:me.email,importedAt:new Date().toISOString()}));
   const r=await request('/rest/v1/rpc/horizon_import',{method:'POST',body:{p_ideas:ideas,p_projects:projects}});if(!r.ok)return result(res,409,{error:'Import stopped: a record may already exist, or linked records may be missing. No records were imported.'});return result(res,200,{imported:r.data});
  }
  if(action==='delete_project'){
   if(me.role!=='admin')return result(res,403,{error:'Administrator access required'});
   if(!ID.test(String(id||''))||!Number.isSafeInteger(revision)||revision<1)return result(res,400,{error:'Invalid project'});
   const old=await getRow('projects',id);if(!old)return result(res,404,{error:'Project not found'});if(old.record.sourceIdeaId)return result(res,400,{error:'A linked initiative cannot be deleted.'});
   const r=await request('/rest/v1/horizon_projects?id=eq.'+q(id)+'&revision=eq.'+revision,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!r.ok)throw Error('Delete failed');if(!r.data?.length)return result(res,409,{error:'This project changed. Reload before deleting.'});return result(res,200,{ok:true});
  }
  if(action==='save'){
   if(!lead||(kind==='settings'&&!settingsAdmin)||!['projects','settings'].includes(kind))return result(res,403,{error:'Access denied'});
   if(!ID.test(String(id||''))||!record||typeof record!=='object'||Array.isArray(record)||!Number.isSafeInteger(revision)||revision<0||JSON.stringify(record).length>500000||(kind==='settings'&&id!=='main'))return result(res,400,{error:'Invalid record'});
   if(kind==='projects'&&record.id!==id)return result(res,400,{error:'Invalid project ID'});
   const existing=await getRow(kind,id);if(kind==='projects'&&(record.sourceIdeaId||null)!==(existing?.record?.sourceIdeaId||null))return result(res,403,{error:'The source idea cannot be changed.'});
   const updated=await write(kind,id,record,revision);if(!updated)return result(res,409,{error:'This record changed. Reload before saving.'});return result(res,200,{row:updated});
  }
  return result(res,400,{error:'Unknown action'});
 }catch(e){console.error('Horizon data:',e.message);return result(res,503,{error:'Shared storage unavailable. Your changes were not saved.'})}
};
