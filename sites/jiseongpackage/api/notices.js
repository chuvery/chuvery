import { notices, isStorageEnabled } from './_notice-store.js';
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'method'}));}
 if(!isStorageEnabled()){res.statusCode=503;return res.end(JSON.stringify({error:'not_configured'}));}
 try{
  const rows=(await notices({publishedOnly:true})).map(({id,title,body,created_at,image_key})=>({id,title,body,created_at,has_image:!!image_key}));
  const id=req.query?.id;
  if(id!==undefined){
   if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)){res.statusCode=400;return res.end(JSON.stringify({error:'id'}));}
   const row=rows.find(x=>x.id===id);
   res.statusCode=row?200:404;
   return res.end(JSON.stringify(row?{notice:row}:{error:'not_found'}));
  }
  res.statusCode=200;return res.end(JSON.stringify({rows}));
 }catch{res.statusCode=500;return res.end(JSON.stringify({error:'storage_unavailable'}));}
}
