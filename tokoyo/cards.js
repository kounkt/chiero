/* 共通カード。画面外では式と操作状態だけを持ち、描画は kami.lazy に任せる。

   一覧は見る場（2026-09-28 改装）:
     カードに置くのは 画・題・観測番号・点を減らす の四つだけ。
     止める・全画面・聴く・共有・式は作品の頁にある。一覧で同じ札を49回並べない。
     点を減らすは一つのボタンが巡る（40,000 → 625 → 40 → 1 → 40,000。tsumami.js の cycle）。

   赤は一画面に一点（DIRECTIVE §0）:
     一覧では落款を消して作り、**いま見ている一体にだけ**付ける。
     見ている＝マウスの下の一体、キーボードで入った一体、それ以外は画面の中心にいちばん近い一体。 */
const TOKOYO_CARD = (() => {
  const EN = document.documentElement.lang === 'en';
  const t = (ja,en) => EN ? en : ja;

  const cards = new Set();
  let current = null, hover = null, queued = false;
  const setCurrent = c => {
    if (c === current) return;
    current = c;
    for (const x of cards) x.k.setSeal(x === c);
  };
  const nearest = () => {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let best = null, bd = Infinity;
    for (const x of cards) {
      const r = x.box.getBoundingClientRect();
      if (!r.width || r.bottom <= 0 || r.top >= innerHeight) continue;
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  };
  const update = () => { queued = false; if (!hover) setCurrent(nearest()); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  function watch(entry) {
    cards.add(entry);
    entry.fig.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = entry; setCurrent(entry); } });
    entry.fig.addEventListener('pointerleave', () => { if (hover === entry) { hover = null; queue(); } });
    entry.fig.addEventListener('focusin', () => setCurrent(entry));
    queue();
  }

  function mount(w, fig, o={}) {
    const root = o.root || './', obs = o.obs || {}, no = w.slug.slice(0,3);
    const name = EN ? (obs.gloss || w.name) : w.name;
    fig.classList.add('tokoyo-card'); fig.dataset.work = w.slug;
    fig.replaceChildren(); // Replace the static fallback in one synchronous turn.
    const box = document.createElement('div'); box.className = 'art-box';
    if (!o.head) {
      const link = document.createElement('a'); link.className = 'pic'; link.href = root+no+'/';
      link.setAttribute('aria-label',t(name+'の観測を開く','Open observation: '+name));
      link.append(box); fig.append(link);
    } else fig.append(box);
    const fittedSize=()=>Math.max(160,Math.min(o.size||500,Math.round(box.getBoundingClientRect().width)||(o.size||500)));
    let renderSize=fittedSize();
    const k = kami.lazy({...STYLE,...w,mount:box,size:renderSize,step:TAU/300,formulaBand:false,seal:false});
    const resizeEye=new ResizeObserver(()=>{
      const next=fittedSize();if(next!==renderSize){renderSize=next;k.resize(next);}
    });resizeEye.observe(box);
    // 雷は暗い時刻から始まる。入口では枝が現れた時刻を示し、停止表示でも姿を見せる。
    if (w.slug === '020_ikazuchi') k.seek(TAU * 1.65);
    const bar = document.createElement('div'); bar.className = 'card-bar';
    const title = document.createElement('a'); title.href=root+no+'/'; title.className='card-title';
    const nm = document.createElement('span'); nm.textContent=name;
    const num = document.createElement('small'); num.textContent=t('観測 ','Observation ')+no;
    title.append(nm,num); bar.append(title);
    const pts = document.createElement('button'); pts.type = 'button'; pts.className = 'card-pts';
    bar.append(pts);
    const thinner = TSUMAMI.thin(pts, () => k, {n:w.n, cycle:true, compact:true, art:o.head?box:null, slug:w.slug});
    fig.append(bar);
    fig.setAttribute('aria-label',t('観測 ','Observation ')+no+' '+name);
    const titleId='work-title-'+no; title.id=titleId; pts.setAttribute('aria-describedby',titleId);
    watch({fig, box, k});
    return {k, thinner};
  }

  function home() {
    const observations=EN?OBS_EN:OBS, chapters=EN?CHAPTERS_EN:CHAPTERS;
    const build=(slug,host,head=false)=>{const w=WORKS.find(w=>w.slug===slug);if(!w)return;
      const fig=head?host:(document.getElementById('work-'+slug.slice(0,3))||document.createElement('figure'));if(!head){fig.id='work-'+slug.slice(0,3);if(!fig.parentNode)host.append(fig);}
      mount(w,fig,{obs:observations[slug],head,size:head?640:500});};
    build('001_kurage',document.getElementById('hero'),true);
    // 応募用短編の四作（tools/export_film.mjs CAST）。水母は上のヒーローに置く。
    const featured=['026_ei','020_ikazuchi','006_mayu'];
    for(const slug of featured)build(slug,document.getElementById('works'));
    const creatures=['047_clione','048_tatsunootoshigo','049_isoginchaku'];
    for(const slug of creatures)build(slug,document.getElementById('life-works'));
    const latest=['041_awai','042_hida','043_futae','044_hodoke','045_uraomote','046_hiraki'];
    for(const slug of latest)build(slug,document.getElementById('new-works'));
    /* 章の目次。五つを一列に（番号・名・作品数だけ）。狭い画面では一行ずつ。 */
    const chs=document.getElementById('chs');
    if(!chs.querySelector('.ch'))for(const c of chapters){const a=document.createElement('a');a.className='ch';a.href='./'+c.key+'/';
      const ord=document.createElement('span');ord.className='k';ord.textContent=EN?c.no:'第'+c.no;
      const nm=document.createElement('span');nm.className='nm';nm.textContent=c.name;
      const count=document.createElement('span');count.className='cnt';count.textContent=c.count+t('作品',' works');
      a.append(ord,nm,count);chs.append(a);}
    const rest=WORKS.filter(w=>w.slug!=='001_kurage'&&!featured.includes(w.slug)&&!creatures.includes(w.slug)&&!latest.includes(w.slug));
    document.querySelector('#catalog summary').textContent=t('ほかの観測をひらく（'+rest.length+'作品）','Open the remaining observations ('+rest.length+')');
    let built=false;document.getElementById('catalog').addEventListener('toggle',e=>{
      if(e.target.open&&!built){built=true;for(const w of rest)build(w.slug,document.getElementById('all-works'));}
    });
  }
  return {mount,home};
})();
