import {startSlope} from './slope.js';
const en=document.documentElement.lang==='en';
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
  motionButton.setAttribute('aria-pressed',String(paused));motionButton.textContent=paused?(en?'Resume motion':'動きを再開する'):(en?'Pause motion':'動きを止める');
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
const status=document.querySelector('.status');let statusTimer;
const announce=text=>{if(!status)return;status.textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>status.textContent='',5500);};
document.querySelectorAll('[data-share-page]').forEach(button=>{
  button.hidden=false;
  button.addEventListener('click',async()=>{
    const url=document.querySelector('link[rel="canonical"]')?.href||location.href;
    button.disabled=true;
    try{
      if(navigator.share){await navigator.share({title:document.title,url});}
      else{await navigator.clipboard.writeText(url);announce((en?"Page link copied. Paste it into LINE or your favorite social app.":"ページのURLをコピーしました。LINEやSNSに貼り付けて共有できます。"));}
    }catch(error){
      if(error.name!=='AbortError')announce((en?"Sharing was unavailable. Copy the URL from your browser’s address bar.":"共有できませんでした。ブラウザのアドレス欄からURLをコピーしてください。"));
    }finally{button.disabled=false;}
  });
});
document.querySelectorAll('[data-copy],[data-copy-url]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
    let text=button.dataset.copy;
    if(button.dataset.copyUrl){const response=await fetch(button.dataset.copyUrl);if(!response.ok)throw Error('fetch');text=await response.text();}
    await navigator.clipboard.writeText(text);announce((en?"Copied. Paste it into your usual app.":"コピーしました。普段お使いのアプリに貼り付けられます。"));
  }catch{announce(button.dataset.copyUrl?(en?"Copying was unavailable. Use “Open the text” to read the content.":"コピーできませんでした。「テキストを開く」から内容をご確認ください。"):(en?"Copying was unavailable. Use the email address shown on this page.":"コピーできませんでした。表示中のメールアドレスをご利用ください。"));}
  finally{button.disabled=false;}
}));
