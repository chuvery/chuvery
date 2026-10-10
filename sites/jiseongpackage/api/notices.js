import { neon } from '@neondatabase/serverless';
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'method'}));}
 if(!process.env.JISEONG_PREVIEW_DATABASE_URL){res.statusCode=503;return res.end(JSON.stringify({error:'not_configured'}));}
 try{
  const sql=neon(process.env.JISEONG_PREVIEW_DATABASE_URL);
  const id=req.query?.id;
  if(id!==undefined){if(!/^[1-9][0-9]{0,15}$/.test(String(id))||!Number.isSafeInteger(Number(id))){res.statusCode=400;return res.end(JSON.stringify({error:'id'}));}
   const rows=await sql`SELECT id,title,body,created_at FROM admin_notices WHERE id=${Number(id)} AND published=true LIMIT 1`;
   res.statusCode=rows.length?200:404;return res.end(JSON.stringify(rows.length?{notice:rows[0]}:{error:'not_found'}));
  }
  const rows=await sql`SELECT id,title,body,created_at FROM admin_notices WHERE published=true ORDER BY created_at DESC LIMIT 100`;
  res.statusCode=200;return res.end(JSON.stringify({rows}));
 }catch{res.statusCode=500;return res.end(JSON.stringify({error:'storage_unavailable'}));}
}
