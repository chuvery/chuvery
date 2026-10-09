const db=process.env.JP_SUPABASE_URL, key=process.env.JP_SUPABASE_ANON_KEY;
function send(res,status,obj){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(obj));}
function configured(){return !!(db&&/^https:\/\/[\w.-]+\.supabase\.co$/.test(db)&&key);}
function getCookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('jp_session='))?.slice(11)||''}
function originOK(req){const host=req.headers.host||'';const origin=req.headers.origin||'';return !!origin&&new URL(origin).host===host&&new URL(origin).protocol==='https:';}
async function query(path,token,opt={}){const u=db+'/rest/v1/'+path;const response=await fetch(u,{method:opt.method||'GET',headers:{apikey:key,authorization:'Bearer '+(token||key),'content-type':'application/json',prefer:opt.prefer||'return=representation'},body:opt.body?JSON.stringify(opt.body):undefined});const str=await response.text();let data;try{data=str?JSON.parse(str):null}catch{data=null}return {status:response.status,data};}
async function session(req){const token=getCookie(req);if(!token)return null;const r=await fetch(db+'/auth/v1/user',{headers:{apikey:key,authorization:'Bearer '+token}});if(!r.ok)return null;return token;}
async function isAdmin(token){const r=await query('jp_admins?select=user_id&limit=1',token);return r.status===200&&Array.isArray(r.data)&&r.data.length>0;}
function cookie(res,value,maxAge){res.setHeader('Set-Cookie','jp_session='+value+'; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age='+maxAge)}
export default async function handler(req,res){
 if(!configured())return send(res,503,{error:'관리자 기능 준비 중'});
 const method=req.method,op=String(req.query?.op||'');
 if(method!=='GET'&&!originOK(req))return send(res,403,{error:'잘못된 요청 출처'});
 if(op==='login'&&method==='POST'){
  const {email,password}=req.body||{};if(typeof email!=='string'||typeof password!=='string'||email.length>200||password.length>200)return send(res,400,{error:'입력값 오류'});
  const r=await fetch(db+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({email,password})});
  if(!r.ok)return send(res,401,{error:'로그인 실패'});
  const data=await r.json();if(!data.access_token||!(await isAdmin(data.access_token)))return send(res,403,{error:'관리자 계정이 아닙니다'});
  cookie(res,data.access_token,Math.min(data.expires_in||3600,3600));return send(res,200,{ok:true});
 }
 if(op==='logout'&&method==='POST'){cookie(res,'',0);return send(res,200,{ok:true})}
 if(op==='public'&&method==='GET'){
  const r=await query('jp_notices?select=id,title,body,created_at&is_published=eq.true&order=created_at.desc&limit=50',key);
  return send(res,r.status===200?200:502,r.status===200?{items:r.data}:{error:'공지사항을 읽을 수 없습니다'});
 }
 if(op==='popup-public'&&method==='GET'){const r=await query('jp_popups?select=id,title,image_url,notice_id,starts_at,ends_at&is_enabled=eq.true&starts_at=lte.'+encodeURIComponent(new Date().toISOString())+'&ends_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1',key);return send(res,r.status===200?200:502,r.status===200?{items:r.data}:{error:'팝업 조회 실패'});}
 const token=await session(req);if(!token||!(await isAdmin(token)))return send(res,401,{error:'관리자 로그인이 필요합니다'});
 if(op==='popup-list'&&method==='GET'){const r=await query('jp_popups?select=id,title,image_url,notice_id,starts_at,ends_at,is_enabled&order=created_at.desc&limit=30',token);return send(res,r.status===200?200:502,r.status===200?{items:r.data}:{error:'팝업 목록 실패'});}
 if(op==='popup-save'&&method==='POST'){
 const b=req.body||{};const title=String(b.title||'').trim(),img=String(b.image_url||'').trim();
 if(!title||title.length>120||!/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/.test(img))return send(res,400,{error:'팝업 정보 오류'});
 const start=new Date(b.starts_at),end=new Date(b.ends_at);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return send(res,400,{error:'기간 오류'});
 if(b.id&&!/^[0-9a-f-]{36}$/i.test(b.id))return send(res,400,{error:'ID 오류'});
 if(b.notice_id&&!/^[0-9a-f-]{36}$/i.test(b.notice_id))return send(res,400,{error:'공지 ID 오류'});
 const data={title,image_url:img,starts_at:start.toISOString(),ends_at:end.toISOString(),notice_id:b.notice_id||null,is_enabled:b.is_enabled===true};
 const q=b.id?await query('jp_popups?id=eq.'+encodeURIComponent(b.id),token,{method:'PATCH',body:data}):await query('jp_popups',token,{method:'POST',body:data});
 return send(res,q.status<300?200:502,q.status<300?{item:q.data?.[0]}:{error:'저장 실패'});
 }
 if(op==='popup-delete'&&method==='POST'){const id=req.body?.id;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:'ID 오류'});const r=await query('jp_popups?id=eq.'+encodeURIComponent(id),token,{method:'DELETE'});return send(res,r.status<300?200:502,{ok:r.status<300});}
 if(op==='me'&&method==='GET')return send(res,200,{admin:true});
 if(op==='list'&&method==='GET'){const r=await query('jp_notices?select=id,title,body,is_published,created_at&order=created_at.desc&limit=100',token);return send(res,r.status===200?200:502,r.status===200?{items:r.data}:{error:'목록 조회 실패'})}
 if(op==='save'&&method==='POST'){
  const b=req.body||{},title=String(b.title||'').trim(),body=String(b.body||'').trim(),is_published=b.is_published===true;
  if(!title||title.length>140||!body||body.length>20000)return send(res,400,{error:'제목·본문 길이를 확인하세요'});
  if(b.id&& !/^[0-9a-f-]{36}$/i.test(b.id))return send(res,400,{error:'게시물 ID 오류'});
  const r=b.id?await query('jp_notices?id=eq.'+encodeURIComponent(b.id),token,{method:'PATCH',body:{title,body,is_published,updated_at:new Date().toISOString()}}):await query('jp_notices',token,{method:'POST',body:{title,body,is_published}});
  return send(res,r.status>=200&&r.status<300?200:502,r.status>=200&&r.status<300?{item:r.data?.[0]}:{error:'게시물 저장 실패'});
 }
 if(op==='delete'&&method==='POST'){
  const id=req.body?.id;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:'게시물 ID 오류'});
  const r=await query('jp_notices?id=eq.'+encodeURIComponent(id),token,{method:'DELETE'});
  return send(res,r.status<300?200:502,{ok:r.status<300});
 }
 return send(res,405,{error:'지원하지 않는 요청'});
}
