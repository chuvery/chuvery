import { get, list, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

// Immutable journal: no shared JSON index and no overwrite races.
// Single-admin, low-volume system. A database is preferable for concurrent writers.
const PREFIX='jiseong/notices/v1/';
const MAX_EVENTS=2000;
const MAX_BYTES=15000;
const access='private';
const enabled=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN);
async function allEvents(){
 let cursor,files=[];
 do {
  const page=await list({prefix:PREFIX,cursor,limit:1000,access});
  files.push(...page.blobs);
  if(files.length>MAX_EVENTS)throw new Error('journal_capacity');
  cursor=page.hasMore?page.cursor:undefined;
 }while(cursor);
 files.sort((a,b)=>a.pathname.localeCompare(b.pathname));
 const events=[];
 for(const file of files){
  const obj=await get(file.pathname,{access,useCache:false});
  if(!obj||obj.statusCode!==200)throw new Error('journal_missing');
  const json=await new Response(obj.stream).text();
  if(json.length>MAX_BYTES)throw new Error('journal_oversize');
  const e=JSON.parse(json);
  if(!e||typeof e.id!=='string'||typeof e.revision!=='string'||!['upsert','delete'].includes(e.action))throw new Error('journal_invalid');
  events.push(e);
 }
 return events;
}
function current(events){
 const byId=new Map();
 for(const e of events){
  if(e.action==='delete')byId.delete(e.id);
  else byId.set(e.id,{id:e.id,title:e.title,body:e.body,published:e.published,created_at:e.created_at,updated_at:e.at,revision:e.revision});
 }
 return [...byId.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));
}
export async function notices({publishedOnly=false}={}){
 if(!enabled())throw new Error('blob_not_configured');
 const all=current(await allEvents());
 return publishedOnly?all.filter(x=>x.published):all;
}
export async function mutate(action,input){
 if(!enabled())throw new Error('blob_not_configured');
 const entries=await allEvents(),rows=current(entries);
 if(entries.length>=MAX_EVENTS)throw new Error('journal_capacity');
 const now=new Date().toISOString(),revision=randomUUID();
 let id,created_at;
 if(action==='create'){
  if(rows.length>=100)throw new Error('notice_limit');
  id=randomUUID();created_at=now;
 }else{
  id=String(input.id||'');
  const prev=rows.find(x=>x.id===id);
  if(!prev)return {status:404,error:'not_found'};
  if(prev.revision!==input.revision)return {status:409,error:'conflict'};
  created_at=prev.created_at;
 }
 const event={action:action==='delete'?'delete':'upsert',id,revision,at:now,created_at};
 if(action!=='delete'){
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160||
    typeof input.body!=='string'||!input.body.trim()||input.body.length>10000||
    typeof input.published!=='boolean')return {status:400,error:'validation'};
  Object.assign(event,{title:input.title.trim(),body:input.body.trim(),published:input.published});
 }
 // Lexicographical order reflects server time. UUID breaks ties.
 const key=PREFIX+now.replace(/[-:.TZ]/g,'').padEnd(17,'0')+'-'+revision+'.json';
 await put(key,JSON.stringify(event),{access,addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60});
 return {status:200,id,revision,deleted:action==='delete'};
}
export const isStorageEnabled=enabled;
