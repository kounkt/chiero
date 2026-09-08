const form=document.querySelector('#decision-sheet');
const result=document.querySelector('#sheet-result');
const output=document.querySelector('#sheet-output');
const status=document.querySelector('.sheet-status');
const fields=[['decision','いま決めたいこと'],['facts','いま分かっている事実'],['values','大事にしたいこと'],['options','考えている選択肢'],['uncertainty','判断を止めていること']];
let sheetText='';
if(form&&result){
 form.querySelector('[type="submit"]').disabled=false;
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const decision=form.elements.namedItem('decision');
  decision.setCustomValidity(decision.value.trim()?'':'いま決めたいことを入力してください。');
  if(!form.reportValidity())return;
  output.replaceChildren();
  const date=new Date().toLocaleDateString('ja-JP');
  const lines=['CHIERO 経営整理シート',date,''];
  for(const [name,label] of fields){
   const value=form.elements.namedItem(name).value.trim()||'（これから考える）';
   const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
   dt.textContent=label;dd.textContent=value;row.append(dt,dd);output.append(row);lines.push(label,value,'');
  }
  sheetText=lines.join('\n');
  document.querySelector('.sheet-created').textContent=date+' / 自分の考えを整理するためのメモ';
  result.hidden=false;status.textContent='整理シートを作成しました。';
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-off');
  result.focus({preventScroll:true});result.scrollIntoView({behavior:reduceMotion?'instant':'smooth'});
 });
 form.elements.namedItem('decision').addEventListener('input',event=>event.target.setCustomValidity(''));
 document.querySelector('#copy-sheet').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(sheetText+'\nこの内容について、初回相談が合うか伺いたいです。');status.textContent='相談文をコピーしました。LINEやメールに貼り付けて使えます。';}
  catch{status.textContent='コピーできませんでした。シート本文を選択してコピーするか、テキストを保存してください。';}
 });
 document.querySelector('#save-sheet').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([sheetText],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='CHIERO-経営整理シート.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='テキストファイルを保存します。';
 });
 document.querySelector('#print-sheet').addEventListener('click',()=>{window.print();});
}
