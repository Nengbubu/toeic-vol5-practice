'use strict';
(() => {
 const STORAGE_KEY='toeic-vol5-notebooks-v1',EDITION='ETS-VOL5-2026';
 let state={schema:1,edition:EDITION,wrong:[],words:[],history:[],includeBlanks:false},view='wrong',attempt=makeId(),editingWord=null;
 const stamp=()=>new Date().toISOString();
 function makeId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
 const wrongId=(n,q)=>`${n}:${q}`;
 const wordId=s=>s.normalize('NFKC').trim().toLocaleLowerCase('en');
 function text(value,max,optional=false){if(optional&&value==null)return '';if(typeof value!=='string'||value.length>max)throw Error('备份包含无效或过长的文字');return value.trim()}
 function num(value,lo,hi){if(!Number.isInteger(value)||value<lo||value>hi)throw Error('备份中的题号或次数无效');return value}
 function date(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('备份日期无效');return new Date(value).toISOString()}
 function normalizeBackup(input){
  if(!input||input.schema!==1||input.edition!==EDITION||!Array.isArray(input.wrong)||!Array.isArray(input.words)||input.wrong.length>2000||input.words.length>10000)throw Error('这不是本网站的 Vol.5 学习备份');
  const wrong=input.wrong.map(r=>{const n=num(r.test,1,10),q=num(r.question,1,200),correct=EDITION_KEYS[n].answers[q-1];if(r.correct!==correct)throw Error('备份中的答案与当前版本不符');if(r.lastAnswer!==null&&!/^[ABCD]$/.test(r.lastAnswer))throw Error('备份作答选项无效');if(q>=7&&q<=31&&r.lastAnswer==='D')throw Error('Part 2 选项无效');return {id:wrongId(n,q),test:n,question:q,correct,lastAnswer:r.lastAnswer,wrongCount:num(r.wrongCount,0,1000000),blankCount:num(r.blankCount,0,1000000),mastered:r.mastered===true,note:text(r.note,3000,true),createdAt:date(r.createdAt),updatedAt:date(r.updatedAt),lastAttempt:text(r.lastAttempt,100,true)}});
  const words=input.words.map(w=>{const term=text(w.term,120);if(!term)throw Error('备份中有空白单词');const sourceTest=num(w.sourceTest||0,0,10),sourceQuestion=num(w.sourceQuestion||0,0,200);if(sourceQuestion&&!sourceTest)throw Error('单词来源缺少套题');return {id:wordId(term),term,meaning:text(w.meaning,2000,true),example:text(w.example,3000,true),note:text(w.note,3000,true),sourceTest,sourceQuestion,mastered:w.mastered===true,createdAt:date(w.createdAt),updatedAt:date(w.updatedAt)}});
  const historyInput=input.history==null?[]:input.history;if(!Array.isArray(historyInput)||historyInput.length>5000)throw Error('备份中的成绩记录无效');
  const history=historyInput.map(h=>{if(h.kind!=='RC'&&h.kind!=='FULL')throw Error('备份中的成绩记录无效');const total=h.kind==='RC'?100:200;if(!Array.isArray(h.parts)||h.parts.length!==7)throw Error('备份中的分项成绩无效');return {id:text(h.id,100),test:num(h.test,1,10),kind:h.kind,correct:num(h.correct,0,total),total,lc:num(h.lc,0,100),rc:num(h.rc,0,100),parts:h.parts.map(p=>num(p,0,54)),seconds:num(h.seconds,0,7200),at:date(h.at)}});
  if(new Set(wrong.map(r=>r.id)).size!==wrong.length||new Set(words.map(w=>w.id)).size!==words.length||new Set(history.map(h=>h.id)).size!==history.length)throw Error('备份内包含重复条目');
  return {schema:1,edition:EDITION,wrong,words,history,includeBlanks:input.includeBlanks===true};
 }
 const EXPORT_KEY='toeic-vol5-last-export';
 function showLastExport(){let at=null;try{at=localStorage.getItem(EXPORT_KEY)}catch{}$('last-export').textContent=at?'上次导出：'+new Date(at).toLocaleString('zh-CN',{dateStyle:'medium',timeStyle:'short'}):'还没有导出过备份。'}
 let storageError='';
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)state=normalizeBackup(JSON.parse(raw))}catch{storageError='学习记录读取失败；当前内容暂存于本次页面，请及时导出备份。'}
 function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageError=''}catch{storageError='浏览器未能保存记录；请在关闭页面前导出备份。'}$('notebook-storage-status').textContent=storageError;refreshCounts()}
 function refreshCounts(){const wrong=state.wrong.filter(r=>!r.mastered).length,words=state.words.length;$('nav-wrong').textContent='错题本 '+wrong;$('nav-words').textContent='单词本 '+words;$('remember-blanks').checked=state.includeBlanks}
 function message(value){$('notebook-status').textContent=value}
 function recordRound(key){
  if(!test)return;const now=stamp();let changed=false;
  for(const q of roundQuestions){const choice=answers[q]||null,correct=key[q],id=wrongId(test,q);let row=state.wrong.find(r=>r.id===id);
   if(row&&row.lastAttempt===attempt)continue;
   if(choice===correct){if(row){row.lastAnswer=choice;row.mastered=true;row.updatedAt=now;row.lastAttempt=attempt;changed=true}continue}
   if(!choice&&!state.includeBlanks)continue;
   if(!row){row={id,test,question:q,correct,lastAnswer:choice,wrongCount:0,blankCount:0,mastered:false,note:'',createdAt:now,updatedAt:now,lastAttempt:''};state.wrong.push(row)}
   row.lastAnswer=choice;row.correct=correct;row.wrongCount+=choice?1:0;row.blankCount+=choice?0:1;row.mastered=false;row.updatedAt=now;row.lastAttempt=attempt;changed=true;
  }
  const kind=roundQuestions.length===200?'FULL':roundQuestions.length===100&&roundQuestions[0]===101?'RC':null;
  if(kind&&!state.history.some(h=>h.id===attempt)){const limit=kind==='FULL'?7200:4500,ok=q=>answers[q]===key[q],count=qs=>qs.filter(ok).length;state.history.push({id:attempt,test,kind,correct:count(roundQuestions),total:roundQuestions.length,lc:count(roundQuestions.filter(q=>q<=100)),rc:count(roundQuestions.filter(q=>q>100)),parts:parts.map(([a,b])=>count(roundQuestions.filter(q=>q>=a&&q<=b))),seconds:Math.max(0,Math.min(limit,Math.round(limit-remaining))),at:now});if(state.history.length>5000)state.history.shift();changed=true}
  if(changed)persist();$('saved-wrong-status').textContent='错题已保存至当前浏览器；答错会自动收录'+(state.includeBlanks?'，未答也收录。':'，未答暂不收录。');
 }
 function node(tag,value,cls){const e=document.createElement(tag);if(value!=null)e.textContent=value;if(cls)e.className=cls;return e}
 function sourceLabel(n,q){return n?'Test '+String(n).padStart(2,'0')+(q?' · 第 '+q+' 题':''):'自选单词'}
 function partOf(q){return parts.findIndex(([a,b])=>q>=a&&q<=b)+1}
 function setView(next){view=next;stopTimer();stopSegment();$('welcome').hidden=true;$('practice').hidden=true;$('study-library').hidden=false;$('wrong-library').hidden=next!=='wrong';$('word-library').hidden=next!=='words';$('library-title').textContent=next==='wrong'?'把错过的，学会。':'把生词，变成自己的词。';$('library-eyebrow').textContent=next==='wrong'?'WRONG ANSWERS':'MY VOCABULARY';refreshCounts();renderLibrary();window.scrollTo(0,0)}
 function resume(){ $('study-library').hidden=true;$('welcome').hidden=Boolean(test);$('practice').hidden=!test;window.scrollTo(0,0)}
 function renderLibrary(){if(view==='wrong')renderWrong();else renderWords()}
 function wrongRows(withPart=true){const n=+$('wrong-test-filter').value,part=+$('wrong-part-filter').value,filter=$('wrong-status-filter').value,search=$('wrong-search').value.trim().toLowerCase(),sort=$('wrong-sort').value;const byQuestion=(a,b)=>a.test-b.test||a.question-b.question;return state.wrong.filter(r=>(!n||r.test===n)&&(!withPart||!part||partOf(r.question)===part)&&(filter==='all'||(filter==='mastered'?r.mastered:!r.mastered))&&(!search||(sourceLabel(r.test,r.question)+' '+r.note).toLowerCase().includes(search))).sort(sort==='count'?(a,b)=>b.wrongCount+b.blankCount-a.wrongCount-a.blankCount||byQuestion(a,b):sort==='recent'?(a,b)=>(b.updatedAt>a.updatedAt?1:b.updatedAt<a.updatedAt?-1:0)||byQuestion(a,b):byQuestion)}
 function renderPartCounts(){const rows=wrongRows(false);$('wrong-parts').replaceChildren(...parts.map((_,i)=>{const c=rows.filter(r=>partOf(r.question)===i+1).length;const b=button('Part '+(i+1)+'：'+c+' 题',()=>{$('wrong-part-filter').value=$('wrong-part-filter').value===String(i+1)?'0':String(i+1);renderWrong()});b.disabled=!c;b.setAttribute('aria-pressed',String($('wrong-part-filter').value===String(i+1)));return b}))}
 function wrongCard(r,withTest){
  const card=node('article',null,'note-card'),title=node('div',null,'note-card-head'),times=r.wrongCount+r.blankCount;
  title.append(node('h3',(withTest?sourceLabel(r.test)+' · ':'')+'第 '+r.question+' 题 · Part '+partOf(r.question)),node('span',r.mastered?'已掌握':'待复习','note-badge'));
  const meta=node('p',null,'note-meta');meta.append(node('span',times?'错 '+times+' 次':'手动加入','wrong-count'+(times>=3?' many':'')),' '+(r.lastAnswer?'上次选 '+r.lastAnswer:'上次未答')+' · 正确 '+r.correct+(r.blankCount?' · 其中未答 '+r.blankCount+' 次':'')+' · 最近 '+new Date(r.updatedAt).toLocaleDateString('zh-CN'));
  card.append(title,meta);return card;
 }
 function renderWrong(){
  const rows=wrongRows(),list=$('wrong-list');list.replaceChildren();$('wrong-summary').textContent=state.wrong.length?'共 '+state.wrong.length+' 题 · 待复习 '+state.wrong.filter(r=>!r.mastered).length+' 题 · 当前显示 '+rows.length+' 题':'还没有错题。交卷后会自动记录答错的题。';
  renderPartCounts();
  if(!rows.length){list.append(node('p','这里暂时没有符合筛选条件的错题。','empty-note'));return}
  const flat=$('wrong-sort').value!=='question',groups=flat?[0]:[...new Set(rows.map(r=>r.test))];
  for(const n of groups){
   const group=node('section',null,'notebook-group');
   if(!flat){const head=node('div',null,'notebook-group-head'),selected=rows.filter(r=>r.test===n&&!r.mastered);head.append(node('h2','Test '+String(n).padStart(2,'0')));if(selected.length)head.append(button('重做这套错题（'+selected.length+'）',()=>practiceSaved(n,selected.map(r=>r.question))));group.append(head)}
   for(const r of flat?rows:rows.filter(r=>r.test===n)){
    const card=wrongCard(r,flat);
    const notes=node('textarea');notes.rows=2;notes.maxLength=3000;notes.value=r.note;notes.placeholder='记下原因、语法或容易混淆的地方';notes.setAttribute('aria-label',sourceLabel(r.test,r.question)+'错题笔记');card.append(notes);
    const actions=node('div',null,'note-actions');actions.append(button('重做本题',()=>practiceSaved(r.test,[r.question])),button('保存笔记',()=>{r.note=notes.value.trim();r.updatedAt=stamp();persist();message('笔记已保存。')}),button(r.mastered?'恢复待复习':'标记已掌握',()=>{r.mastered=!r.mastered;r.updatedAt=stamp();persist();renderWrong()}),button('记单词',()=>openWordForm(r.test,r.question)));card.append(actions);group.append(card)
   }list.append(group)
  }
 }
 async function practiceSaved(n,qs){await openTest(n);roundQuestions=[...new Set(qs)].sort((a,b)=>a-b);question=roundQuestions[0];answers={};graded=null;submitted=false;remaining=roundQuestions.length*36;attempt=makeId();$('pdf-section').value=question<=100?'LC':'RC';showBook();drawClock();render();$('session-status').textContent='错题练习：本轮 '+roundQuestions.length+' 题，答对后标记已掌握。'}
 function openWordForm(n=0,q=0){setView('words');clearWordForm();$('word-test').value=String(n);$('word-question').value=q?String(q):'';$('word-term').focus()}
 function clearWordForm(){editingWord=null;for(const id of ['word-term','word-meaning','word-example','word-note','word-question'])$(id).value='';$('word-test').value='0';$('word-save').textContent='加入单词本';$('word-cancel').hidden=true}
 function fillWordForm(w){editingWord=w.id;$('word-term').value=w.term;$('word-meaning').value=w.meaning;$('word-example').value=w.example;$('word-note').value=w.note;$('word-test').value=String(w.sourceTest);$('word-question').value=w.sourceQuestion||'';$('word-save').textContent='保存修改';$('word-cancel').hidden=false;$('word-form').scrollIntoView({behavior:'smooth',block:'start'})}
 function saveWord(input){const term=text(input.term,120),id=wordId(term);if(!term)throw Error('请先填写单词或短语');const values={id,term,meaning:text(input.meaning,2000,true),example:text(input.example,3000,true),note:text(input.note,3000,true),sourceTest:num(input.sourceTest,0,10),sourceQuestion:num(input.sourceQuestion,0,200),updatedAt:stamp()};if(values.sourceQuestion&&!values.sourceTest)throw Error('请为来源题号选择套题');const existing=state.words.find(w=>w.id===id);if(editingWord&&editingWord!==id&&existing)throw Error('这个单词已存在，请直接编辑原条目');let row=editingWord?state.words.find(w=>w.id===editingWord):existing;if(!row){if(state.words.length>=10000)throw Error('单词条目已达到10000条，请先导出备份');row={id,createdAt:values.updatedAt,mastered:false};state.words.push(row)}Object.assign(row,values);persist();return row}
 function renderWords(){
  const search=$('word-search').value.trim().toLowerCase(),filter=$('word-status-filter').value,hidden=$('word-hide-meanings').checked;
  const rows=state.words.filter(w=>(filter==='all'||(filter==='mastered'?w.mastered:!w.mastered))&&(!search||(w.term+' '+w.meaning+' '+w.note).toLowerCase().includes(search))).sort((a,b)=>a.term.localeCompare(b.term,'en'));
  $('word-summary').textContent='共 '+state.words.length+' 个词 · 已掌握 '+state.words.filter(w=>w.mastered).length+' 个 · 当前显示 '+rows.length+' 个';const list=$('word-list');list.replaceChildren();if(!rows.length)list.append(node('p','把今天遇到的第一个生词记在上面。','empty-note'));
  for(const w of rows){const card=node('article',null,'note-card'),head=node('div',null,'note-card-head');head.append(node('h3',w.term),node('span',w.mastered?'已掌握':'学习中','note-badge'));card.append(head,node('p',sourceLabel(w.sourceTest,w.sourceQuestion),'note-meta'));const meaning=node('p',w.meaning||'尚未填写释义','word-meaning');meaning.hidden=hidden;card.append(meaning);if(w.example)card.append(node('p',w.example,'word-example'));if(w.note)card.append(node('p',w.note,'note-meta'));const actions=node('div',null,'note-actions');if(hidden)actions.append(button('显示释义',()=>{meaning.hidden=!meaning.hidden}));actions.append(button('编辑',()=>fillWordForm(w)),button(w.mastered?'继续学习':'标记已掌握',()=>{w.mastered=!w.mastered;w.updatedAt=stamp();persist();renderWords()}));if(w.sourceQuestion)actions.append(button('打开来源题',()=>practiceSaved(w.sourceTest,[w.sourceQuestion])));card.append(actions);list.append(card)}
 }
 function backup(){return {schema:1,edition:EDITION,exportedAt:stamp(),wrong:state.wrong,words:state.words,history:state.history,includeBlanks:state.includeBlanks}}
 function mergeBackup(input){const incoming=normalizeBackup(input);let added=0;for(const row of incoming.history)if(!state.history.some(h=>h.id===row.id)){state.history.push(row);added++}state.history.sort((a,b)=>a.at<b.at?-1:1);for(const field of ['wrong','words'])for(const row of incoming[field]){const index=state[field].findIndex(old=>old.id===row.id);if(index<0){state[field].push(row);added++}else if(row.updatedAt>state[field][index].updatedAt){const old=state[field][index];state[field][index]=field==='wrong'?{...row,wrongCount:Math.max(old.wrongCount,row.wrongCount),blankCount:Math.max(old.blankCount,row.blankCount)}:row}}persist();renderLibrary();return added}
 const originalReset=resetSession;resetSession=function(){attempt=makeId();return originalReset()};
 const originalScore=showScore;showScore=function(key){originalScore(key);recordRound(key);render()};
 function addCurrentWrong(){
  if(!test)return;const id=wrongId(test,question),now=stamp();let row=state.wrong.find(r=>r.id===id);
  if(row){row.mastered=false;row.updatedAt=now}
  else{row={id,test,question,correct:EDITION_KEYS[test].answers[question-1],lastAnswer:answers[question]||null,wrongCount:0,blankCount:0,mastered:false,note:'',createdAt:now,updatedAt:now,lastAttempt:''};state.wrong.push(row)}
  persist();render();
 }
 const originalRender=render;render=function(){
  originalRender();if(!test)return;
  const rows=new Map(state.wrong.filter(r=>r.test===test).map(r=>[r.question,r])),row=rows.get(question),times=row?row.wrongCount+row.blankCount:0;
  $('wrong-history').hidden=!row;
  if(row)$('wrong-history').textContent=(times?'这题以前错过 '+times+' 次':'这题在错题本里')+(row.mastered?' · 已掌握':' · 待复习')+(row.note?' · 笔记：'+row.note:'');
  $('add-wrong').disabled=Boolean(row&&!row.mastered);$('add-wrong').textContent=row&&!row.mastered?'已在错题本':'＋错题本';
  for(const b of $('question-map').children){const r=rows.get(+b.textContent),n=r?r.wrongCount+r.blankCount:0;if(n)b.dataset.wrong=n>9?'9+':String(n);else delete b.dataset.wrong;b.classList.toggle('wrong-done',Boolean(r&&r.mastered))}
 };
 const originalOpen=openTest;openTest=async function(n){$('study-library').hidden=true;await originalOpen(n)};
 const originalRetry=$('retry').onclick;$('retry').onclick=()=>{attempt=makeId();return originalRetry()};
 $('nav-practice').onclick=resume;$('nav-wrong').onclick=()=>setView('wrong');$('nav-words').onclick=()=>setView('words');$('add-current-word').onclick=()=>openWordForm(test,question);$('add-wrong').onclick=addCurrentWrong;
 $('remember-blanks').onchange=()=>{state.includeBlanks=$('remember-blanks').checked;persist()};
 for(const id of ['wrong-test-filter','wrong-part-filter','wrong-status-filter','wrong-sort'])$(id).onchange=renderWrong;$('wrong-search').oninput=renderWrong;for(const id of ['word-status-filter','word-hide-meanings'])$(id).onchange=renderWords;$('word-search').oninput=renderWords;
 $('word-cancel').onclick=clearWordForm;
 $('word-form').onsubmit=e=>{e.preventDefault();try{const input={term:$('word-term').value,meaning:$('word-meaning').value,example:$('word-example').value,note:$('word-note').value,sourceTest:+$('word-test').value,sourceQuestion:+$('word-question').value};const same=state.words.find(w=>w.id===wordId(input.term));if(same&&!editingWord){fillWordForm(same);message('这个单词已存在，已打开原条目供你编辑。');return}if(input.sourceQuestion&&!input.sourceTest)throw Error('请为来源题号选择套题');saveWord(input);clearWordForm();renderWords();message('单词已保存。')}catch(err){message(err.message)}};
 $('export-notebooks').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(backup(),null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='TOEIC-learning-backup-'+stamp().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);try{localStorage.setItem(EXPORT_KEY,stamp())}catch{}showLastExport();message('备份已导出。换电脑后在同一网站导入即可。')};
 $('import-notebooks').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('备份文件超过 8 MB');const added=mergeBackup(JSON.parse(await file.text()));message('备份已合并，新增 '+added+' 条；较新的记录会保留。')}catch(err){message('导入失败：'+err.message)}finally{e.target.value=''}};
 window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue)try{state=normalizeBackup(JSON.parse(event.newValue));refreshCounts();if(!$('study-library').hidden)renderLibrary()}catch{}});
 $('notebook-storage-status').textContent=storageError;refreshCounts();showLastExport();
 window.StudyStore={snapshot:()=>JSON.parse(JSON.stringify(backup())),history:()=>state.history.slice(),normalizeBackup,mergeBackup,saveWord,recordRound,practiceSaved,storageKey:STORAGE_KEY};
})();
