'use strict';
const form=document.getElementById('sponsor-form'),api=form.dataset.api,fields=document.getElementById('fields'),status=document.getElementById('form-status');
const prefs='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
prefs.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;form.elements.prefecture.append(o);});
let photoData='',photoBusy=false;
let payload=null,id=crypto.randomUUID(),fingerprint='',busy=false,price=null;
const view=document.getElementById('review'),params=new URLSearchParams(location.search);
const trial=params.has('trial');if(trial){id=params.get('trial');const banner=document.createElement('p');banner.className='trial-banner';banner.textContent='Stripeの動作確認用です。1,000円のテスト決済で、実際の引き落とし・掲載依頼は発生しません。';document.querySelector('.form-head').prepend(banner);}
function message(text){status.textContent=text;}
async function request(path,body){const r=await fetch(api+path,{mode:'cors',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});const x=await r.json();if(!r.ok){const e=Error(x.error||'受付に接続できませんでした。');e.code=r.status;throw e;}return x;}
function paintOffer(x){
 const isTest=!!x.isTest,intro=x.price===33000&&!isTest;
 document.body.classList.toggle('is-trial',isTest);
 document.querySelectorAll('[data-price]').forEach(el=>el.textContent=x.price.toLocaleString('ja-JP'));
 document.querySelectorAll('[data-offer-label]').forEach(el=>el.textContent=isTest?'動作確認用 / 実課金なし':intro?'先着5事業者':'通常価格');
 document.querySelectorAll('[data-apply-label]').forEach(el=>el.textContent=isTest?'テスト決済を確認する':intro?'先着価格で申し込む':'面接枠に申し込む');
 document.getElementById('offer-price').textContent=x.price.toLocaleString('ja-JP');
 document.querySelector('.regular-price').hidden=!intro;
 document.querySelector('.price-arrow').hidden=!intro;
 document.querySelector('.tag').textContent=isTest?'Stripeテスト環境 / 実際の引き落としなし':intro?'先着5事業者限定・1事業者1本':'通常価格・1事業者1本';
 document.getElementById('offer-title').textContent=isTest?'1,000円で流れを確認。':intro?'まずは、5つのお店から。':'あなたの街のお店から。';
 document.getElementById('offer-note').textContent=isTest?'Stripeテスト環境での1,000円決済です。':intro?'初回価格で、まず5つの街のお店から。':'先着5件の初回価格は終了しました。';
}
async function loadOffer(){
 try{
  const x=await request(trial?'/trial?id='+encodeURIComponent(id)+'&expires='+encodeURIComponent(params.get('expires')||'')+'&access='+encodeURIComponent(params.get('access')||''):'/status');
  price=x.price;paintOffer(x);
  document.getElementById('availability').textContent=trial?(x.open?'1,000円のテスト決済を確認できます。':'テスト決済は現在利用できません。'):x.open?(x.price===33000?`先着価格の残り枠：${x.remaining} / 5`:'先着5件の受付は終了しました。通常価格で受付中です。'):x.temporaryFull?'初回枠は現在お支払い手続き中です。時間をおいてご確認ください。':x.calendarOpen===false?'1週間以内の掲載と確認期間を確保するため、連休前後の受付を一時停止しています。':'現在、受付を一時停止しています。';
  fields.disabled=!x.open;
 }catch{document.getElementById('availability').textContent='受付状況を取得できませんでした。';message('ページを再読み込みしてお試しください。解消しない場合は work@chiero.jp にご連絡ください。');}
}
function showReceipt(x){
 paintOffer({price:x.amount,isTest:x.isTest});
 document.getElementById("availability").textContent=x.isTest?"1,000円のテスト決済を確認しました。":"お申し込みありがとうございます。";
 if(x.isTest){document.querySelector(".regular-price").hidden=true;document.querySelector(".tag").textContent="動作確認用 / 実課金なし";document.getElementById("offer-price").textContent=x.amount.toLocaleString("ja-JP");document.getElementById("offer-note").textContent="Stripeテスト環境での決済が完了しました。";document.querySelector("#success > p:last-child").textContent="動作確認用のため、期限後にこの内容が自動投稿されることはありません。";}
 if(x.isTest){document.getElementById('success-title').textContent='1,000円のテスト決済が完了しました。';document.querySelector('#success h3 + p').textContent='実際の引き落とし・掲載依頼は発生していません。控えと管理通知をメールで確認できます。';}
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
function entries(p){return [['お支払い金額',p.expectedPrice.toLocaleString('ja-JP')+'円（税込）/ 1本'],['掲載期限','決済完了から1週間以内'],['都道府県',p.prefecture],['名前と業種',p.business],['伝えたいこと',p.points.map((x,i)=>`${i+1}. ${x}`).join('\n')],['載せてよいURL',p.url||'指定なし'],['連絡先メール',p.email],['掲載時期の希望・連絡事項',p.timing||'お任せ'],['添付写真',p.image?'1枚':'なし'],['草案確認','送付から3営業日以内（土日祝を除く）に修正連絡がなければ掲載。修正は1回。']];}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(photoBusy){message('写真の準備が終わるまでお待ちください。');return;}if(photoData&&!document.getElementById('photo-consent').checked){message('写真の使用・掲載への同意をご確認ください。');return;}for(const n of ['business','point1'])form.elements[n].setCustomValidity(form.elements[n].value.trim()?'':'こちらをご記入ください。');if(!form.reportValidity()||!price)return;
 const get=n=>form.elements[n].value.trim();payload={prefecture:get('prefecture'),business:get('business'),points:['point1','point2','point3'].map(get).filter(Boolean),url:get('url'),email:get('email'),timing:get('timing'),consents:Array.from({length:6},(_,i)=>form.elements['consent'+i].checked),website:get('website'),expectedPrice:price,image:photoData||undefined,imageConsent:!!photoData,...(trial?{trialExpires:params.get('expires'),trialAccess:params.get('access')}:{})};
 if(payload.url&&!/^https?:\/\//i.test(payload.url)){message('URLは https:// または http:// から入力してください。');return;}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(!trial&&fingerprint&&fingerprint!==hash)id=crypto.randomUUID();fingerprint=hash;
 try{if(!trial){const saved=JSON.parse(sessionStorage.getItem('chiero-sponsor-request-v2')||'null');if(saved?.fingerprint===hash)id=saved.id;sessionStorage.setItem('chiero-sponsor-request-v2',JSON.stringify({id,fingerprint:hash}));}}catch{}
 const dl=document.getElementById('review-content');dl.replaceChildren();entries(payload).forEach(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd);});document.getElementById('review-photo').hidden=!photoData;if(photoData)document.getElementById('review-photo').src='data:image/jpeg;base64,'+photoData;form.hidden=true;view.hidden=false;message('');document.getElementById('review-title').focus();
});
document.getElementById('back').onclick=()=>{if(busy)return;view.hidden=true;form.hidden=false;form.elements.email.focus();};
document.getElementById('send').onclick=async()=>{
 if(busy||!payload)return;busy=true;document.getElementById('send').disabled=true;document.getElementById('back').disabled=true;view.setAttribute('aria-busy','true');message('Stripeの決済画面を開いています…');
 try{const c=await request('/challenge');const result=await request('/checkout',{...payload,id,challenge:c.challenge});if(result.paid){const x=await request('/receipt/'+id+'?token='+encodeURIComponent(result.token));if(x.paid)showReceipt(x);}else if(result.url&&new URL(result.url).hostname==='checkout.stripe.com'){location.assign(result.url);}else throw Error('決済画面を確認できませんでした。');}
 catch(e){if(e.code===410&&!trial){id=crypto.randomUUID();try{sessionStorage.setItem('chiero-sponsor-request-v2',JSON.stringify({id,fingerprint}));}catch{}}message(e.name==='TimeoutError'||e instanceof TypeError?'通信を確認して再度お試しください。同じ内容で再開しても決済画面は重複作成されません。':e.message);status.focus();}
 finally{busy=false;document.getElementById('send').disabled=false;document.getElementById('back').disabled=false;view.removeAttribute('aria-busy');}
};
document.getElementById('copy-receipt').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('receipt-id').textContent+'\n'+document.getElementById('sent-summary').textContent);message('控えをコピーしました。');}catch{message('受付番号を選択してコピーしてください。');}};
const counter=document.querySelector('[data-count-to]');
if(counter&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const total=Number(counter.dataset.countTo);counter.parentElement.setAttribute('aria-label',total.toLocaleString('ja-JP')+'表示');counter.setAttribute('aria-hidden','true');
 const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();let started;const tick=t=>{started??=t;const progress=Math.min(1,(t-started)/1600);counter.textContent=Math.round(total*(1-(1-progress)**3)).toLocaleString('ja-JP');if(progress<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);},{threshold:.35});observer.observe(counter);
}

