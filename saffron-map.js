/* Saffron drops map: the video plays once when the map is in view; after the last drop lands,
   a framed magnifier follows the cursor (or finger) and shows the school names beside each drop. */
(() => {
  'use strict';
  const map = document.getElementById('smMap');
  if (!map) return;
  const vid = document.getElementById('smVideo');
  const loupe = document.getElementById('smLoupe');
  const glass = document.getElementById('smGlass');
  const hint = document.getElementById('smHint');
  const replay = document.getElementById('smReplay');
  const spots = [...map.querySelectorAll('.sm-spot')];
  const BASE = 'assets/saffron-map/';
  const NAMES = BASE + 'names.webp?v=20261118';
  // READY: seconds into the video when the last drop has landed. UNITS/CAP size the names in the magnifier.
  const READY = 2.84, UNITS = 12.5502, CAP = 0.047, HI_W = 3360;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Touch the map to look closer';

  let primed = false, played = false, namesReady = false;

  // Fetch nothing heavy until the visitor is getting close to the section.
  function prime() {
    if (primed) return; primed = true;
    vid.poster = vid.dataset.poster;
    vid.preload = 'auto';
    vid.load();
  }
  function loadNames() {
    if (namesReady) return; namesReady = true;
    const im = new Image();
    im.onload = () => { glass.style.backgroundImage = `url("${NAMES}")`; };
    im.src = NAMES;
  }
  function settle() {
    if (map.classList.contains('settled')) return;
    map.classList.add('settled');
    loadNames();
    spots.forEach(b => { b.tabIndex = 0; });
  }
  function staticView() {
    const still = map.querySelector('.sm-still');
    if (!still.src) still.src = still.dataset.src;           // the finished frame is only fetched when the video can't play
    map.classList.add('static'); settle();
  }
  function play() {
    prime(); loadNames();
    vid.currentTime = 0;
    const p = vid.play();
    if (p) p.catch(staticView);
  }

  if (reduce) { prime(); staticView(); }
  vid.addEventListener('ended', settle);
  vid.addEventListener('timeupdate', () => { if (vid.currentTime >= READY) settle(); });
  vid.addEventListener('error', staticView, true);

  new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) prime();
  }, { rootMargin: '900px 0px' }).observe(map);
  new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting && e.intersectionRatio > 0.55 && !played && !reduce) { played = true; play(); }
  }), { threshold: [0, 0.55, 0.9] }).observe(map);

  replay.addEventListener('click', e => {
    e.stopPropagation();
    hide();
    map.classList.remove('settled', 'static');
    play();
  });

  // Magnifier: a framed window showing the same spot, enlarged, with the names printed beside the drops.
  function zoomFor(mw) { return Math.min(Math.max(1.5, 8.5 / (CAP * mw / UNITS)), 1.3 * HI_W / mw); }
  function show(x, y, touch) {
    if (!map.classList.contains('settled')) return;
    const mw = map.clientWidth, mh = map.clientHeight, lw = loupe.offsetWidth, lh = loupe.offsetHeight, z = zoomFor(mw);
    glass.style.backgroundSize = `${mw * z}px ${mh * z}px`;
    glass.style.backgroundPosition = `${lw / 2 - x * z}px ${lh / 2 - y * z}px`;
    const r = map.getBoundingClientRect();
    let top = touch ? y - lh - 26 : y - lh / 2;               // on touch, float above the finger
    if (touch && r.top + top < 8) top = y + 34;               // ...unless that would leave the screen
    let left = x - lw / 2;
    if (touch) left = Math.min(Math.max(left, 8 - r.left), innerWidth - r.left - lw - 8);
    loupe.style.left = `${left}px`;
    loupe.style.top = `${top}px`;
    loupe.classList.add('show');
    map.classList.add('used');
  }
  function hide() { loupe.classList.remove('show'); }
  function rel(e) { const r = map.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  map.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && !e.buttons && !e.pressure) return;
    const [x, y] = rel(e); show(x, y, e.pointerType === 'touch');
  });
  map.addEventListener('pointerdown', e => {
    if (e.target.closest('.sm-replay')) return;
    const [x, y] = rel(e); show(x, y, e.pointerType === 'touch');
  });
  map.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hide(); });
  document.addEventListener('pointerdown', e => { if (!map.contains(e.target)) hide(); });
  spots.forEach(b => {
    b.addEventListener('focus', () => show(b.offsetLeft, b.offsetTop, false));
    b.addEventListener('blur', hide);
  });
})();
