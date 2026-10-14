'use strict';
(() => {
 const splitUrls=new Map(),originalImport=importBook,originalShow=showBook;
 importBook=async function(section,file){
  if(!file)return;
  const match=file.name.match(/^Test-(\d{2})-(LC|RC)\.pdf$/i);
  if(!match)return originalImport(section,file);
  const n=+match[1],actual=match[2].toUpperCase(),expected=SPLIT_BOOK_FINGERPRINTS[n]?.[actual];
  if(actual!==section||!expected||file.size!==expected.size)throw Error('分套题册未匹配：请确认套题与 LC / RC 类型。');
  const url=URL.createObjectURL(file);
  if(await hashKey(url)!==expected.sha256){URL.revokeObjectURL(url);throw Error('分套 PDF 校验失败，未套用答案。')}
  const id=n+':'+section;if(splitUrls.has(id))URL.revokeObjectURL(splitUrls.get(id));splitUrls.set(id,url);
  status('Test '+String(n).padStart(2,'0')+' '+section+' 分套题册已匹配。');
  if(test===n)showBook();
 };
 showBook=function(){const section=$('pdf-section').value,url=splitUrls.get(test+':'+section);if(!url)return originalShow();$('pdf-page-note').textContent=section+' · Test '+test+' · 分套题册';$('paper-frame').hidden=false;$('open-paper').hidden=false;$('paper-frame').src=url+'#page=1';$('open-paper').href=url+'#page=1'};
 $('pdf-section').onchange=showBook;
})();
