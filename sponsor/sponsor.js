'use strict';
const form=document.getElementById('sponsor-form'),api=form.dataset.api,fields=document.getElementById('fields'),status=document.getElementById('form-status');
const prefs='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
prefs.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;form.elements.prefecture.append(o);});
let payload=null,id=crypto.randomUUID(),fingerprint='',busy=false,price=null;
const view=document.getElementById('review'),params=new URLSearchParams(location.search);
function message(text){status.textContent=text;}
async function request(path,body){const r=await fetch(api+path,{mode:'cors',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});const x=await r.json();if(!r.ok){const e=Error(x.error||'受付に接続できませんでした。');e.code=r.status;throw e;}return x;}
async function loadOffer(){
 try{const x=await request('/status');price=x.price;document.getElementById('offer-price').textContent=x.price.toLocaleString('ja-JP');document.getElementById('availability').textContent=x.open?(x.price===33000?`先着価格の残り枠：${x.remaining} / 5`:'先着5件の受付は終了しました。通常価格で受付中です。'):x.temporaryFull?'初回枠は現在お支払い手続き中です。時間をおいてご確認ください。':x.calendarOpen===false?'1週間以内の掲載と確認期間を確保するため、連休前後の受付を一時停止しています。':'現在、受付を一時停止しています。';if(x.price===88000){document.querySelector('.regular-price').hidden=true;document.querySelector('.tag').textContent='通常価格';document.getElementById('offer-note').textContent='先着5件の初回価格は終了しました。';}fields.disabled=!x.open;}
 catch{document.getElementById('availability').textContent='受付状況を取得できませんでした。';message('ページを再読み込みしてお試しください。解消しない場合は work@chiero.jp にご連絡ください。');}
}
function showReceipt(x){
 form.hidden=true;view.hidden=true;document.querySelector('.form-head').hidden=true;document.getElementById('success').hidden=false;document.getElementById('receipt-id').textContent=`受付番号：${x.id}\nお支払い：${x.amount.toLocaleString('ja-JP')}円（税込）\n掲載期限：${new Date(x.publicationDue*1000).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間）`;
 const details=document.querySelector('#success details');if(!payload)details.hidden=true;else document.getElementById('sent-summary').textContent=entries(payload).map(([k,v])=>`${k}：${v}`).join('\n');message('');document.getElementById('success-title').focus();
}
async function checkReceipt(){
 form.hidden=true;message('Stripeのお支払い結果を確認しています…');
 try{const x=await request('/receipt/'+encodeURIComponent(params.get('receipt'))+'?token='+encodeURIComponent(params.get('token')||''));if(x.paid)showReceipt(x);else {message(x.paymentStatus==='refunded'?'この申し込みは返金済みです。メールをご確認ください。':'決済結果を確認中です。受付メールをご確認いただくか、このページを再読み込みしてください。二重にお支払いいただく必要はありません。');}}
 catch(e){message(e.message+' お支払い済みの場合は再決済せず、受付メールをご確認ください。');}
}
if(params.has('receipt'))checkReceipt();else{loadOffer();if(params.has('cancelled'))message('決済は完了していません。再開する場合は同じ内容をご入力ください。');}
for(const name of ['business','point1'])form.elements[name].addEventListener('input',()=>form.elements[name].setCustomValidity(''));
function entries(p){return [['お支払い金額',p.expectedPrice.toLocaleString('ja-JP')+'円（税込）/ 1本'],['掲載期限','決済完了から1週間以内'],['都道府県',p.prefecture],['名前と業種',p.business],['伝えたいこと',p.points.map((x,i)=>`${i+1}. ${x}`).join('\n')],['載せてよいURL',p.url||'指定なし'],['連絡先メール',p.email],['掲載時期の希望・連絡事項',p.timing||'お任せ'],['草案確認','送付から3営業日以内（土日祝を除く）に修正連絡がなければ掲載。修正は1回。']];}
form.addEventListener('submit',async e=>{
 e.preventDefault();for(const n of ['business','point1'])form.elements[n].setCustomValidity(form.elements[n].value.trim()?'':'こちらをご記入ください。');if(!form.reportValidity()||!price)return;
 const get=n=>form.elements[n].value.trim();payload={prefecture:get('prefecture'),business:get('business'),points:['point1','point2','point3'].map(get).filter(Boolean),url:get('url'),email:get('email'),timing:get('timing'),consents:Array.from({length:6},(_,i)=>form.elements['consent'+i].checked),website:get('website'),expectedPrice:price};
 if(payload.url&&!/^https?:\/\//i.test(payload.url)){message('URLは https:// または http:// から入力してください。');return;}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(fingerprint&&fingerprint!==hash)id=crypto.randomUUID();fingerprint=hash;
 try{const saved=JSON.parse(sessionStorage.getItem('chiero-sponsor-request-v2')||'null');if(saved?.fingerprint===hash)id=saved.id;sessionStorage.setItem('chiero-sponsor-request-v2',JSON.stringify({id,fingerprint:hash}));}catch{}
 const dl=document.getElementById('review-content');dl.replaceChildren();entries(payload).forEach(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd);});form.hidden=true;view.hidden=false;message('');document.getElementById('review-title').focus();
});
document.getElementById('back').onclick=()=>{if(busy)return;view.hidden=true;form.hidden=false;form.elements.email.focus();};
document.getElementById('send').onclick=async()=>{
 if(busy||!payload)return;busy=true;document.getElementById('send').disabled=true;document.getElementById('back').disabled=true;view.setAttribute('aria-busy','true');message('Stripeの決済画面を開いています…');
 try{const c=await request('/challenge');const result=await request('/checkout',{...payload,id,challenge:c.challenge});if(result.paid){const x=await request('/receipt/'+id+'?token='+encodeURIComponent(result.token));if(x.paid)showReceipt(x);}else if(result.url&&new URL(result.url).hostname==='checkout.stripe.com'){location.assign(result.url);}else throw Error('決済画面を確認できませんでした。');}
 catch(e){if(e.code===410){id=crypto.randomUUID();try{sessionStorage.setItem('chiero-sponsor-request-v2',JSON.stringify({id,fingerprint}));}catch{}}message(e.name==='TimeoutError'||e instanceof TypeError?'通信を確認して再度お試しください。同じ内容で再開しても決済画面は重複作成されません。':e.message);status.focus();}
 finally{busy=false;document.getElementById('send').disabled=false;document.getElementById('back').disabled=false;view.removeAttribute('aria-busy');}
};
document.getElementById('copy-receipt').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('receipt-id').textContent+'\n'+document.getElementById('sent-summary').textContent);message('控えをコピーしました。');}catch{message('受付番号を選択してコピーしてください。');}};
const counter=document.querySelector('[data-count-to]');
if(counter&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const total=Number(counter.dataset.countTo);counter.parentElement.setAttribute('aria-label',total.toLocaleString('ja-JP')+'表示');counter.setAttribute('aria-hidden','true');
 const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();let started;const tick=t=>{started??=t;const progress=Math.min(1,(t-started)/1600);counter.textContent=Math.round(total*(1-(1-progress)**3)).toLocaleString('ja-JP');if(progress<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);},{threshold:.35});observer.observe(counter);
}
