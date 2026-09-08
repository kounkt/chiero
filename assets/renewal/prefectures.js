const en=document.documentElement.lang==='en';
const filter=document.querySelector('.pref-filter');
const input=document.querySelector('#pref-search');
const entries=[...document.querySelectorAll('[data-prefecture]')];
if(filter&&input){
 filter.hidden=false;
 input.addEventListener('input',()=>{
  const query=input.value.trim().normalize('NFKC').toLocaleLowerCase();
  let visible=0;
  for(const entry of entries){entry.hidden=!entry.dataset.prefecture.toLocaleLowerCase().includes(query);if(!entry.hidden)visible++;}
  for(const region of document.querySelectorAll('.pref-region'))region.hidden=![...region.querySelectorAll('[data-prefecture]')].some(e=>!e.hidden);
  document.querySelector('#pref-result').textContent=query?(en?visible+(visible===1?' prefecture found.':' prefectures found.'):visible+'件の都道府県が見つかりました。'):'';
 });
}
