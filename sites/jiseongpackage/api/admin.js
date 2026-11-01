import { notices, mutate, isStorageEnabled, uploadNoticeImage, imageStorageReport, cleanupOrphanImages } from './_notice-store.js';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const COOKIE='js_admin';
const TTL=60*60*4;
// Defense in depth only: per-instance counters are not a distributed/global rate limit.
const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_MAX_ATTEMPTS=5;
const LOGIN_BUCKET_LIMIT=500;
const loginFailures=new Map();
function clientIP(req){
 const raw=req.headers['x-forwarded-for'];
 const value=typeof raw==='string'?raw.split(',')[0].trim():'';
 return value&&value.length<=64?value:'unknown';
}
function loginBucket(req){
 const now=Date.now();
 if(loginFailures.size>LOGIN_BUCKET_LIMIT){
  for(const [ip,v] of loginFailures){if(v.until<=now)loginFailures.delete(ip);}
  if(loginFailures.size>LOGIN_BUCKET_LIMIT)loginFailures.clear();
 }
 const ip=clientIP(req);
 let v=loginFailures.get(ip);
 if(v&&v.until<=now){loginFailures.delete(ip);v=undefined;}
 return {ip,v};
}
function registerLoginFailure(ip,v){
 const count=(v?.count||0)+1;
 loginFailures.set(ip,{count,until:Date.now()+LOGIN_WINDOW_MS});
}
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
const b64=x=>Buffer.from(x).toString('base64url');
const clean=x=>typeof x==='string'?x.trim():'';
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const mac=(x,key)=>createHmac('sha256',key).update(x).digest('base64url');
function cookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function valid(req,key){
 const [payload,sig]=cookie(req).split('.');
 if(!payload||!sig||!eq(mac(payload,key),sig))return false;
 try{const x=JSON.parse(Buffer.from(payload,'base64url').toString());return x.role==='admin'&&Number.isFinite(x.exp)&&Date.now()<x.exp;}catch{return false;}
}
function originOK(req){const host=req.headers['x-forwarded-host']||req.headers.host;const origin=req.headers.origin;if(!origin||!host)return false;try{const u=new URL(origin);return u.protocol==='https:'&&u.host===host;}catch{return false;}}
function parse(req){return new Promise((ok,bad)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1500000){bad(new Error('too_large'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(s||'{}'));}catch{bad(new Error('invalid_json'));}});req.on('error',bad);});}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return send(res,405,{error:'method'});
 const key=process.env.JISEONG_SESSION_SECRET;
 const username=process.env.JISEONG_ADMIN_USER;
 const hash=process.env.JISEONG_ADMIN_SCRYPT_HASH;
 if(!key||key.length<32||!username||!hash)return send(res,503,{error:'admin_not_configured'});
 if(req.method==='GET')return send(res,200,{authenticated:valid(req,key)});
 if(!originOK(req))return send(res,403,{error:'origin'});
 let body;try{body=await parse(req);}catch{return send(res,400,{error:'invalid_request'});}
 if(!body||typeof body!=='object'||Array.isArray(body))return send(res,400,{error:'invalid_request'});
 const action=clean(body.action);
 if(action==='login'){
   const {ip,v}=loginBucket(req);
   if(v&&v.count>=LOGIN_MAX_ATTEMPTS){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((v.until-Date.now())/1000))));return send(res,429,{error:'too_many_login_attempts'});}
   const [salt,expected]=hash.split(':');let computed='';
   if(salt&&expected&&/^[0-9a-f]{32,128}$/i.test(expected)&&/^[0-9a-f]{32,128}$/i.test(salt)&&clean(body.password).length<=200)
    computed=scryptSync(String(body.password),Buffer.from(salt,'hex'),expected.length/2).toString('hex');
   if(clean(body.username)!==username||!computed||!eq(computed,expected)){registerLoginFailure(ip,v);return send(res,401,{error:'invalid_credentials'});}
   loginFailures.delete(ip);
   const payload=b64(JSON.stringify({role:'admin',exp:Date.now()+TTL*1000,nonce:randomBytes(16).toString('hex')}));
   res.setHeader('Set-Cookie',COOKIE+'='+payload+'.'+mac(payload,key)+'; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age='+TTL);
   return send(res,200,{authenticated:true});
 }
 if(action==='logout'){res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0');return send(res,200,{authenticated:false});}
 if(!valid(req,key))return send(res,401,{error:'unauthorized'});
 if(!isStorageEnabled())return send(res,503,{error:'blob_not_configured'});
 try{
  if(action==='list')return send(res,200,{rows:await notices()});
  if(action==='image_report'){const r=await imageStorageReport();const {candidate_paths,...safe}=r;return send(res,200,safe);}
  if(action==='image_cleanup')return send(res,200,await cleanupOrphanImages());
  if(action==='upload_image'){const result=await uploadNoticeImage(body.data,body.content_type);return send(res,result.status,result.status===200?result:{error:result.error});}
  if(['create','update','delete'].includes(action)){
   const out=await mutate(action,body);
   return send(res,out.status,out.status===200?out:{error:out.error});
  }
  return send(res,400,{error:'unknown_action'});
 }catch(e){return send(res,e.message==='journal_capacity'?507:500,{error:'storage_unavailable'});}

}
