import {startFluid} from './engine.js?v=6f1206b4856d';

function initialize() {
  const hero = document.getElementById('fluid-hero');
  if (!hero) return;
  const canvas = document.getElementById('official-fluid');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;

  function showFallback() {
    hero.classList.add('no-fluid');
    hero.dataset.ready = 'false';
  }
  function setPaused(value) {
    engine?.pause(value);
    document.body.classList.toggle('motion-off', value);
    document.documentElement.classList.toggle('motion-paused', value);
    document.dispatchEvent(new Event('chiero:motionchange'));
  }
  try {
    // Size the visible canvas before allocating the GPU framebuffers.
    hero.classList.remove('no-fluid');
    engine = startFluid(canvas, hero, state => {
      hero.dataset.running = String(state.running);
    });
    window.chieroFluid = engine;
    hero.dataset.ready = 'true';
  } catch (error) {
    showFallback();
    console.warn('Fluid background is unavailable; using the static image.', error.message);
    return;
  }
  reduced.addEventListener('change', event => setPaused(event.matches));
  canvas.addEventListener('webglcontextlost', showFallback);
  setPaused(reduced.matches);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
else initialize();
