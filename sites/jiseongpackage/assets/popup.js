const dialog=document.getElementById('notice-popup');
if(dialog&&typeof dialog.showModal==='function'){
 fetch('/api/popup',{headers:{Accept:'application/json'}})
 .then(r=>{if(!r.ok)throw Error('unavailable');return r.json()})
 .then(({popup})=>{
  if(!popup)return;
  const key='jiseong-popup:'+popup.id+':'+popup.day;
  try{if(localStorage.getItem(key)==='dismissed')return}catch{}
  dialog.querySelector('[data-popup-title]').textContent=popup.title;
  dialog.querySelector('[data-popup-body]').textContent=popup.body;
  dialog.querySelector('[data-popup-link]').href='/notice?id='+encodeURIComponent(popup.id);
  const close=()=>dialog.close();
  dialog.querySelector('[data-popup-close]').addEventListener('click',close,{once:true});
  dialog.querySelector('[data-popup-today]').addEventListener('click',()=>{
   try{localStorage.setItem(key,'dismissed')}catch{}
   close();
  },{once:true});
  dialog.showModal();
 }).catch(()=>{});
}
