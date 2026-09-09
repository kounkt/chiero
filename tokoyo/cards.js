/* 共通カード。画面外では式と操作状態だけを持ち、描画は kami.lazy に任せる。 */
const TOKOYO_CARD = (() => {
  const EN = document.documentElement.lang === 'en';
  const t = (ja,en) => EN ? en : ja;
  function mount(w, fig, o={}) {
    const root = o.root || './', obs = o.obs || {}, no = w.slug.slice(0,3);
    const name = EN ? (obs.gloss || w.name) : w.name;
    fig.classList.add('tokoyo-card'); fig.dataset.work = w.slug;
    const box = document.createElement('div'); box.className = 'art-box';
    if (!o.head) {
      const link = document.createElement('a'); link.className = 'pic'; link.href = root+no+'/';
      link.setAttribute('aria-label',t(name+'の観測を開く','Open observation: '+name));
      link.append(box); fig.append(link);
    } else fig.append(box);
    const k = kami.lazy({...STYLE,...w,mount:box,size:o.size || 500,step:TAU/300});
    const bar = document.createElement('div'); bar.className = 'card-bar';
    const title = document.createElement('a'); title.href=root+no+'/'; title.className='card-title';
    const nm = document.createElement('span'); nm.textContent=name;
    const num = document.createElement('small'); num.textContent=t('観測 ','Observation ')+no;
    title.append(nm,num); bar.append(title);
    if (obs.chapterKey) { const ch=document.createElement('a'); ch.className='card-chapter';
      ch.href=root+obs.chapterKey+'/'; ch.textContent=obs.chapter; bar.append(ch); }
    const meta=document.createElement('span'); meta.className='card-count';
    const cnt=document.createElement('span'); cnt.className='point-count';
    meta.append(cnt,document.createTextNode(t('点',' points'))); bar.append(meta);
    const buttons=document.createElement('div'); buttons.className='btns'; bar.append(buttons);
    const button = label => { const b=document.createElement('button'); b.type='button'; b.className='ghost';
      b.textContent=label; buttons.append(b); return b; };
    const tb=button(''), rb=button('');
    const thinner=TSUMAMI.thin(tb,()=>k,{n:w.n,cnt,restore:rb,art:o.head?box:null,slug:w.slug});
    const hb=button(t('止める','Hold'));
    const paintHold=()=>{ hb.textContent=k.isHeld()?t('動かす','Resume'):t('止める','Hold');
      hb.setAttribute('aria-pressed',String(k.isHeld())); };
    const fb=button(t('全画面','Full screen'));
    TSUMAMI.full(fb,fig,px=>{k.resize(px || o.size || 500); thinner.apply(); paintHold();});
    const ab=button(t('聴く','Listen')); const voice=TSUMAMI.hear(ab,w,()=>k);
    hb.onclick=()=>{thinner.stopAuto(); if(k.isHeld())k.release();else k.hold();voice.sync(k.isHeld());paintHold();};
    box.addEventListener('tokoyo:holdchange',()=>{voice.sync(k.isHeld());paintHold();}); paintHold();
    const sb=button(t('共有','Share'));
    const ps=(obs.body || '').split(/\n{2,}/).map(s=>s.replace(/\n/g,EN?' ':'').replace(/\*\*/g,''));
    TSUMAMI.share(sb,{title:t('常世 ','Tokoyo ')+no+' '+name,top:t('常世 ・ 観測 ','TOKOYO · OBSERVATION ')+no,
      name,file:'tokoyo-'+no,lead:ps[0]||'',tail:ps.at(-1)||'',url:'https://chiero.jp/tokoyo/'+(EN?'en/':'')+no+'/'},()=>k);
    const details=document.createElement('details'); details.className='equation';
    const summary=document.createElement('summary'); summary.textContent=t('式を読む・持ち帰る','Read and take the equation');
    const pre=document.createElement('pre'); pre.textContent=k.src;
    const copy=document.createElement('button'); copy.className='ghost'; copy.textContent=t('式をコピー','Copy equation');
    copy.onclick=async()=>{try {await navigator.clipboard.writeText(k.src);copy.textContent=t('コピーしました','Copied');}
      catch {copy.textContent=t('式を選択してコピー','Select the equation to copy'); const sel=getSelection();
        const range=document.createRange();range.selectNodeContents(pre);sel.removeAllRanges();sel.addRange(range);}};
    const play=document.createElement('a');play.href=root+'run/#'+w.slug;play.textContent=t('式で遊ぶ →','Run and rewrite →');
    details.append(summary,pre,copy,play);fig.append(bar,details);
    return {k,thinner,voice};
  }
  function home() {
    const observations=EN?OBS_EN:OBS, chapters=EN?CHAPTERS_EN:CHAPTERS;
    const build=(slug,host,head=false)=>{const w=WORKS.find(w=>w.slug===slug);if(!w)return;
      const fig=head?host:document.createElement('figure');if(!head)host.append(fig);
      mount(w,fig,{obs:observations[slug],head,size:head?640:500});};
    build('001_kurage',document.getElementById('hero'),true);
    const featured=['041_awai','040_watari','037_shiome'];
    for(const slug of featured)build(slug,document.getElementById('works'));
    const chs=document.getElementById('chs');
    for(const c of chapters){const a=document.createElement('a');a.className='ch';a.href='./'+c.key+'/';
      const nm=document.createElement('span');nm.className='nm';nm.textContent=c.name;
      const count=document.createElement('span');count.className='cnt';count.textContent=c.count+t('作品',' works');
      a.append(nm,count);chs.append(a);}
    document.getElementById('chnote').textContent=t('章から辿る。番号は見つかった順です。','Explore by chapter. Numbers follow the order of discovery.');
    const rest=WORKS.filter(w=>w.slug!=='001_kurage'&&!featured.includes(w.slug));
    document.querySelector('#catalog summary').textContent=t('ほかの観測をひらく（'+rest.length+'作品）','Open the remaining observations ('+rest.length+')');
    let built=false;document.getElementById('catalog').addEventListener('toggle',e=>{
      if(e.target.open&&!built){built=true;for(const w of rest)build(w.slug,document.getElementById('all-works'));}
    });
  }
  return {mount,home};
})();
