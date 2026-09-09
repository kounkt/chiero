// The accepted A design, drawn as real responsive geometry rather than a video.
const scene = document.querySelector('[data-editorial-orbits]');
if (scene) {
  const hero = scene.closest('.corporate-hero');
  const orb = scene.querySelector('.editorial-orb');
  const paths = [...scene.querySelectorAll('.orbit-line')];
  const dots = [...scene.querySelectorAll('.orbit-point')];
  const ends = [...scene.querySelectorAll('.orbit-end')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const curves = [
    [14, 500, 228, 482, 483, 460, 646, 44],
    [28, 516, 279, 478, 509, 409, 649, 156],
    [75, 515, 300, 499, 532, 386, 650, 226],
    [50, 488, 242, 457, 471, 379, 634, 111],
  ];
  let frame = 0, previous = null, elapsed = 0, visible = true;
  const pointer = {x: 0, y: 0, targetX: 0, targetY: 0};
  const allowed = () => visible && !document.hidden && !reduced.matches && !document.body.classList.contains('motion-off');
  const cubic = (a, b, c, d, t) => (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d;
  const fixed = n => n.toFixed(2);

  function draw(time) {
    pointer.x += (pointer.targetX - pointer.x) * .045;
    pointer.y += (pointer.targetY - pointer.y) * .045;
    orb.setAttribute('transform', `translate(${fixed(Math.sin(time*.42)*8 + pointer.x*7)} ${fixed(Math.sin(time*.31)*10 + pointer.y*7)})`);
    curves.forEach((base, i) => {
      const c = [...base];
      c[3] += Math.sin(time*.35+i)*14 + pointer.y*12;
      c[4] += Math.sin(time*.29+i)*12 + pointer.x*14;
      c[5] += Math.sin(time*.43+i)*18 + pointer.y*9;
      c[6] += Math.sin(time*.23+i)*5;
      c[7] += Math.sin(time*.27+i)*9;
      paths[i].setAttribute('d', `M ${fixed(c[0])} ${fixed(c[1])} C ${fixed(c[2])} ${fixed(c[3])} ${fixed(c[4])} ${fixed(c[5])} ${fixed(c[6])} ${fixed(c[7])}`);
      const t = (time*.027 + .36 + i*.16) % 1;
      dots[i].setAttribute('cx', fixed(cubic(c[0],c[2],c[4],c[6],t)));
      dots[i].setAttribute('cy', fixed(cubic(c[1],c[3],c[5],c[7],t)));
      if (ends[i]) {
        ends[i].setAttribute('cx', fixed(c[6]));
        ends[i].setAttribute('cy', fixed(c[7]));
      }
    });
  }

  function tick(now) {
    frame = 0;
    if (!allowed()) { previous = null; return; }
    if (previous !== null) elapsed += Math.min(now - previous, 50) / 1000;
    previous = now;
    draw(elapsed);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
    if (allowed()) frame = requestAnimationFrame(tick);
  }

  hero.addEventListener('pointermove', event => {
    if (!finePointer.matches || !allowed()) return;
    const box = hero.getBoundingClientRect();
    pointer.targetX = Math.max(-1, Math.min(1, (event.clientX-box.left)/box.width*2-1));
    pointer.targetY = Math.max(-1, Math.min(1, (event.clientY-box.top)/box.height*2-1));
  }, {passive: true});
  hero.addEventListener('pointerleave', () => { pointer.targetX = pointer.targetY = 0; });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, {rootMargin: '50px'}).observe(hero);
  }
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('chiero:motionchange', sync);
  reduced.addEventListener('change', sync);
  draw(0);
  sync();
}
