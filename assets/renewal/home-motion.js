const body = document.body;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const printing = matchMedia('print');
const subpage = body.hasAttribute('data-page-motion');
// Keep the real heading and its emphasis; reveal the existing editorial lines.
if (subpage) {
  document.querySelectorAll('.page-hero h1').forEach(heading => {
    const lines = [[]];
    [...heading.childNodes].forEach(node => {
      if (node.nodeName === 'BR') lines.push([]);
      else lines.at(-1).push(node);
    });
    const fragment = document.createDocumentFragment();
    lines.forEach((nodes, index) => {
      const mask = document.createElement('span');
      const line = document.createElement('span');
      mask.className = 'line-mask';
      line.className = 'line-enter';
      line.style.setProperty('--line-delay', `${index * 160}ms`);
      line.append(...nodes);
      mask.append(line);
      fragment.append(mask);
    });
    heading.replaceChildren(fragment);
  });
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  body.prepend(progress);
}
const counters = [...document.querySelectorAll('[data-count]')];
const homeTargets = '.hero-copy>.eyebrow,.hero-copy>.lead,.hero-copy>.actions,.section-heading,.home-free,.activity-card,.app-card,.social-proof-head,.reach-grid>div,.press-strip>a,.person-photo,.person-copy,.journal-list>a';
const pageTargets = [
  'main h2', 'main h3', '.page-hero .eyebrow', '.page-hero .lead', '.page-hero .article-meta',
  '.section-heading', '.selection-heading', '.book-total', '.book-grid article', '.app-card',
  '.person-photo', '.person-copy', '.philosophy>p', '.follower-feature>div', '.reach-grid>div',
  '.timeline li', '.journal-list>a', '.contact-row', '.media-grid>article', '.media-grid>a',
  '.record-rows>a', '.interview-feature>div', '.milestone-record', '.resource-copy', '.resource-visual',
  '.next-step-grid>article', '.product-feature>div', '.gallery-art-copy>div', '.gallery-art-copy>p',
  '.workbook-promo>div', '.workbook-promo>a', '.home-free', '.free-choices-heading',
  '.free-choices-links>a', '.follow>div', '.contact-inner>div', '.reading-related>a'
].join(',');
const selector = subpage ? pageTargets : homeTargets;
// Animate a card or its heading once, rather than nesting two entrance effects.
const targets = [...document.querySelectorAll(selector)].filter(el => !subpage || !el.parentElement.closest(selector));
const number = new Intl.NumberFormat(document.documentElement.lang === 'en' ? 'en-US' : 'ja-JP');
const animations = new Map();
let enterObserver, countObserver, scheduled = false;
const enabled = () => !preference.matches && !printing.matches && !body.classList.contains('motion-off') && 'IntersectionObserver' in window;

targets.forEach(el => {
  el.dataset.enter = '';
  const siblings = [...el.parentElement.children].filter(n => targets.includes(n));
  el.style.setProperty('--entry-delay', `${Math.min(siblings.indexOf(el), 3) * 85}ms`);
});

function finishCounters() {
  for (const id of animations.values()) cancelAnimationFrame(id);
  animations.clear();
  counters.forEach(el => { el.textContent = number.format(Number(el.dataset.count)); });
}

function count(el) {
  const target = Number(el.dataset.count), duration = Number(el.dataset.duration) || 1150, start = performance.now();
  if (!enabled()) return;
  el.textContent = '0';
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = number.format(Math.floor(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) animations.set(el, requestAnimationFrame(tick));
    else animations.delete(el);
  }
  animations.set(el, requestAnimationFrame(tick));
}

function initialize() {
  enterObserver?.disconnect();
  countObserver?.disconnect();
  finishCounters();
  body.classList.toggle('motion-enabled', enabled());
  if (!enabled()) {
    targets.forEach(el => el.classList.add('entered'));
    return;
  }
  targets.forEach(el => el.classList.toggle('entered', el.getBoundingClientRect().top < innerHeight));
  enterObserver = new IntersectionObserver(entries => entries.forEach(({target, isIntersecting}) => {
    if (isIntersecting) { target.classList.add('entered'); enterObserver.unobserve(target); }
  }), {threshold: .08, rootMargin: '0px 0px -25px 0px'});
  targets.forEach(el => enterObserver.observe(el));
  countObserver = new IntersectionObserver(entries => entries.forEach(({target, isIntersecting}) => {
    if (isIntersecting) { count(target); countObserver.unobserve(target); }
  }), {threshold: .55});
  counters.forEach(el => countObserver.observe(el));
}

const progress = document.querySelector('.reading-progress');
const art = document.querySelector('.art-card');
function scrollFrame() {
  scheduled = false;
  const max = document.documentElement.scrollHeight - innerHeight;
  if (progress) progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  if (art) art.style.setProperty('--art-offset', enabled() ? `${Math.max(-14, Math.min(14, (innerHeight / 2 - art.getBoundingClientRect().top) * .035))}px` : '0px');
}
addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(scrollFrame); }
}, {passive: true});
addEventListener('resize', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(scrollFrame); }
}, {passive: true});
document.addEventListener('chiero:motionchange', () => { initialize(); scrollFrame(); });
preference.addEventListener('change', () => { initialize(); scrollFrame(); });
printing.addEventListener('change', () => { initialize(); scrollFrame(); });
addEventListener('beforeprint', finishCounters);
// A keyboard user must never focus an element that is still visually hidden.
document.addEventListener('focusin', event => {
  let el = event.target;
  while (el && el !== body) {
    if (el.hasAttribute?.('data-enter')) { el.classList.add('entered'); enterObserver?.unobserve(el); }
    el = el.parentElement;
  }
});
// Opening a bookmarked section must not leave its heading hidden.
addEventListener('hashchange', () => {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const anchor = document.getElementById(id);
  if (!anchor) return;
  targets.forEach(el => {
    if (el === anchor || el.contains(anchor)) { el.classList.add('entered'); enterObserver?.unobserve(el); }
  });
});
document.addEventListener('visibilitychange', () => { if (document.hidden) finishCounters(); });
initialize();
scrollFrame();
