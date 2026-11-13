function isOtp(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')).amr?.some(x=>x.method==='otp')===true}catch{return false}}
// TEMPORARY: preview-only Gmail administrator for delivery testing. Never merge into production.
const ADMINS = new Set(['gheorghe.iuga@blueprojects.com','gheorghe.iuga@gmail.com']);
const DOMAIN = /^(?:[^\s@]+@blueprojects\.com|gheorghe\.iuga@gmail\.com)$/i;
const url = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const respond = (res, status, body) => { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(body); };
async function supa(path, { method='GET', key=anon(), token=key, body, headers={} }={}) {
  const response = await fetch(url()+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json().catch(()=>null);return {ok:response.ok,status:response.status,data:json};
}
async function identity(req){
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('horizon_session='));const token=cookie?.slice('horizon_session='.length);if(!token)return null;
  const r=await supa('/auth/v1/user',{token});const u=r.data;
  if(!r.ok||!u?.id||!u.email_confirmed_at||!DOMAIN.test(u.email || '')||!isOtp(token))return null;
  return {id:u.id,email:u.email.toLowerCase()};
}
async function db(path,opts={}){return supa('/rest/v1/'+path,{...opts,key:service(),token:service()})}
async function profile(u){
  const find=await db(`horizon_access?user_id=eq.${encodeURIComponent(u.id)}&select=user_id,email,status,requested_at,reviewed_at,reviewed_by`);
  if(!find.ok)throw Error('Approval store unavailable');
  if(find.data.length){if(find.data[0].email.toLowerCase()!==u.email)throw Error('Account email changed; administrator intervention required');return find.data[0];}
  const row={user_id:u.id,email:u.email,status:ADMINS.has(u.email)?'approved':'pending'};
  const insert=await db('horizon_access',{method:'POST',body:row,headers:{Prefer:'resolution=ignore-duplicates,return=representation'}});
  if(!insert.ok)throw Error('Approval request could not be recorded');
  if(insert.data?.length)return insert.data[0];
  const retry=await db(`horizon_access?user_id=eq.${encodeURIComponent(u.id)}&select=user_id,email,status,requested_at,reviewed_at,reviewed_by`);
  if(!retry.ok||!retry.data?.length)throw Error('Approval request unavailable');return retry.data[0];
}
module.exports = async function(req,res){
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  if(!url()||!anon()||!service())return respond(res,503,{error:'Authentication is not configured.'});
  const origin=req.headers.origin;if(origin && origin!=='https://'+req.headers.host)return respond(res,403,{error:'Invalid origin.'});
  const body=req.body||{};const action=body.action;
  try{
    if(action==='send'){
      const email=String(body.email||'').trim().toLowerCase();if(!DOMAIN.test(email))return respond(res,400,{error:'Use your @blueprojects.com email address.'});
      const r=await supa('/auth/v1/otp',{method:'POST',body:{email,create_user:true}});
      if(!r.ok)return respond(res,400,{error:'Unable to send a code. Please try again later.'});return respond(res,200,{ok:true});
    }
    if(action==='verify'){
      const email=String(body.email||'').trim().toLowerCase(),token=String(body.code||'').trim();if(!DOMAIN.test(email)||!/^\d{6,10}$/.test(token))return respond(res,400,{error:'Enter your work email and the code from your email.'});
      const r=await supa('/auth/v1/verify',{method:'POST',body:{email,token,type:'email'}});
      if(!r.ok||!r.data?.access_token)return respond(res,401,{error:'The code is invalid or expired.'});
      res.setHeader('Set-Cookie',`horizon_session=${r.data.access_token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.min(Number(r.data.expires_in)||3600,3600)}`);return respond(res,200,{ok:true});
    }
    if(action==='signout'){res.setHeader('Set-Cookie','horizon_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return respond(res,200,{ok:true})}
    const u=await identity(req);if(!u)return respond(res,401,{error:'Please sign in with your verified work email.'});
    const mine=await profile(u);const isAdmin=ADMINS.has(u.email);
    if(action==='status')return respond(res,200,{email:u.email,status:mine.status,isAdmin});
    if(!isAdmin || mine.status!=='approved')return respond(res,403,{error:'Administrator access required.'});
    if(action==='list'){
      const r=await db('horizon_access?select=user_id,email,status,requested_at,reviewed_at,reviewed_by&order=requested_at.desc');
      if(!r.ok)throw Error('Unable to load requests');return respond(res,200,{requests:r.data});
    }
    if(action==='review'){
      const id=String(body.userId||''),status=body.status;if(!/^[a-f0-9-]{36}$/i.test(id)||!['approved','rejected'].includes(status))return respond(res,400,{error:'Invalid request.'});
      if(id===u.id)return respond(res,400,{error:'The administrator account cannot review itself.'});
      const r=await db(`horizon_access?user_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{status,reviewed_at:new Date().toISOString(),reviewed_by:u.email},headers:{Prefer:'return=representation'}});
      if(!r.ok||!r.data?.length)throw Error('Unable to update request');return respond(res,200,{request:r.data[0]});
    }
    return respond(res,400,{error:'Unknown action.'});
  }catch(e){console.error('Access request failed:',e.message);return respond(res,503,{error:'Access service unavailable. Please contact the administrator.'})}
};
