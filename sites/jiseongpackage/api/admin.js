import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const COOKIE='js_admin';
const TTL=60*60*4;
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
function parse(req){return new Promise((ok,bad)=>{let s='';req.on('data',c=>{s+=c;if(s.length>14000){bad(new Error('too_large'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(s||'{}'));}catch{bad(new Error('invalid_json'));}});req.on('error',bad);});}
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
 const action=clean(body.action);
 if(action==='login'){
   const [salt,expected]=hash.split(':');let computed='';
   if(salt&&expected&&/^[0-9a-f]{32,128}$/i.test(expected)&&/^[0-9a-f]{32,128}$/i.test(salt)&&clean(body.password).length<=200)
    computed=scryptSync(String(body.password),Buffer.from(salt,'hex'),expected.length/2).toString('hex');
   if(clean(body.username)!==username||!computed||!eq(computed,expected))return send(res,401,{error:'invalid_credentials'});
   const payload=b64(JSON.stringify({role:'admin',exp:Date.now()+TTL*1000,nonce:randomBytes(16).toString('hex')}));
   res.setHeader('Set-Cookie',COOKIE+'='+payload+'.'+mac(payload,key)+'; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age='+TTL);
   return send(res,200,{authenticated:true});
 }
 if(action==='logout'){res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0');return send(res,200,{authenticated:false});}
 if(!valid(req,key))return send(res,401,{error:'unauthorized'});
 if(!process.env.JISEONG_PREVIEW_DATABASE_URL)return send(res,503,{error:'database_not_configured'});
 try{
  const sql=neon(process.env.JISEONG_PREVIEW_DATABASE_URL);
  if(action==='list'){const rows=await sql`SELECT id,title,body,published,created_at,updated_at FROM admin_notices ORDER BY created_at DESC LIMIT 100`;return send(res,200,{rows});}
  if(action==='create'||action==='update'){
   const title=clean(body.title),content=clean(body.body);
   if(!title||title.length>160||!content||content.length>10000||typeof body.published!=='boolean')return send(res,400,{error:'validation'});
   if(action==='create'){const rows=await sql`INSERT INTO admin_notices(title,body,published) VALUES(${title},${content},${body.published}) RETURNING id`;return send(res,200,{id:rows[0].id});}
   const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1)return send(res,400,{error:'id'});
   const rows=await sql`UPDATE admin_notices SET title=${title},body=${content},published=${body.published},updated_at=now() WHERE id=${id} RETURNING id`;return send(res,rows.length?200:404,rows.length?{id:rows[0].id}:{error:'not_found'});
  }
  if(action==='delete'){const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1)return send(res,400,{error:'id'});const rows=await sql`DELETE FROM admin_notices WHERE id=${id} RETURNING id`;return send(res,rows.length?200:404,rows.length?{deleted:true}:{error:'not_found'});}
  return send(res,400,{error:'unknown_action'});
 }catch{return send(res,500,{error:'storage_unavailable'});}
}
