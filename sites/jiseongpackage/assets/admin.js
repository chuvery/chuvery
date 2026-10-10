const $=id=>document.getElementById(id);const status=t=>$('status').textContent=t;let rows=[];let saving=false;const escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(body){const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});const x=await r.json();if(!r.ok)throw Error(x.error||'요청 실패');return x}function mode(auth){$('signin').hidden=auth;$('workspace').hidden=!auth}async function refresh(){const x=await api({action:'list'});rows=x.rows;const root=$('notices');root.replaceChildren();rows.forEach(row=>{const el=document.createElement('article'),heading=document.createElement('strong'),info=document.createElement('p'),edit=document.createElement('button'),del=document.createElement('button');heading.textContent=row.title;info.textContent=row.published?'공개':'비공개';edit.textContent='수정';del.textContent='삭제';edit.onclick=()=>{$('noticeid').value=row.id; $('noticeid').dataset.revision=row.revision;$('title').value=row.title;$('body').value=row.body;$('published').checked=row.published;$('popup_enabled').checked=!!row.popup_enabled;$('popup_start').value=row.popup_start||'';$('popup_end').value=row.popup_end||'';$('image_key').value=row.image_key||'';$('image_state').textContent=row.image_key?'이미지 연결됨':'연결된 이미지 없음';window.scrollTo(0,0)};del.onclick=async()=>{if(!confirm('공지를 삭제할까요?'))return;try{await api({action:'delete',id:row.id,revision:row.revision});await refresh();status('삭제되었습니다')}catch(e){status(e.message)}};el.append(heading,info,edit,del);root.append(el)})}function reset(){HTMLFormElement.prototype.reset.call($('editor'));$('noticeid').value='';delete $('noticeid').dataset.revision;$('image_state').textContent='연결된 이미지 없음'}$('login').addEventListener('submit',async e=>{e.preventDefault();try{await api({action:'login',username:$('username').value,password:$('password').value});$('password').value='';mode(true);await refresh();status('로그인되었습니다')}catch(e){status(e.message)}});$('editor').addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const saveButton=$('editor').querySelector('button[type="submit"],button:not([type])');saveButton.disabled=true;const id=$('noticeid').value;try{await api({action:id?'update':'create',...(id?{id,revision:$('noticeid').dataset.revision}:{}),title:$('title').value,body:$('body').value,published:$('published').checked,popup_enabled:$('popup_enabled').checked,popup_start:$('popup_start').value,popup_end:$('popup_end').value,image_key:$('image_key').value});reset();await refresh();status('저장되었습니다')}catch(e){status(e.message)}finally{saving=false;saveButton.disabled=false}});$('reset').onclick=reset;$('logout').onclick=async()=>{await api({action:'logout'});mode(false);status('로그아웃되었습니다')};fetch('/api/admin',{credentials:'same-origin'}).then(async r=>{const x=await r.json();if(r.status===503){mode(false);$('login').querySelector('button').disabled=true;status('관리자 서비스가 아직 설정되지 않았습니다.');return}if(!r.ok)throw Error(x.error||'상태 확인 실패');mode(!!x.authenticated);if(x.authenticated)await refresh();else status('관리자 로그인 필요')}).catch(()=>{mode(false);status('관리자 서비스 연결을 확인해 주세요.')});

// Client-side quality-first optimization; never enlarge originals or distort their aspect ratio.
async function prepareImage(file){
 const accepted=['image/png','image/jpeg','image/webp'];
 if(!accepted.includes(file.type)||file.size>12*1024*1024||file.size<12)throw Error('PNG·JPG·WebP, 원본 12MB 이하만 가능합니다.');
 if(!('createImageBitmap' in window))throw Error('현재 브라우저에서 이미지 변환을 지원하지 않습니다.');
 const bitmap=await createImageBitmap(file);
 try{
  const maxEdge=2000,ratio=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*ratio)),height=Math.max(1,Math.round(bitmap.height*ratio));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{alpha:true});if(!context)throw Error('이미지를 처리할 수 없습니다.');
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(bitmap,0,0,width,height);
  const make=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  // High quality first: never use low-quality iterative compression.
  // Keep already-small originals intact; especially avoid damaging text and transparency.
  if(file.size<=1024*1024)return file;
  const options=[];
  if(file.type==='image/png')options.push(['image/png',undefined]);
  options.push(['image/webp',0.92],['image/webp',0.86]);
  let selected=null;
  for(const [type,quality] of options){
   const blob=await make(type,quality);
   if(!blob||blob.type!==type)continue;
   if(blob.size<=1024*1024){selected=blob;break;}
  }
  if(!selected)throw Error('화질을 유지하면 1MB를 초과합니다. 이미지를 조금 줄여 다시 시도해 주세요.');
  return selected;
 }finally{bitmap.close();}
}
$('upload_image').onclick=async()=>{
 const file=$('image_file').files[0];
 if(!file){status('업로드할 이미지를 선택해 주세요.');return;}
 const button=$('upload_image');button.disabled=true;
 try{
  $('image_state').textContent='이미지 품질을 유지하며 처리 중…';
  const optimized=await prepareImage(file);
  const bytes=await optimized.arrayBuffer();
  let binary='';for(const x of new Uint8Array(bytes))binary+=String.fromCharCode(x);
  const result=await api({action:'upload_image',data:btoa(binary),content_type:optimized.type});
  $('image_key').value=result.image_key;
  $('image_state').textContent='업로드 완료: '+Math.round(file.size/1024)+'KB → '+Math.round(optimized.size/1024)+'KB. 공지 저장을 눌러 연결해 주세요.';
  status('이미지 업로드 완료. 공지를 저장해 주세요.');
 }catch(e){$('image_state').textContent='이미지 연결 상태는 변경되지 않았습니다.';status('이미지 업로드 오류: '+e.message)}
 finally{button.disabled=false;}
};
$('remove_image').onclick=()=>{$('image_key').value='';$('image_file').value='';$('image_state').textContent='연결 해제 대기. 공지를 저장하면 반영됩니다.';};
