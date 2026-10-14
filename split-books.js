'use strict';
(() => {
 const splitFiles=new Map(),splitUrls=new Map(),originalImport=importBook,originalShow=showBook;
 function splitName(name){const m=name.match(/^Test-(\d{2})-(LC|RC)\.pdf$/i);return m?{n:+m[1],section:m[2].toUpperCase()}:null}
 // 只做文件名和大小检查，SHA-256 在第一次打开时校验，避免一次性读取 500MB 题册。
 function registerSplitBook(file){
  const id=splitName(file.name),expected=id&&SPLIT_BOOK_FINGERPRINTS[id.n]?.[id.section];
  if(!expected||file.size!==expected.size)return false;
  const key=id.n+':'+id.section;
  if(splitUrls.has(key)){URL.revokeObjectURL(splitUrls.get(key));splitUrls.delete(key)}
  splitFiles.set(key,file);return true;
 }
 async function ensureUrl(key){
  if(splitUrls.has(key))return splitUrls.get(key);
  const file=splitFiles.get(key),[n,section]=key.split(':'),url=URL.createObjectURL(file);
  if(await hashKey(url)!==SPLIT_BOOK_FINGERPRINTS[n][section].sha256){URL.revokeObjectURL(url);splitFiles.delete(key);throw Error('Test '+n.padStart(2,'0')+' '+section+' 校验失败，未套用。请重新解压资料包。')}
  splitUrls.set(key,url);return url;
 }
 importBook=async function(section,file){
  if(!file)return;
  const id=splitName(file.name);
  if(!id)return originalImport(section,file);
  if(id.section!==section||!registerSplitBook(file))throw Error('分套题册未匹配：请确认套题与 LC / RC 类型。');
  await ensureUrl(id.n+':'+section);
  status('Test '+String(id.n).padStart(2,'0')+' '+section+' 分套题册已匹配。');
  if(test===id.n)showBook();
 };
 showBook=async function(){
  const section=$('pdf-section').value,n=test,key=n+':'+section;
  if(!splitFiles.has(key))return originalShow();
  $('pdf-page-note').textContent='正在校验 '+section+' 题册…';
  try{
   const url=await ensureUrl(key);
   if(test!==n||$('pdf-section').value!==section)return;
   $('pdf-page-note').textContent=section+' · Test '+String(n).padStart(2,'0')+' · 分套题册';
   $('paper-frame').hidden=false;$('open-paper').hidden=false;$('paper-frame').src=url+'#page=1';$('open-paper').href=url+'#page=1';
  }catch(err){if(test===n){originalShow();$('pdf-page-note').textContent=err.message}}
 };
 $('pdf-section').onchange=showBook;
 // 本机服务器上与网站并排的资料文件夹：直接用地址打开，不读入内存。
 window.registerSplitBookUrl=(n,section,url)=>{const key=n+':'+section;splitFiles.set(key,null);splitUrls.set(key,url)};
 window.registerSplitBook=registerSplitBook;
 window.hasSplitBook=(n,section)=>splitFiles.has(n+':'+section);
 window.splitBookCount=()=>splitFiles.size;
})();
