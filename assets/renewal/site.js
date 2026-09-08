import {startSlope} from './slope.js';
const preference=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=document.querySelector('.slope-canvas');
let stopSlope=()=>{};
if(canvas)stopSlope=startSlope(canvas,{reduced:preference.matches});
document.querySelectorAll('.mobile-menu').forEach(menu=>{
  menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
});
const motionButton=document.querySelector('.motion-button');
if(motionButton){motionButton.hidden=false;motionButton.addEventListener('click',()=>{
  const paused=document.body.classList.toggle('motion-off');
  motionButton.setAttribute('aria-pressed',String(paused));motionButton.textContent=paused?'動きを再開する':'動きを止める';
  stopSlope();if(canvas)stopSlope=startSlope(canvas,{reduced:paused||preference.matches});
  document.dispatchEvent(new Event('chiero:motionchange'));
});}
preference.addEventListener('change',()=>{stopSlope();if(canvas)stopSlope=startSlope(canvas,{reduced:preference.matches||document.body.classList.contains('motion-off')});});
const tokoyoMount=document.querySelector('[data-tokoyo-preview]');
if(tokoyoMount)import('./tokoyo-preview.js').then(({startTokoyoPreview})=>startTokoyoPreview(tokoyoMount)).catch(()=>{
  // The artwork's static image remains available if animation cannot initialize.
  tokoyoMount.querySelector('.tokoyo-fallback').hidden=false;
  tokoyoMount.querySelector('canvas')?.remove();
});
if(canvas&&'IntersectionObserver' in window){
  new IntersectionObserver(entries=>{for(const entry of entries){stopSlope();if(entry.isIntersecting)stopSlope=startSlope(canvas,{reduced:preference.matches||document.body.classList.contains('motion-off')});}},{rootMargin:'60px'}).observe(canvas);
}
if('IntersectionObserver' in window&&!preference.matches){
  const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');reveal.unobserve(entry.target);}}),{threshold:.06});
  document.querySelectorAll('.section-heading,.person-feature,.voice,.topic-grid article,.book-grid article,.timeline li,.contact-row').forEach(element=>{
    // Never conceal material that was already visible when this enhancement starts.
    if(element.getBoundingClientRect().top>innerHeight){element.classList.add('reveal-ready');reveal.observe(element);}
  });
}
const status=document.querySelector('.status');let statusTimer;
const announce=text=>{if(!status)return;status.textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>status.textContent='',5500);};
document.querySelectorAll('[data-share-page]').forEach(button=>{
  button.hidden=false;
  button.addEventListener('click',async()=>{
    const url=document.querySelector('link[rel="canonical"]')?.href||location.href;
    button.disabled=true;
    try{
      if(navigator.share){await navigator.share({title:document.title,url});}
      else{await navigator.clipboard.writeText(url);announce('ページのURLをコピーしました。LINEやSNSに貼り付けて共有できます。');}
    }catch(error){
      if(error.name!=='AbortError')announce('共有できませんでした。ブラウザのアドレス欄からURLをコピーしてください。');
    }finally{button.disabled=false;}
  });
});
document.querySelectorAll('[data-copy],[data-copy-url]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
    let text=button.dataset.copy;
    if(button.dataset.copyUrl){const response=await fetch(button.dataset.copyUrl);if(!response.ok)throw Error('fetch');text=await response.text();}
    await navigator.clipboard.writeText(text);announce('コピーしました。普段お使いのアプリに貼り付けられます。');
  }catch{announce(button.dataset.copyUrl?'コピーできませんでした。「テキストを開く」から内容をご確認ください。':'コピーできませんでした。表示中のメールアドレスをご利用ください。');}
  finally{button.disabled=false;}
}));
