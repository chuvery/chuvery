const list=document.getElementById('live-notices');
fetch('/api/notices',{headers:{Accept:'application/json'}})
.then(r=>{if(!r.ok)throw Error('unavailable');return r.json()})
.then(({rows})=>{
 list.replaceChildren();
 if(!rows.length){const p=document.createElement('p');p.textContent='등록된 공지사항이 없습니다.';list.append(p);return}
 for(const n of rows){const article=document.createElement('article');article.className='notice-row';
 const type=document.createElement('span');type.className='type';type.textContent='공지';
 const content=document.createElement('div');const h=document.createElement('h3');const a=document.createElement('a');a.href='/notice?id='+encodeURIComponent(n.id);a.textContent=n.title;h.append(a);content.append(h);
 const summary=document.createElement('p');summary.textContent=String(n.body).slice(0,160);content.append(summary);
 const date=document.createElement('time');date.textContent=String(n.created_at).slice(0,10);article.append(type,content,date);list.append(article)}
 if(new URLSearchParams(location.search).has('id')){
   const id=new URLSearchParams(location.search).get('id');const item=rows.find(x=>String(x.id)===id);
   if(item){list.replaceChildren();const article=document.createElement('article');const h=document.createElement('h2');h.textContent=item.title;const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=item.body;const back=document.createElement('a');back.href='/notice';back.textContent='공지 목록으로';article.append(h,p,back);list.append(article);}
 }
}).catch(()=>{/* Keep existing static notice until database is configured. */});
