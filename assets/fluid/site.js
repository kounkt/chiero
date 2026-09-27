import {startFluid} from './engine.js?v=f181acbd77eb';

function initialize() {
  const hero = document.getElementById('fluid-hero');
  if (!hero) return;
  const canvas = document.getElementById('official-fluid');
  const pause = document.getElementById('fluid-pause');
  const tools = hero.querySelector('.fluid-tools');
  const footer = document.querySelector('.motion-button, #motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;

  function showFallback() {
    hero.classList.add('no-fluid');
    hero.dataset.ready = 'false';
    tools.hidden = true;
    document.getElementById('fluid-fallback').hidden = false;
  }
  function setPaused(value) {
    engine?.pause(value);
    document.body.classList.toggle('motion-off', value);
    document.documentElement.classList.toggle('motion-paused', value);
    if (footer) {
      footer.setAttribute('aria-pressed', String(value));
      footer.textContent = value ? '動きを再開する' : '動きを止める';
    }
    document.dispatchEvent(new Event('chiero:motionchange'));
  }
  if (matchMedia('(pointer:coarse)').matches) {
    document.getElementById('touch-hint').textContent = '指で横になぞると、色が流れます。';
  }
  try {
    // Size the visible canvas before allocating the GPU framebuffers.
    hero.classList.remove('no-fluid');
    engine = startFluid(canvas, hero, state => {
      pause.textContent = state.paused ? '動きを再開' : '動きを止める';
      pause.setAttribute('aria-pressed', String(state.paused));
      hero.dataset.running = String(state.running);
    });
    window.chieroFluid = engine;
    hero.classList.remove('no-fluid');
    hero.dataset.ready = 'true';
    tools.hidden = false;
  } catch (error) {
    showFallback();
    console.warn('Fluid background is unavailable; using the static image.', error.message);
    return;
  }
  // Use the existing footer control so its own motion state stays in sync.
  pause.addEventListener('click', () => {
    if (footer) footer.click();
    else setPaused(!engine.getState().paused);
  });
  document.addEventListener('click', event => {
    if (footer && footer.contains(event.target)) {
      setPaused(footer.getAttribute('aria-pressed') === 'true');
    }
  });
  document.getElementById('fluid-burst').addEventListener('click', () => engine.burst());
  reduced.addEventListener('change', event => setPaused(event.matches));
  canvas.addEventListener('webglcontextlost', showFallback);
  setPaused(reduced.matches || document.body.classList.contains('motion-off') || document.documentElement.classList.contains('motion-paused'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
else initialize();
