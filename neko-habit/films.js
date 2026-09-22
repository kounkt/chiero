// Native controls remain usable if JavaScript is unavailable.
const player = document.querySelector('#habit-film');
if (player) {
  const choices = [...document.querySelectorAll('[data-film]')];
  const caption = document.querySelector('#film-caption');
  const status = document.querySelector('.film-status');
  const cover = document.querySelector('.film-cover');
  cover.hidden = false;
  const play = () => {
    cover.hidden = true;
    player.play().catch(() => { cover.hidden = false; });
  };
  cover.addEventListener('click', play);

  choices.forEach(choice => choice.addEventListener('click', () => {
    if (choice.getAttribute('aria-pressed') !== 'true') {
      player.pause();
      choices.forEach(item => item.setAttribute('aria-pressed', String(item === choice)));
      player.poster = choice.dataset.poster;
      player.src = choice.dataset.film;
      player.setAttribute('aria-label', `${choice.dataset.title} 20秒の紹介動画`);
      player.querySelector('a').href = choice.dataset.film;
      caption.textContent = `${choice.dataset.title} · 20秒`;
      status.querySelector('a').href = choice.dataset.film;
      cover.querySelector('img').src = choice.dataset.poster;
      cover.setAttribute('aria-label', `${choice.dataset.title}を再生`);
      status.hidden = true;
      player.load();
    }
    // The user explicitly chooses a film; never autoplay on page load.
    play();
  }));

  player.addEventListener('error', () => { status.hidden = false; });
  player.addEventListener('loadedmetadata', () => { status.hidden = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.pause();
  });
}
