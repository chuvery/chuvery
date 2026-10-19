const dialog=document.getElementById('notice-popup');
if(dialog&&typeof dialog.showModal==='function'){
 fetch('/api/popup',{headers:{Accept:'application/json'}})
 .then(r=>{if(!r.ok)throw Error('unavailable');return r.json()})
 .then(async ({popup})=>{
  if(!popup)return;
  const key='jiseong-popup:'+popup.id+':'+popup.day;
  try{if(localStorage.getItem(key)==='dismissed')return}catch{}
  dialog.querySelector('[data-popup-title]').textContent=popup.title;
  dialog.querySelector('[data-popup-body]').textContent=popup.body;
  dialog.querySelector('[data-popup-link]').href='/notice?id='+encodeURIComponent(popup.id);
  const photo=dialog.querySelector('[data-popup-image]');
  if(photo){
   photo.hidden=true;
   photo.removeAttribute('src');
   if(popup.has_image){
    const url='/api/notice-image?id='+encodeURIComponent(popup.id);
    // Load offscreen first so an image notice does not open as text and jump later.
    // On failure or timeout, show the text notice rather than blocking indefinitely.
    const loaded=await Promise.race([
     new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(true);
      img.onerror=()=>resolve(false);
      img.src=url;
     }),
     new Promise(resolve=>setTimeout(()=>resolve(false),2500))
    ]);
    if(loaded){photo.src=url;photo.hidden=false;}
   }
  }
  const close=()=>dialog.close();
  dialog.querySelector('[data-popup-close]').addEventListener('click',close,{once:true});
  dialog.querySelector('[data-popup-today]').addEventListener('click',()=>{
   try{localStorage.setItem(key,'dismissed')}catch{}
   close();
  },{once:true});
  dialog.showModal();
 }).catch(()=>{});
}
