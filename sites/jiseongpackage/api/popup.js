import { notices, isStorageEnabled } from './_notice-store.js';
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'method'}));}
 if(!isStorageEnabled()){res.statusCode=503;return res.end(JSON.stringify({error:'not_configured'}));}
 try{
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  const rows=await notices({publishedOnly:true});
  const n=rows.find(x=>x.popup_enabled&&x.popup_start<=day&&x.popup_end>=day);
  res.statusCode=200;return res.end(JSON.stringify({popup:n?{id:n.id,title:n.title,body:n.body.slice(0,280),has_image:!!n.image_key,day}:null}));
 }catch{res.statusCode=500;return res.end(JSON.stringify({error:'storage_unavailable'}));}
}
