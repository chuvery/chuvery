import { getNoticeImage, isStorageEnabled } from './_notice-store.js';
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;return res.end();}
 if(!isStorageEnabled()){res.statusCode=503;return res.end();}
 try{
  const id=req.query?.id;
  if(typeof id!=='string'){res.statusCode=400;return res.end();}
  const image=await getNoticeImage(id);
  if(!image){res.statusCode=404;return res.end();}
  res.statusCode=200;res.setHeader('Content-Type',image.contentType);
  const reader=image.stream.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;res.write(Buffer.from(value));}
  return res.end();
 }catch{res.statusCode=500;return res.end();}
}
