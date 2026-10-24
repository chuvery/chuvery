const $=id=>document.getElementById(id);const status=t=>$('status').textContent=t;let rows=[];let saving=false;const escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(body){const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});const x=await r.json();if(!r.ok)throw Error(x.error||'요청 실패');return x}function mode(auth){$('signin').hidden=auth;$('workspace').hidden=!auth}async function refresh(){const x=await api({action:'list'});rows=x.rows;const root=$('notices');root.replaceChildren();rows.forEach(row=>{const el=document.createElement('article'),heading=document.createElement('strong'),info=document.createElement('p'),edit=document.createElement('button'),del=document.createElement('button');heading.textContent=row.title;info.textContent=row.published?'공개':'비공개';edit.textContent='수정';del.textContent='삭제';edit.onclick=()=>{hideSaveResult();$('editor_heading').textContent='공지 수정 · '+row.title;$('save_notice').textContent='변경사항 저장';$('editor_mode').textContent='기존 공지 내용을 수정하고 공지 저장을 눌러야 변경이 반영됩니다.';$('noticeid').value=row.id; $('noticeid').dataset.revision=row.revision;$('title').value=row.title;$('body').value=row.body;$('published').checked=row.published;$('popup_enabled').checked=!!row.popup_enabled;$('popup_start').value=row.popup_start||'';$('popup_end').value=row.popup_end||'';$('image_key').value=row.image_key||'';$('image_state').textContent=row.image_key?'이미지 연결됨':'연결된 이미지 없음';window.scrollTo(0,0)};del.onclick=async()=>{if(del.dataset.confirmDelete!==row.id){del.dataset.confirmDelete=row.id;del.textContent='삭제 확인';status('이 공지를 삭제하려면 같은 공지의 삭제 확인 버튼을 다시 누르세요.');return;}del.disabled=true;try{await api({action:'delete',id:row.id,revision:row.revision});await refresh();status('삭제되었습니다')}catch(e){del.disabled=false;del.dataset.confirmDelete='';del.textContent='삭제';status('삭제 실패: '+e.message)}};el.append(heading,info,edit,del);root.append(el)})}function hideSaveResult(){$('save_result').hidden=true;$('save_result').replaceChildren()}function reset(){HTMLFormElement.prototype.reset.call($('editor'));$('noticeid').value='';delete $('noticeid').dataset.revision;$('save_notice').textContent='공지 등록하기';$('image_key').value='';$('image_file').value='';$('image_state').textContent='연결된 이미지 없음';$('editor_heading').textContent='새 공지 작성';$('editor_mode').textContent='공지 제목과 내용을 작성하세요.'}function showSaveResult(message,id,published){const el=$('save_result');el.replaceChildren();const title=document.createElement('strong');title.textContent=message;el.append(title);const desc=document.createElement('p');desc.textContent=published?'홈페이지에 공개된 공지입니다.':'비공개로 저장됐습니다.';el.append(desc);if(published&&id){const link=document.createElement('a');link.href='/notice?id='+encodeURIComponent(id);link.target='_blank';link.rel='noopener';link.textContent='홈페이지에 표시된 공지 확인하기 ↗';el.append(link)}else{const note=document.createElement('p');note.textContent='비공개 공지는 홈페이지에 표시되지 않습니다.';el.append(note)}el.hidden=false;el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true})}$('login').addEventListener('submit',async e=>{e.preventDefault();try{await api({action:'login',username:$('username').value,password:$('password').value});$('password').value='';mode(true);await refresh();status('로그인되었습니다')}catch(e){status(e.message)}});$('editor').addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const saveButton=$('editor').querySelector('button[type="submit"],button:not([type])');saveButton.disabled=true;const id=$('noticeid').value;hideSaveResult();const published=$('published').checked;status('공지 저장 중…');let saved=false;try{const result=await api({action:id?'update':'create',...(id?{id,revision:$('noticeid').dataset.revision}:{}),title:$('title').value,body:$('body').value,published,popup_enabled:$('popup_enabled').checked,popup_start:$('popup_start').value,popup_end:$('popup_end').value,image_key:$('image_key').value});saved=true;$('noticeid').value=result.id||id;$('noticeid').dataset.revision=result.revision;$('editor_heading').textContent='공지 수정 · '+$('title').value;$('save_notice').textContent='변경사항 저장';$('editor_mode').textContent=published?'공개 중':'비공개';showSaveResult(id?'변경사항이 저장됐습니다.':'공지 등록이 완료됐습니다.',result.id||id,published);status('공지 저장 완료');try{await refresh()}catch(e){status('저장은 완료됐지만 목록을 불러오지 못했습니다. 새로고침해 주세요.')}}catch(e){status('저장 실패: '+(e.message==='popup_validation'?'팝업 공지는 공개 상태여야 하며 시작일·종료일을 올바르게 입력해야 합니다.':e.message));if(!saved){const el=$('save_result');el.hidden=false;el.textContent='저장되지 않았습니다. 입력 내용은 그대로 남아 있습니다. 오류를 확인한 뒤 다시 시도하세요.'}}finally{saving=false;saveButton.disabled=false}});$('reset').onclick=()=>{if(($('title').value.trim()||$('body').value.trim())&&!confirm('현재 내용을 닫고 새 공지를 작성할까요? 저장하지 않은 변경사항은 사라집니다.'))return;reset();hideSaveResult();$('title').focus();status('새 공지를 작성할 수 있습니다. 아직 저장된 내용은 없습니다.')};$('logout').onclick=async()=>{await api({action:'logout'});mode(false);status('로그아웃되었습니다')};fetch('/api/admin',{credentials:'same-origin'}).then(async r=>{const x=await r.json();if(r.status===503){mode(false);$('login').querySelector('button').disabled=true;status('관리자 서비스가 아직 설정되지 않았습니다.');return}if(!r.ok)throw Error(x.error||'상태 확인 실패');mode(!!x.authenticated);if(x.authenticated)await refresh();else status('관리자 로그인 필요')}).catch(()=>{mode(false);status('관리자 서비스 연결을 확인해 주세요.')});

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
