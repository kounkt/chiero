/* Carry the selected observation into an inquiry; nothing is submitted here. */
(() => {
  const selected = new URLSearchParams(location.search).get('work');
  if (!selected || !/^\d{3}\s/.test(selected)) return;
  const number = Number(selected.slice(0, 3));
  if (number < 1 || number > 49) return;
  const name = selected.replace(/[\r\n]/g, ' ').slice(0, 100);
  const link = document.querySelector('.contact a[href^="mailto:"]');
  const label = document.createElement('p');
  label.id = 'selected-work';
  label.textContent = (document.documentElement.lang === 'en' ? 'Work: ' : '対象作品：') + name;
  link.before(label);
  const url = new URL(link.href);
  url.searchParams.set('body', label.textContent + '\n\n' + (url.searchParams.get('body') || ''));
  link.href = url.href;
  const language = document.querySelector('nav a:last-child');
  const alternate = new URL(language.href);
  alternate.searchParams.set('work', name);
  language.href = alternate.href;
})();
