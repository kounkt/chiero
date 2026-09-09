/* このタブ内の体験確認用。外部送信・識別子・Cookieは使わない。 */
window.TOKOYO_EVENTS = (() => {
  const key='tokoyo-experience-v1';
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(key))||{counts:{},seen:{}};}catch{return {counts:{},seen:{}};}};
  const allowed=new Set(['first_reduce','one_point','other_work']);
  const record=(event,slug='')=>{
    if(!allowed.has(event))return;
    const data=read(), id=event+':'+slug;
    if(data.seen[id])return;
    data.seen[id]=true;data.counts[event]=(data.counts[event]||0)+1;
    try{sessionStorage.setItem(key,JSON.stringify(data));}catch{}
    dispatchEvent(new CustomEvent('tokoyo:experience',{detail:{event,slug}}));
  };
  const match=location.pathname.match(/\/(\d{3})\/$/);
  if(match){const data=read();if(data.lastWork&&data.lastWork!==match[1])record('other_work',match[1]);
    const next=read();next.lastWork=match[1];try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}}
  return {record,read,clear:()=>{try{sessionStorage.removeItem(key);}catch{}}};
})();
