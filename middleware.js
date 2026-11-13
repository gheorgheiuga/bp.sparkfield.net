import { next } from '@vercel/functions';
// TEMPORARY: exact Gmail address permitted only while testing.
const EMAIL=/^(?:[^\s@]+@blueprojects\.com|gheorghe\.iuga@gmail\.com)$/i;
const OPEN=new Set(['/login.html','/auth-gate.js','/auth-gate.css','/blue-projects-logo.png','/api/access','/favicon.ico']);
function isOtp(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).amr?.some(x=>x.method==='otp')===true}catch{return false}}
function cookie(request){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('horizon_session='))?.slice('horizon_session='.length)||''}
export default async function middleware(request){
  const path=new URL(request.url).pathname;if(OPEN.has(path))return next();
  const token=cookie(request);if(!token)return Response.redirect(new URL('/login.html',request.url),302);
  const endpoint=(process.env.SUPABASE_URL||'').replace(/\/$/,'');const anon=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!endpoint||!anon||!service)return new Response('Access service unavailable.',{status:503});
  try{
    const identity=await fetch(endpoint+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});if(!identity.ok)return Response.redirect(new URL('/login.html',request.url),302);
    const u=await identity.json();if(!u.id||!u.email_confirmed_at||!EMAIL.test(u.email||'')||!isOtp(token))return Response.redirect(new URL('/login.html',request.url),302);
    const response=await fetch(endpoint+'/rest/v1/horizon_access?user_id=eq.'+encodeURIComponent(u.id)+'&select=email,status',{headers:{apikey:service,Authorization:'Bearer '+service},cache:'no-store'});
    if(!response.ok)return new Response('Access service unavailable.',{status:503});const rows=await response.json();if(rows.length!==1||rows[0].status!=='approved'||rows[0].email.toLowerCase()!==u.email.toLowerCase())return Response.redirect(new URL('/login.html',request.url),302);
    return next({headers:{'Cache-Control':'private, no-store'}});
  }catch{return new Response('Access service unavailable.',{status:503})}
}
