import { notices, isStorageEnabled } from './_notice-store.js';
import { get } from '@vercel/blob';
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'method'}));}
 if(!isStorageEnabled()){res.statusCode=503;return res.end(JSON.stringify({error:'not_configured'}));}
 let phase='date';
 try{
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  phase='notices';
  const rows=await notices({publishedOnly:true});
  const n=rows.find(x=>x.popup_enabled&&x.popup_start<=day&&x.popup_end>=day);
  if(!n){res.statusCode=200;return res.end(JSON.stringify({popup:null}));}
  let image_data=null;
  if(n.image_key){
   phase='image';
   // Use the already validated published notice: do not read the journal again for its image.
   const obj=await get(n.image_key,{access:'private',useCache:false});
   if(obj?.statusCode===200){
    const data=Buffer.from(await new Response(obj.stream).arrayBuffer());
    if(data.length>0&&data.length<=1024*1024){
     const ext=n.image_key.split('.').pop();
     const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
     image_data='data:'+mime+';base64,'+data.toString('base64');
    }
   }
  }
  phase='response';
  res.statusCode=200;
  return res.end(JSON.stringify({popup:{id:n.id,title:n.title,body:n.body.slice(0,280),has_image:!!image_data,image_data,day}}));
 }catch(error){console.error('[jiseong-popup] request failed',{name:error?.name||'Error',code:typeof error?.code==='string'?error.code.slice(0,64):'unknown',phase});res.statusCode=500;return res.end(JSON.stringify({error:'storage_unavailable'}));}
}
