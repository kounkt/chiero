import {Platform} from './platform.js';
import {LEVELS,blocker,SHAPES,newBlock,place,fits,positions,isOver,validBlock} from './models.js';
const kind=document.body.dataset.game, block=kind==='block', platform=new Platform(kind);
const $=s=>document.querySelector(s), root=$('#app');
let lang='ja', state, selected=null, candidate=null, drag=null, hint=null, hit=null, audioContext;
const t=(ja,en)=>lang==='ja'?ja:en;
const names=['みけ','すみ','むぎ'], enNames=['Mike','Sumi','Mugi'];
const fresh=()=>({version:1,cat:0,sfx:true,arrow:{level:0,unlocked:0,removed:[]},block:newBlock(Date.now()>>>0,true)});
const title=()=>block?t('ねこのまどべ','Cat Window Blocks'):t('ねこの通りみち','Cat Paths');
const snapshot=()=>({version:1,cat:state.cat,sfx:state.sfx,...(block?{block:state.block}:{arrow:state.arrow})});
function save(){platform.save(snapshot());}
function sfx(success=true){if(!state.sfx||!platform.audio||platform.paused)return;try{audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(success?660:240,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(success?880:210,audioContext.currentTime+.10);g.gain.setValueAtTime(.035,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.13);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.14);}catch{}}
const catHTML=(happy=false)=>`<span class="cat ${happy?'happy':''}" data-cat="${state.cat}" role="img" aria-label="${t(names[state.cat],enNames[state.cat])}"></span>`;
function say(ja,en){$('#instruction').textContent=t(ja,en);}
function saved(ok){if(platform.paused)return;$('#status').textContent=ok?(platform.youtube?t('進み具合を保存しました','Progress saved'):t('このブラウザに自動保存','Saved in this browser')):t('保存できませんでした。次の操作で再試行します','Could not save. Will retry on your next move.');$('#status').classList.toggle('error',!ok);}
function frame(){
 root.innerHTML=`<section class="shell"><header class="top"><h1>${title()}</h1><span class="eyebrow">${block?t('ブロックパズル','BLOCK PUZZLE'):t('矢印パズル','ARROW PUZZLE')}</span></header><div class="stats" id="stats"></div><div class="companion"><p>${block?t('ひと息、ならべよう。','A little pause. A little puzzle.'):t('すこしずつ、帰り道。','One path at a time.')}<br><small>${t('ゆっくりで、だいじょうぶ。','Take your time. You’re doing fine.')}</small></p>${catHTML()}</div><p class="instruction" id="instruction" aria-live="polite"></p><div class="play" id="play"><div id="board" class="board ${block?'grid':''}" aria-label="${t('ゲーム盤','Game board')}"></div><div class="message" id="result" hidden></div></div>${block?'<div class="tray" id="tray"></div>':''}<div class="footer"><button id="assist">${block?t('はじめから','New game'):t('ヒント','Hint')}</button><span>${t('時間制限なし','No time limit')}</span><button id="options">${t('あそび方・設定','How to play')}</button></div><p class="status" id="status" role="status">${platform.youtube?t('進み具合を自動保存','Progress saves automatically'):t('このブラウザに自動保存','Saved in this browser')}</p></section><dialog class="dialog" id="dialog"></dialog><div class="pause" id="pause" hidden>${t('一時停止中','Paused')}</div>`;
 $('#options').onclick=settings;$('#assist').onclick=block?restartPrompt:showHint;
 render(); syncPause();
}
function render(){
 if(platform.paused)return;
 document.documentElement.lang=lang;document.title=title();
 if(block)renderBlock();else renderArrow();
}
function renderArrow(){
 const a=state.arrow,L=LEVELS[a.level];
 $('#stats').innerHTML=`<span>${t('まどべ','WINDOW')}<strong>${String(a.level+1).padStart(2,'0')}</strong><span class="eyebrow"> / 30</span></span><span>${t('のこり','LEFT')} ${L.arrows.length-a.removed.length}${t(' 本','')}</span>`;
 say(a.level===0?'先が空いている矢印を、タップ。':'矢印の向きに、外へぬこう。', 'Tap an arrow with a clear path ahead.');
 const n=L.size,pad=.65;
 let dots='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)dots+=`<circle cx="${x}" cy="${y}" r=".025" fill="#d2e6df"/>`;
 let svg=`<svg class="arrows" viewBox="${-pad} ${-pad} ${n-1+pad*2} ${n-1+pad*2}" xmlns="http://www.w3.org/2000/svg">${dots}`;
 for(const arrow of L.arrows){
  if(a.removed.includes(arrow.id))continue;
  const [x,y]=arrow.cells.at(-1),[dx,dy]=arrow.dir;const tri=[[x+dx*.24,y+dy*.24],[x-dx*.13-dy*.19,y-dy*.13+dx*.19],[x-dx*.13+dy*.19,y-dy*.13-dx*.19]];
  const d=arrow.cells.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');
  const dir=dx===1?t('右','right'):dx===-1?t('左','left'):dy===1?t('下','down'):t('上','up');
  svg+=`<g class="arrow ${hint===arrow.id?'hint':''} ${hit?.id===arrow.id?'blocked':''}" data-arrow="${arrow.id}" tabindex="0" role="button" aria-label="${t('矢印','Arrow')} ${arrow.id+1}, ${dir}"><path class="arrow-hit" d="${d}"/><path class="arrow-line" d="${d}"/><polygon class="arrow-head" points="${tri.map(p=>p.join(',')).join(' ')}"/></g>`;
 }
 if(hit)svg+=`<circle class="blocker-ring" cx="${hit.cell[0]}" cy="${hit.cell[1]}" r=".39"/>`;
 $('#board').innerHTML=svg+'</svg>';
 document.querySelectorAll('[data-arrow]').forEach(el=>{el.onclick=()=>removeArrow(+el.dataset.arrow);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();removeArrow(+el.dataset.arrow);}if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();const list=[...document.querySelectorAll('[data-arrow]')],i=list.indexOf(el);list[(i+(['ArrowDown','ArrowRight'].includes(e.key)?1:list.length-1))%list.length].focus();}};});
 $('#result').hidden=a.removed.length!==L.arrows.length;
 if(a.removed.length===L.arrows.length){const last=a.level===29;$('#result').innerHTML=`${catHTML(true)}<h2>${last?t('ぜんぶ、おかえり。','All paths are home.'):t('おかえり。','Welcome home.')}</h2><p>${last?t('30のまどべを、すべてクリアしました。','You completed all 30 windows.'):t('道が、すっきりひらけました。','Every path is clear.')}</p><button class="primary" id="next">${last?t('まどべを選ぶ','Choose a window'):t('つぎのまどべへ','Next window')}</button>`;$('#next').onclick=()=>{if(last)levels();else{state.arrow={level:a.level+1,unlocked:Math.max(a.unlocked,a.level+1),removed:[]};hint=hit=null;save();render();}};}
}
function removeArrow(id){
 if(platform.paused)return;
 const a=state.arrow,L=LEVELS[a.level],arrow=L.arrows.find(x=>x.id===id);if(!arrow||a.removed.includes(id))return;
 const b=blocker(L,arrow,a.removed);hint=null;
 if(b){hit={...b,id};sfx(false);renderArrow();say('先に、丸で囲んだ道をあけよう。','Clear the circled path first.');return;}
 const focusIndex=[...document.querySelectorAll('[data-arrow]')].findIndex(el=>+el.dataset.arrow===id);
 const ghost=document.querySelector(`[data-arrow="${id}"]`)?.cloneNode(true);
 hit=null;a.removed.push(id);if(a.removed.length===L.arrows.length)a.unlocked=Math.max(a.unlocked,Math.min(29,a.level+1));sfx();save();renderArrow();
 if(ghost){ghost.removeAttribute('data-arrow');ghost.removeAttribute('tabindex');ghost.removeAttribute('role');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('class','departed');ghost.style.setProperty('--exit-x',`${arrow.dir[0]*L.size}px`);ghost.style.setProperty('--exit-y',`${arrow.dir[1]*L.size}px`);document.querySelector('.arrows').append(ghost);}
 const arrows=[...document.querySelectorAll('[data-arrow]')];if(document.activeElement===document.body)arrows[Math.min(focusIndex,arrows.length-1)]?.focus({preventScroll:true});
}
function showHint(){if(platform.paused)return;const a=state.arrow,L=LEVELS[a.level];hint=L.arrows.find(x=>!a.removed.includes(x.id)&&!blocker(L,x,a.removed))?.id;hit=null;renderArrow();say('金色の矢印は、いま通れます。','The golden arrow has a clear path.');}
function mini(shape){const w=Math.max(...shape.map(p=>p[0]))+1,h=Math.max(...shape.map(p=>p[1]))+1;return `<span class="mini-grid" style="grid-template-columns:repeat(${w},16px);grid-template-rows:repeat(${h},16px)">${shape.map(([x,y])=>`<span class="mini-cell" style="grid-column:${x+1};grid-row:${y+1}"></span>`).join('')}</span>`;}
function renderBlock(){
 const b=state.block;$('#stats').innerHTML=`<span>${t('スコア','SCORE')}<strong>${b.score.toLocaleString('en')}</strong></span><span>${t('ベスト','BEST')} ${b.best.toLocaleString('en')}</span>`;
 $('#board').innerHTML=b.grid.map((v,i)=>`<button class="cell ${v?'filled':''}" data-i="${i}" data-color="${v}" tabindex="${i===0?0:-1}" aria-label="${t('行','Row')} ${Math.floor(i/8)+1}, ${t('列','column')} ${i%8+1}, ${v?t('ブロックあり','occupied'):t('空き','empty')}"></button>`).join('');
 $('#tray').innerHTML=b.hand.map((id,i)=>`<button class="piece ${id===null?'used':''} ${i===selected?'selected':''}" data-slot="${i}" aria-pressed="${i===selected}" aria-label="${t('ピース','Piece')} ${i+1}${id===null?t(' 使用済み',' used'):`, ${SHAPES[id].length} ${t('マス','cells')}`}" ${id===null?'disabled':''}>${id===null?'<span>✓</span>':mini(SHAPES[id])}<span class="piece-label">${id===null?'':i+1}</span></button>`).join('');
 if(b.tutorial&&selected===null)selected=0;
 document.querySelectorAll('.piece').forEach(el=>{el.onclick=()=>{if(platform.paused)return;selected=+el.dataset.slot;candidate=null;paintPreview();instructionBlock();};el.onpointerdown=e=>startDrag(e,+el.dataset.slot);});
 document.querySelectorAll('.cell').forEach(el=>{el.onclick=()=>cellTap(+el.dataset.i);el.onkeydown=e=>{const i=+el.dataset.i,dx={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];if(dx){e.preventDefault();const j=Math.max(0,Math.min(63,i+dx));el.tabIndex=-1;const next=$(`[data-i="${j}"]`);next.tabIndex=0;next.focus();}};});
 paintPreview();instructionBlock();$('#result').hidden=!isOver(b);
 if(isOver(b)){$('#result').innerHTML=`${catHTML(true)}<h2>${t('いい、ひと息でした。','A lovely little pause.')}</h2><p>${t('置けるところがなくなりました。','No remaining piece fits.')}<br>${t('スコア','Score')} ${b.score.toLocaleString('en')} · ${t('ベスト','Best')} ${b.best.toLocaleString('en')}</p><button class="primary" id="again">${t('もう一度あそぶ','Play again')}</button>`;$('#again').onclick=restart;}
}
function instructionBlock(){say(state.block.tutorial?'光っている2マスの左側を、2回タップ。':selected===null?'下のブロックを選ぼう。':'置く場所をタップ。もう一度で決定。',state.block.tutorial?'Tap the left cell of the highlighted gap twice.':selected===null?'Choose a piece below.':'Tap a spot, then tap again to place.');}
function paintPreview(){
 document.querySelectorAll('.piece').forEach(el=>{const yes=+el.dataset.slot===selected;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});
 document.querySelectorAll('.cell').forEach(el=>el.classList.remove('preview','invalid'));
 const id=state.block.hand[selected];if(selected===null||id===null||id===undefined)return;
 const c=candidate||(state.block.tutorial?{x:6,y:7}:null);if(!c)return;
 const okay=fits(state.block.grid,SHAPES[id],c.x,c.y);for(const[dx,dy]of SHAPES[id]){const x=c.x+dx,y=c.y+dy;if(x>=0&&y>=0&&x<8&&y<8)$(`[data-i="${y*8+x}"]`).classList.add(okay?'preview':'invalid');}
}
function cellTap(i){
 if(platform.paused||isOver(state.block))return;
 if(selected===null){say('先に、下のブロックを選ぼう。','Choose a piece below first.');return;}
 const x=i%8,y=Math.floor(i/8);if(candidate?.x===x&&candidate?.y===y){commit(x,y);return;}candidate={x,y};paintPreview();
 if(fits(state.block.grid,SHAPES[state.block.hand[selected]],x,y))say('もう一度タップで、ここに置く。','Tap the same spot again to place.');else say('空いているところに、形を合わせよう。','Match the whole shape to empty cells.');
}
function commit(x,y){if(platform.paused)return;const result=place(state.block,selected,x,y);if(!result){sfx(false);say('ここには置けません。別の場所へ。','That piece does not fit here.');return;}state.block=result.state;selected=null;candidate=null;sfx();save();platform.score(state.block.best);renderBlock();if(result.lines){document.querySelector('.companion .cat').classList.add('happy');say(`${result.lines}ライン、すっきり！ +${result.gain}`,`${result.lines} ${result.lines===1?'line':'lines'} cleared! +${result.gain}`);}}
function pointToCell(e){const rect=$('#board').getBoundingClientRect(),pad=8,x=Math.floor((e.clientX-rect.left-pad)/(rect.width-2*pad)*8),y=Math.floor((e.clientY-rect.top-pad-(e.pointerType==='touch'?24:0))/(rect.height-2*pad)*8);return{x,y};}
function startDrag(e,slot){if(platform.paused||e.button!==0||state.block.hand[slot]===null)return;drag={slot,x:e.clientX,y:e.clientY,moved:false,pointer:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}
root.addEventListener('pointermove',e=>{if(!drag||platform.paused)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;if(!drag.moved)return;selected=drag.slot;candidate=pointToCell(e);paintPreview();});
root.addEventListener('pointerup',e=>{if(!drag)return;const was=drag;drag=null;if(was.moved){e.preventDefault();selected=was.slot;candidate=pointToCell(e);const c=candidate;commit(c.x,c.y);}});
root.addEventListener('pointercancel',()=>{drag=null;candidate=null;if(block&&state)paintPreview();});
function restart(){if(platform.paused)return;state.block=newBlock(Date.now()>>>0,false,state.block.best);selected=candidate=null;$('#dialog').close();save();render();}
function openDialog(html){if(platform.paused)return;const d=$('#dialog');d.innerHTML=html;d.showModal();d.querySelector('[data-close]')?.addEventListener('click',()=>d.close());}
function restartPrompt(){openDialog(`<h2>${t('新しく、ひと息。','Start a fresh game?')}</h2><p>${t('今の盤面とスコアをリセットします。ベストスコアは残ります。','This resets the board and current score. Your best score stays.')}</p><div class="row"><button data-close>${t('つづける','Keep playing')}</button><button class="primary" id="confirm">${t('新しくはじめる','New game')}</button></div>`);$('#confirm').onclick=restart;}
function settings(){
 openDialog(`<h2>${t('あそび方','How to play')}</h2><p>${block?t('ブロックを置いて、たて・よこの列をそろえよう。そろった列は同時に消えます。3つ使うと新しいブロックが届きます。残りの形がどれも置けなくなると終了。回転はありません。','Place blocks to complete rows or columns. Full lines clear together. Use all three pieces to receive a new hand. The game ends when none of the remaining pieces fits. Pieces cannot rotate.'):t('矢印の先が空いていれば、タップで外へぬけます。ほかの矢印があるときは、先にその道をあけよう。時間制限も、失敗のペナルティもありません。','Tap an arrow to slide it out in the direction of its head. Clear any arrows in its way first. There is no time limit or penalty for trying.')}<br>${block?t('ドラッグ、または「形を選ぶ → 場所を2回タップ」。キーボードはTab・矢印・Enterで操作。','Drag a piece, or select it and tap a spot twice. Keyboard: Tab, arrow keys and Enter.'):t('キーボードはTab・矢印で選び、Enterで決定。','Keyboard: Tab or arrow keys to select; Enter to remove.')}</p>${block?`<p>${t('得点：1マス10点＋100×同時に消す列数²。連続消去は2回目から50点ずつ加算。','Scoring: 10 per placed cell + 100 × lines². Consecutive clears add 50 more points per streak step.')}</p>`:''}<div class="row"><label for="language">Language</label><select id="language"><option value="ja" ${lang==='ja'?'selected':''}>日本語</option><option value="en" ${lang==='en'?'selected':''}>English</option></select></div><div class="row"><label for="effects">${t('効果音','Sound effects')}</label><input type="checkbox" id="effects" ${state.sfx?'checked':''}></div><p>${t('いっしょにいる猫','Your companion')}</p><div class="cat-choices">${names.map((name,i)=>`<button class="cat-choice" data-choice="${i}" aria-pressed="${i===state.cat}"><span class="cat" data-cat="${i}"></span>${t(name,enNames[i])}</button>`).join('')}</div>${!block?`<button id="choose-level">${t('まどべを選ぶ','Choose a window')}</button>`:''}<div class="row"><button class="primary" data-close>${t('あそびに戻る','Keep playing')}</button></div>`);
 $('#language').onchange=e=>{lang=e.target.value;$('#dialog').close();frame();settings();};$('#effects').onchange=e=>{state.sfx=e.target.checked;save();};
 document.querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>{state.cat=+el.dataset.choice;$('#dialog').close();save();frame();settings();});
 if(!block)$('#choose-level').onclick=()=>{$('#dialog').close();levels();};
}
function levels(){openDialog(`<h2>${t('まどべを選ぶ','Choose a window')}</h2><div class="level-choices">${LEVELS.map((_,i)=>`<button data-level="${i}" ${i>state.arrow.unlocked?'disabled':''}>${i+1}</button>`).join('')}</div><button data-close>${t('戻る','Back')}</button>`);document.querySelectorAll('[data-level]').forEach(el=>el.onclick=()=>{state.arrow={level:+el.dataset.level,unlocked:state.arrow.unlocked,removed:[]};hint=hit=null;$('#dialog').close();save();render();});}
function syncPause(){document.body.classList.toggle('paused',platform.paused);$('#pause').hidden=!platform.paused;$('.shell').inert=platform.paused;$('#dialog').inert=platform.paused;if(platform.paused){drag=null;candidate=null;audioContext?.suspend();save();}else if(!platform.audio)audioContext?.suspend();}
async function boot(){
 root.innerHTML='<section class="shell"><p role="status">Loading… / 読み込み中…</p></section>';
 platform.firstFrame();
 try{
  const data=await platform.init();lang=platform.lang.toLowerCase().startsWith('ja')?'ja':'en';state=fresh();
  if(data){if(!Number.isInteger(data.cat)||data.cat<0||data.cat>2)throw Error('Invalid cat');state.cat=data.cat;state.sfx=data.sfx!==false;
   if(block){if(!validBlock(data.block))throw Error('Invalid board');state.block=data.block;}
   else{const a=data.arrow;if(!a||!Number.isInteger(a.level)||a.level<0||a.level>=30||!Number.isInteger(a.unlocked)||a.unlocked<a.level||a.unlocked>=30||!Array.isArray(a.removed)||new Set(a.removed).size!==a.removed.length||!a.removed.every(id=>LEVELS[a.level].arrows.some(ar=>ar.id===id)))throw Error('Invalid level');state.arrow=a;}}
  await document.fonts.ready;const atlas=new Image();atlas.src=new URL('../assets/cats.png',import.meta.url);await atlas.decode();
  frame();platform.onSave=saved;platform.onState=syncPause;platform.ready();if(block)platform.score(state.block.best);if(platform.storageError)saved(false);
 }catch(error){platform.loaded=false;root.innerHTML='<section class="shell"><h1>Unable to load / 読み込めませんでした</h1><p>Your saved progress has not been overwritten.<br>保存データは上書きしていません。</p><button id="retry">Try again / もう一度</button></section>';$('#retry').onclick=()=>location.reload();if(platform.youtube)platform.sdk.health.logError();}
}
boot();
