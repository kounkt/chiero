const en=document.documentElement.lang==='en';
const filter=document.querySelector('.pref-filter');
const input=document.querySelector('#pref-search');
const entries=[...document.querySelectorAll('[data-prefecture]')];
const regions=[...document.querySelectorAll('.pref-region')];
const jump=document.querySelector('.region-jump');
if(filter&&input){
 filter.hidden=false;
 input.addEventListener('input',()=>{
  const query=input.value.trim().normalize('NFKC').toLocaleLowerCase();
  let visible=0;
  for(const entry of entries){entry.hidden=!entry.dataset.prefecture.toLocaleLowerCase().includes(query);if(!entry.hidden)visible++;}
  for(const region of regions)region.hidden=![...region.querySelectorAll('[data-prefecture]')].some(e=>!e.hidden);
  if(jump)jump.hidden=Boolean(query);
  document.querySelector('#pref-result').textContent=query?(en?visible+(visible===1?' prefecture found.':' prefectures found.'):visible+'件の都道府県が見つかりました。'):'';
 });
}
// #pref-toyama のように県へ直接来た時は、Webフォントの読み込みで行送りが変わった後に、その県まで送る。
// （html の scroll-behavior:smooth と初期ジャンプが重なると位置がずれるため、フォント確定後に auto で送り直す）
function settle(){
 const id=(location.hash||'').replace(/[^#\w-]/g,'');
 const target=id.length>1&&document.querySelector(id);
 if(!target||!target.classList.contains('pref-card'))return;
 const go=()=>{const top=target.getBoundingClientRect().top+window.scrollY-Math.max(0,(innerHeight-target.offsetHeight)/2);window.scrollTo({top,behavior:'auto'});};
 go();
 (document.fonts?document.fonts.ready:Promise.resolve()).then(()=>{go();setTimeout(go,350);});
}
if(document.readyState==='complete')settle();else addEventListener('load',settle,{once:true});
addEventListener('hashchange',settle);
