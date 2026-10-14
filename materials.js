'use strict';
(() => {
 const DB_NAME='toeic-vol5-materials',STORE='handles',HANDLE_KEY='root',canPick='showDirectoryPicker' in window;
 const isBook=name=>/^Test-\d{2}-(LC|RC)\.pdf$/i.test(name),isClip=name=>Boolean(clipIdentity(name));
 function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
 async function tx(mode,fn){const conn=await db();try{return await new Promise((resolve,reject)=>{const t=conn.transaction(STORE,mode),req=fn(t.objectStore(STORE));t.oncomplete=()=>resolve(req&&req.result);t.onerror=t.onabort=()=>reject(t.error)})}finally{conn.close()}}
 const saveHandle=h=>tx('readwrite',s=>s.put(h,HANDLE_KEY)).catch(()=>{});
 const loadHandle=()=>tx('readonly',s=>s.get(HANDLE_KEY)).catch(()=>null);
 const dropHandle=()=>tx('readwrite',s=>s.delete(HANDLE_KEY)).catch(()=>{});
 function setStatus(text,warn=false){$('materials-status').textContent=text;$('materials-status').classList.toggle('warning',warn)}
 function showButtons({connect=true,reconnect=null,forget=false}){
  $('connect-folder').hidden=!connect||!canPick;$('folder-fallback').hidden=!connect||canPick;
  $('reconnect-folder').hidden=!reconnect;if(reconnect)$('reconnect-folder').textContent='重新连接「'+reconnect+'」';
  $('forget-folder').hidden=!forget;
 }
 // 资料包可能被解压在多层目录里；只向下找 4 层，避免误扫整个磁盘。
 async function collect(dir,depth=0,out=[]){
  for await(const [name,handle] of dir.entries()){
   if(name.startsWith('.'))continue;
   if(handle.kind==='file'){if(isBook(name)||isClip(name))out.push(await handle.getFile())}
   else if(depth<4)await collect(handle,depth+1,out);
  }
  return out;
 }
 function ingest(list){
  let books=0,clips=0,rejected=0;const audio=[];
  for(const file of list){if(isBook(file.name)){registerSplitBook(file)?books++:rejected++}else if(isClip(file.name))audio.push(file)}
  if(audio.length)clips=addAudio(audio);
  if(!books&&!clips)throw Error('没有找到 Test-01-RC.pdf 或 E26-T01-01.mp3 这类文件。请选择解压后的 TOEIC-2026-Vol5-10Tests 文件夹。');
  const tests=new Set([...audioFiles.values()].map(x=>x.n)).size;
  setStatus('已连接：题册 '+splitBookCount()+' / 20 份 · 音频 '+audioFiles.size+' / 540 段（'+tests+' 套）'+(rejected?' · '+rejected+' 份题册大小不符，已跳过':'')+'。打开任意一套即可使用。',Boolean(rejected));
  status('资料已载入，可以开始练习。');
  listTests();if(test){showBook();renderSegments()}
 }
 async function useHandle(handle){
  setStatus('正在读取「'+handle.name+'」…');
  ingest(await collect(handle));
  showButtons({connect:true,forget:true});
 }
 async function connect(){
  let handle;
  try{handle=await showDirectoryPicker({id:'toeic-materials',mode:'read'})}catch(err){if(err.name!=='AbortError')setStatus('无法打开文件夹：'+err.message,true);return}
  try{await useHandle(handle);await saveHandle(handle)}catch(err){setStatus(err.message,true)}
 }
 async function restore(){
  if(!canPick){showButtons({});return}
  const handle=await loadHandle();
  if(!handle){showButtons({});return}
  try{
   if(await handle.queryPermission({mode:'read'})==='granted'){await useHandle(handle);return}
  }catch{}
  showButtons({connect:true,reconnect:handle.name,forget:true});
  setStatus('上次使用的资料文件夹是「'+handle.name+'」。点一下重新连接即可，无需再逐个选择文件。');
  $('reconnect-folder').onclick=async()=>{try{if(await handle.requestPermission({mode:'read'})!=='granted')throw Error('浏览器未授予读取权限。');await useHandle(handle)}catch(err){setStatus(err.message,true)}};
 }
 // 用 启动网站.cmd 在本机打开时，资料文件夹与网站文件夹并排，可直接按 manifest.json 读取。
 const LOCAL_ROOTS=['../TOEIC-2026-Vol5-10Tests/','../toeic-vol5-materials/'];
 async function autoLoad(){
  if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))return false;
  for(const root of LOCAL_ROOTS){
   let manifest;try{const res=await fetch(root+'manifest.json',{cache:'no-cache'});if(!res.ok)continue;manifest=await res.json()}catch{continue}
   if(!Array.isArray(manifest.tests))continue;
   for(const t of manifest.tests){
    for(const section of ['LC','RC'])if(t.pdfs?.[section]?.file)registerSplitBookUrl(t.test,section,root+t.pdfs[section].file);
    for(const a of t.audio||[]){const id=clipIdentity(a.file.split('/').pop());if(id)audioFiles.set(id.n+':'+id.first,{url:root+a.file,...id})}
   }
   setStatus('已自动载入本机资料：题册 '+splitBookCount()+' / 20 份 · 音频 '+audioFiles.size+' / 540 段。打开任意一套即可使用。');
   $('audio-import-status').textContent='已读取 '+audioFiles.size+' 个分段文件。';
   status('资料已载入，可以开始练习。');listTests();if(test){showBook();renderSegments()}
   return true;
  }
  return false;
 }
 $('connect-folder').onclick=connect;
 $('materials-input').onchange=e=>{try{ingest(e.target.files)}catch(err){setStatus(err.message,true)}finally{e.target.value=''}};
 $('forget-folder').onclick=async()=>{await dropHandle();showButtons({});setStatus('已忘记文件夹。本页已载入的资料在刷新前仍可使用。')};
 autoLoad().then(ok=>{if(!ok)restore()});
})();