const photoInput=document.getElementById('photo');
function clearPhoto(){photoData='';photoInput.value='';photoInput.setCustomValidity('');document.getElementById('photo-panel').hidden=true;document.getElementById('photo-preview').removeAttribute('src');}
document.getElementById('remove-photo').onclick=()=>{clearPhoto();message('写真を外しました。');};
photoInput.addEventListener('change',async()=>{
 photoData='';photoInput.setCustomValidity('');document.getElementById('photo-panel').hidden=true;
 const file=photoInput.files[0];if(!file)return;
 photoBusy=true;photoInput.disabled=true;document.getElementById('remove-photo').disabled=true;message('写真を準備しています…');
 let bitmap;
 try{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('写真はJPEG・PNG・WebP、10MB以内で選んでください。');
  bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>60_000_000)throw Error('写真の解像度が大きすぎます。小さくして選び直してください。');
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let data;for(const quality of [.9,.8,.65,.5]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<1_398_000)break;}
  if(data.length>=1_398_000)throw Error('写真を小さくしてから選び直してください。');
  photoData=data.split(',')[1];document.getElementById('photo-preview').src=data;document.getElementById('photo-panel').hidden=false;message('写真を1枚選択しました。内容確認後、決済画面へ進む際に送信します。');
 }catch(e){photoInput.setCustomValidity(e.message);message(e.message);}finally{bitmap?.close();photoBusy=false;photoInput.disabled=false;document.getElementById('remove-photo').disabled=false;}
});

document.querySelectorAll('a[href="#conditions"],a[href="#sales"]').forEach(a=>a.addEventListener('click',()=>{const target=document.querySelector(a.getAttribute('href'));const details=target?.querySelector('details');if(details)details.open=true;}));
