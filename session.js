'use strict';
(() => {
 const SESSION_KEY='toeic-vol5-session-v1',PREFS_KEY='toeic-vol5-prefs-v1',KIND_LABEL={RC:'阅读',FULL:'听力＋阅读'};
 const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
 const write=(key,value)=>{try{value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value))}catch{}};
 const pad=n=>String(n).padStart(2,'0'),label=n=>'Test '+pad(n);
 let prefs={autoNext:false,continuous:false,...read(PREFS_KEY)},saveTimer=0;

 // —— 作答进度自动保存 ——
 function snapshot(){
  if(!test||submitted)return null;
  const left=running?remaining-(Date.now()-startedAt)/1000:remaining;
  return {v:1,test,mode:$('practice-mode').value,roundQuestions,question,answers,marks:[...marks],remaining:Math.max(0,Math.round(left)),savedAt:new Date().toISOString()};
 }
 function saveNow(){clearTimeout(saveTimer);const s=snapshot();if(s&&(Object.keys(s.answers).length||s.marks.length))write(SESSION_KEY,s)}
 function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,400)}
 function savedSession(){
  const s=read(SESSION_KEY);
  try{
   if(!s||s.v!==1||!Number.isInteger(s.test)||s.test<1||s.test>10||!['RC','FULL'].includes(s.mode))return null;
   const qs=s.roundQuestions;if(!Array.isArray(qs)||!qs.length||qs.some(q=>!Number.isInteger(q)||q<1||q>200)||new Set(qs).size!==qs.length)return null;
   if(!qs.includes(s.question)||!Number.isFinite(s.remaining))return null;
   const ans={};for(const [q,c] of Object.entries(s.answers||{}))if(qs.includes(+q)&&/^[ABCD]$/.test(c))ans[q]=c;
   return {...s,answers:ans,marks:(s.marks||[]).filter(q=>qs.includes(q))};
  }catch{return null}
 }
 function renderResume(){
  const s=savedSession(),card=$('resume-card');card.hidden=!s;if(!s)return;
  const done=Object.keys(s.answers).length,mins=Math.floor(s.remaining/60);
  $('resume-text').textContent=label(s.test)+' · '+(s.roundQuestions.length<100?'错题练习':KIND_LABEL[s.mode])+' · 已答 '+done+' / '+s.roundQuestions.length+' · 剩余 '+mins+' 分钟 · '+new Date(s.savedAt).toLocaleString('zh-CN',{dateStyle:'short',timeStyle:'short'});
 }
 async function resumeSession(){
  const s=savedSession();if(!s)return renderResume();
  $('practice-mode').value=s.mode;await openTest(s.test);
  roundQuestions=s.roundQuestions;answers=s.answers;marks=new Set(s.marks);question=s.question;remaining=s.remaining;
  $('pdf-section').value=question<=100?'LC':'RC';showBook();drawClock();$('start').textContent='继续计时';
  $('session-status').textContent='已恢复上次进度。计时处于暂停状态，点“继续计时”接着做。';render();
 }
 $('resume-go').onclick=resumeSession;
 $('resume-drop').onclick=()=>{if(confirm('放弃这次未交卷的进度？')){write(SESSION_KEY,null);renderResume()}};
 const originalRender=render;render=function(){originalRender();saveSoon()};
 const originalScore=showScore;showScore=function(key){originalScore(key);clearTimeout(saveTimer);write(SESSION_KEY,null)};
 setInterval(()=>{if(running)saveNow()},5000);
 window.addEventListener('pagehide',saveNow);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow()});
 $('back').addEventListener('click',saveNow);

 // —— 套题卡片与成绩记录 ——
 const history=()=>window.StudyStore?StudyStore.history():[];
 window.testCardMeta=n=>{
  const lines=[],runs=history().filter(h=>h.test===n);
  if(runs.length){const last=runs[runs.length-1];lines.push('上次 '+last.correct+'/'+last.total+' · 做过 '+runs.length+' 次')}
  else lines.push('Vol.5 · 阅读 / 全套 · 自动判分');
  if(splitBookCount()||audioFiles.size){const clips=[...audioFiles.values()].filter(x=>x.n===n).length;lines.push('题册 '+(hasSplitBook(n,'LC')?'LC✓':'LC—')+' '+(hasSplitBook(n,'RC')?'RC✓':'RC—')+' · 音频 '+clips+'/54')}
  return lines;
 };
 function duration(sec){return sec?Math.floor(sec/60)+' 分 '+pad(sec%60)+' 秒':'未计时'}
 function renderHistory(){
  const rows=history().slice(-30).reverse(),box=$('history-list');$('history').hidden=!rows.length;box.replaceChildren();if(!rows.length)return;
  const table=document.createElement('table'),head=table.createTHead().insertRow();
  for(const h of ['日期','套题','范围','正确','听力','阅读','用时'])head.append(Object.assign(document.createElement('th'),{textContent:h}));
  const body=table.createTBody();
  for(const h of rows){const tr=body.insertRow();for(const v of [new Date(h.at).toLocaleDateString('zh-CN'),label(h.test),KIND_LABEL[h.kind],h.correct+' / '+h.total+'（'+Math.round(h.correct/h.total*100)+'%）',h.kind==='FULL'?h.lc+' / 100':'—',h.rc+' / 100',duration(h.seconds)])tr.insertCell().textContent=v}
  box.append(table);
 }
 function refreshHome(){if($('welcome').hidden)return;listTests();renderHistory();renderResume()}
 new MutationObserver(refreshHome).observe($('welcome'),{attributes:true,attributeFilter:['hidden']});

 // —— 练习偏好：阅读选后自动下一题、听力连续播放 ——
 for(const [id,key] of [['auto-next','autoNext'],['segment-continuous','continuous']]){$(id).checked=prefs[key];$(id).onchange=()=>{prefs[key]=$(id).checked;write(PREFS_KEY,prefs)}}
 $('choices').addEventListener('click',e=>{if(!prefs.autoNext||submitted||question<=100||!e.target.closest('button'))return;const from=question;setTimeout(()=>{if(question===from&&answers[from])move(1)},180)});
 $('segment-audio').addEventListener('ended',()=>{
  const a=$('segment-audio'),last=+a.dataset.last;
  if(!prefs.continuous||a.loop||!last||last>=100)return;
  const next=last+1;if(!roundQuestions.includes(next))return;
  selectQuestion(next);playSegment(next);
 });

 // —— 键盘快捷键 ——
 document.addEventListener('keydown',e=>{
  const target=e.target instanceof Element?e.target:document.body;
  if($('practice').hidden||e.ctrlKey||e.metaKey||e.altKey||target.closest('input,textarea,select,[contenteditable]'))return;
  const key=e.key.toUpperCase(),choice={'1':'A','2':'B','3':'C','4':'D'}[key]||(/^[ABCD]$/.test(key)?key:null);
  if(choice){const b=[...$('choices').children].find(x=>x.textContent===choice&&!x.disabled);if(b){b.click();e.preventDefault()}return}
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){move(e.key==='ArrowRight'?1:-1);e.preventDefault();return}
  if(key==='M'){$('mark').click();return}
  if(key==='P'||(e.key===' '&&target.tagName!=='BUTTON')){const a=$('segment-audio');if(!a.hidden&&a.src){a.paused?a.play():a.pause()}else if(!$('play-question').disabled)playSegment(question);e.preventDefault()}
 });

 refreshHome();
})();
