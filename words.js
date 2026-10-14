'use strict';
(() => {
 const POS={'名词':'n.','动词':'v.','形容词':'adj.','副词':'adv.','介词':'prep.','连词':'conj.','代词':'pron.','感叹词':'interj.','缩写':'abbr.','冠词':'art.','数词':'num.','前缀':'prefix','后缀':'suffix','短语':'phr.'};
 const cache=new Map(),pad=n=>String(n).padStart(2,'0');

 // —— 查释义：先用 Google 翻译的词典结果（按词性列出），失败时退回 MyMemory ——
 async function lookup(term){
  const q=term.trim(),key=q.toLowerCase();if(!q)return '';if(cache.has(key))return cache.get(key);
  let meaning='';
  try{
   const r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&hl=zh-CN&dj=1&dt=t&dt=bd&q='+encodeURIComponent(q));
   if(r.ok){const j=await r.json(),dict=(j.dict||[]).map(d=>(POS[d.pos]||d.pos)+' '+d.terms.slice(0,4).join('；'));meaning=dict.length?dict.join('  '):(j.sentences||[]).map(x=>x.trans||'').join('').trim()}
  }catch{}
  if(!meaning)try{const r=await fetch('https://api.mymemory.translated.net/get?langpair=en|zh-CN&q='+encodeURIComponent(q));meaning=((await r.json()).responseData?.translatedText||'').trim()}catch{}
  if(meaning.toLowerCase()===key)meaning='';
  if(meaning)cache.set(key,meaning);return meaning;
 }
 function speak(term){
  if(!term||!('speechSynthesis' in window))return;speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(term),voice=speechSynthesis.getVoices().find(v=>/^en[-_]US/i.test(v.lang));
  u.lang='en-US';u.rate=.9;if(voice)u.voice=voice;speechSynthesis.speak(u);
 }
 window.speakWord=speak;
 if('speechSynthesis' in window)speechSynthesis.getVoices();

 // 输入单词后自动填释义；释义框被手动改过就不再覆盖。
 function autoMeaning(termEl,meaningEl,say){
  let timer=0,seq=0,pending=null;
  meaningEl.addEventListener('input',()=>{meaningEl.dataset.auto=''});
  const canFill=()=>!meaningEl.value||meaningEl.dataset.auto==='1';
  function run(term){
   const id=++seq;say('正在查释义…');
   pending=lookup(term).then(m=>{if(id!==seq||termEl.value.trim()!==term)return;if(canFill()){meaningEl.value=m;meaningEl.dataset.auto=m?'1':''}say(m?'释义来自 Google 翻译，可以修改。':'没查到释义，可以自己填。')});
   return pending;
  }
  termEl.addEventListener('input',()=>{clearTimeout(timer);const term=termEl.value.trim();if(!term){seq++;if(canFill()){meaningEl.value='';meaningEl.dataset.auto=''}return}if(canFill())timer=setTimeout(()=>run(term),400)});
  return {
   flush(){clearTimeout(timer);const term=termEl.value.trim();if(term&&canFill()&&!meaningEl.value)return run(term);return pending||Promise.resolve()},
   reset(){clearTimeout(timer);seq++;pending=null;meaningEl.dataset.auto=''}
  };
 }

 // —— 练习页：就地记单词，不离开答题页 ——
 const qwSay=t=>{$('qw-status').textContent=t},quick=autoMeaning($('qw-term'),$('qw-meaning'),qwSay);
 function renderRecent(){
  const list=StudyStore.words().filter(w=>w.sourceTest===test).sort((a,b)=>a.createdAt<b.createdAt?1:-1),box=$('qw-recent');
  box.replaceChildren();if(!list.length)return;
  box.append(Object.assign(document.createElement('span'),{className:'small',textContent:'本套已记 '+list.length+' 个：'}));
  for(const w of list.slice(0,12)){const b=button(w.term+(w.meaning?' · '+w.meaning.split(/\s{2}|；/)[0]:''),()=>speak(w.term));b.title=(w.meaning||'')+(w.sourceQuestion?'（第 '+w.sourceQuestion+' 题）':'');b.type='button';box.append(b)}
 }
 function openQuick(){$('quick-word').hidden=false;$('add-current-word').setAttribute('aria-expanded','true');renderRecent();$('qw-term').focus()}
 function closeQuick(){$('quick-word').hidden=true;$('add-current-word').setAttribute('aria-expanded','false');$('add-current-word').focus()}
 $('add-current-word').onclick=()=>$('quick-word').hidden?openQuick():closeQuick();
 $('qw-close').onclick=closeQuick;
 $('qw-speak').onclick=()=>speak($('qw-term').value.trim());
 $('quick-word').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeQuick()}});
 $('quick-word').onsubmit=async e=>{
  e.preventDefault();const term=$('qw-term').value.trim();if(!term){$('qw-term').focus();return}
  await quick.flush();
  const existing=StudyStore.words().find(w=>w.id===StudyStore.wordId(term));
  if(existing)qwSay('「'+existing.term+'」已经在单词本里了'+(existing.meaning?'：'+existing.meaning:'')+'。');
  else try{StudyStore.addWord({term,meaning:$('qw-meaning').value,example:'',note:'',sourceTest:test,sourceQuestion:question});qwSay('已保存「'+term+'」· Test '+pad(test)+' 第 '+question+' 题。')}catch(err){qwSay(err.message);return}
  $('qw-term').value='';$('qw-meaning').value='';quick.reset();renderRecent();$('qw-term').focus();
 };
 const originalOpen=openTest;openTest=async function(n){$('quick-word').hidden=true;$('add-current-word').setAttribute('aria-expanded','false');return originalOpen(n)};

 // —— 单词本表单：同样自动查释义 ——
 const formLookup=autoMeaning($('word-term'),$('word-meaning'),t=>{$('notebook-status').textContent=t});
 const originalSubmit=$('word-form').onsubmit;
 $('word-form').onsubmit=async e=>{e.preventDefault();await formLookup.flush();originalSubmit.call($('word-form'),e);if(!$('word-meaning').value)formLookup.reset()};

 // —— 卡片复习 ——
 let queue=[],current=null,known=0,mastered=0,total=0;
 function reviewInfo(){const n=StudyStore.words().filter(w=>!w.mastered).length;$('word-review-start').disabled=!n;$('word-review-info').textContent=n?'待复习 '+n+' 个词，不认识次数多的优先。':'没有待复习的单词。'}
 function showReview(on){$('word-review').hidden=!on;for(const el of [$('word-form'),$('word-list'),$('word-summary'),document.querySelector('#word-library .notebook-filters'),document.querySelector('.review-bar')])el.hidden=on}
 function shuffle(list){for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}return list}
 function start(){
  queue=shuffle(StudyStore.words().filter(w=>!w.mastered)).sort((a,b)=>(b.missCount||0)-(a.missCount||0));
  if(!queue.length)return reviewInfo();
  total=queue.length;known=0;mastered=0;showReview(true);next();window.scrollTo(0,0);
 }
 function next(){
  current=queue.shift();
  if(!current){$('wr-term').textContent='本轮复习完成';$('wr-source').textContent='复习 '+total+' 个词 · 新掌握 '+mastered+' 个';$('wr-answer').hidden=true;$('wr-speak').hidden=true;$('wr-show').hidden=true;$('wr-no').hidden=true;$('wr-yes').hidden=true;$('wr-progress').textContent='';$('wr-exit').focus();return}
  $('wr-term').textContent=current.term;$('wr-speak').hidden=false;
  $('wr-source').textContent=(current.sourceTest?'Test '+pad(current.sourceTest)+(current.sourceQuestion?' · 第 '+current.sourceQuestion+' 题':''):'自选单词')+' · 连续认识 '+(current.streak||0)+' / 3'+(current.missCount?' · 不认识过 '+current.missCount+' 次':'');
  $('wr-meaning').textContent=current.meaning||'（没有填写释义）';$('wr-example').textContent=current.example||'';$('wr-example').hidden=!current.example;
  $('wr-answer').hidden=true;$('wr-show').hidden=false;$('wr-no').hidden=true;$('wr-yes').hidden=true;
  $('wr-progress').textContent='已认识 '+known+' / '+total+' · 还剩 '+(queue.length+1)+' 张';$('wr-show').focus();speak(current.term);
 }
 function reveal(){if(!current)return;$('wr-answer').hidden=false;$('wr-show').hidden=true;$('wr-no').hidden=false;$('wr-yes').hidden=false;$('wr-yes').focus()}
 function grade(ok){
  if(!current||$('wr-answer').hidden)return;
  if(ok){current.streak=(current.streak||0)+1;known++;if(current.streak>=3){current.mastered=true;mastered++}}
  else{current.missCount=(current.missCount||0)+1;current.streak=0;queue.push(current)}
  current.updatedAt=new Date().toISOString();StudyStore.commit();next();
 }
 function exit(){current=null;queue=[];showReview(false);StudyStore.renderWords();reviewInfo()}
 $('word-review-start').onclick=start;$('wr-show').onclick=reveal;$('wr-no').onclick=()=>grade(false);$('wr-yes').onclick=()=>grade(true);$('wr-exit').onclick=exit;$('wr-speak').onclick=()=>current&&speak(current.term);
 document.addEventListener('keydown',e=>{
  if($('word-review').hidden||$('study-library').hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){exit();e.preventDefault()}
  else if(e.key===' '&&!$('wr-show').hidden){reveal();e.preventDefault()}
  else if(e.key==='1')grade(false);else if(e.key==='2')grade(true);
 });
 new MutationObserver(()=>{if(!$('word-library').hidden){if(!$('word-review').hidden&&!current)exit();reviewInfo()}}).observe($('word-library'),{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(()=>{if($('study-library').hidden&&!$('word-review').hidden)exit()}).observe($('study-library'),{attributes:true,attributeFilter:['hidden']});
 reviewInfo();
})();
