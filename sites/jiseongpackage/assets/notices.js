const list=document.getElementById('live-notices');
if(list){
 const params=new URLSearchParams(location.search);
 const id=params.get('id');
 const make=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');return el};
 const fallback=()=>{if(id){list.replaceChildren(make('p','공지사항을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.'));}/* Keep the existing static notice if the list service is unavailable. */};
 const run=async()=>{
  if(id!==null&&!/^[1-9][0-9]{0,15}$/.test(id)){list.replaceChildren(make('p','잘못된 공지사항 주소입니다.'));return}
  const url=id!==null?'/api/notices?id='+encodeURIComponent(id):'/api/notices';
  const response=await fetch(url,{headers:{Accept:'application/json'},credentials:'omit'});
  if(response.status===404&&id!==null){list.replaceChildren(make('p','존재하지 않거나 공개되지 않은 공지사항입니다.'));return}
  if(!response.ok)throw Error('unavailable');
  const result=await response.json();
  list.replaceChildren();
  if(id!==null){
   const n=result.notice;
   if(!n||String(n.id)!==id)throw Error('invalid_notice');
   const article=document.createElement('article');
   const h=make('h2',n.title),body=make('p',n.body),back=document.createElement('a');
   body.style.whiteSpace='pre-wrap';back.href='/notice';back.textContent='공지 목록으로';
   article.append(h,body,back);list.append(article);return;
  }
  const rows=Array.isArray(result.rows)?result.rows:[];
  if(!rows.length){list.append(make('p','등록된 공지사항이 없습니다.'));return}
  for(const n of rows){
   const article=document.createElement('article');article.className='notice-row';
   const type=make('span','공지');type.className='type';
   const content=document.createElement('div'),h=document.createElement('h3'),a=make('a',n.title);
   a.href='/notice?id='+encodeURIComponent(n.id);h.append(a);content.append(h,make('p',String(n.body??'').slice(0,160)));
   const date=make('time',String(n.created_at??'').slice(0,10));
   article.append(type,content,date);list.append(article);
  }
 };
 run().catch(fallback);
}
