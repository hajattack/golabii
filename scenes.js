(() => {
  'use strict';
  const loader = document.getElementById('pageLoader');
  const skip = document.getElementById('skipOpening');
  const replay = document.getElementById('replayOpening');
  const rug = document.getElementById('rugScene');
  const experience = document.getElementById('intro');
  const choices = [...document.querySelectorAll('[data-rug-choice]')];
  const background = [...document.querySelectorAll('body > nav, body > main, body > footer')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let releaseTimer, cleanupTimer, mountPending, scene;
  let opening = false;
  let replaying = false;
  let sceneVisible = true;
  let restoreFocus;

  function prepareRug() {
    if (!rug.hasAttribute('src')) rug.src = rug.dataset.src;
  }
  function sendVisibility() {
    rug.contentWindow?.postMessage({ type: 'scene-visibility', visible: sceneVisible && !document.hidden && !opening }, location.origin);
  }
  function releaseOpening() {
    if (!opening) return;
    opening = false;
    clearTimeout(releaseTimer);
    const shouldRestoreFocus = loader.contains(document.activeElement);
    loader.classList.add('loaded');
    loader.setAttribute('aria-hidden', 'true');
    loader.inert = true;
    document.documentElement.classList.remove('has-floral-opening');
    background.forEach(node => { node.inert = false; });
    prepareRug();
    sendVisibility();
    if (replaying || shouldRestoreFocus) {
      const target = replaying ? replay : document.querySelector('.main-nav a');
      target?.focus({ preventScroll: true });
    }
    // Let the same scene fade out, then release its GPU resources.
    cleanupTimer = setTimeout(() => {
      scene?.dispose();
      scene = null;
      loader.spatialScene = null;
    }, reducedMotion.matches ? 0 : 880);
  }
  function mountScene() {
    if (scene) { scene.resume(); return; }
    if (mountPending || !window.GolabiiFloralScene) return;
    mountPending = window.GolabiiFloralScene.mount(loader).then(controller => {
      if (!opening) { controller.dispose(); return; }
      scene = controller;
      loader.spatialScene = controller;
      controller.resume();
    }).catch(() => {
      loader.dataset.spatialState = 'fallback';
      document.getElementById('openingHint').textContent = 'Golabii in bloom';
    }).finally(() => { mountPending = null; });
  }
  function showOpening(isReplay = false) {
    clearTimeout(cleanupTimer);
    clearTimeout(releaseTimer);
    restoreFocus = document.activeElement;
    opening = true;
    replaying = isReplay;
    loader.inert = false;
    loader.removeAttribute('aria-hidden');
    loader.classList.remove('loaded');
    document.documentElement.classList.add('has-floral-opening');
    background.forEach(node => { node.inert = true; });
    skip.focus({ preventScroll: true });
    requestAnimationFrame(() => { if (opening) skip.focus({ preventScroll: true }); });
    sendVisibility();
    mountScene();
    // One fixed opening timeline, never restarted by an asset becoming ready.
    // Replaying is intentional exploration; Enter or Escape exits immediately.
    if (!isReplay) releaseTimer = setTimeout(releaseOpening, reducedMotion.matches ? 1300 : 5200);
  }
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === rug.contentWindow && event.data?.type === 'rug-ready') sendVisibility();
  });
  for (const button of choices) {
    button.addEventListener('click', () => {
      const choice = button.dataset.rugChoice;
      if (experience.dataset.rug === choice) return;
      experience.dataset.rug = choice;
      choices.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
      rug.title = `${choice === 'yellow' ? 'Saffron yellow' : 'Burgundy velvet'} rug — drag to uncover the bottle`;
      rug.src = `scenes/rug-${choice}.html`;
    });
  }
  rug.addEventListener('load', sendVisibility);
  new IntersectionObserver(([entry]) => {
    sceneVisible = entry.isIntersecting;
    sendVisibility();
  }, { threshold: 0.01 }).observe(rug);
  document.addEventListener('visibilitychange', sendVisibility);
  skip.addEventListener('click', releaseOpening);
  replay.addEventListener('click', () => showOpening(true));
  document.getElementById('tiltOpening').addEventListener('click', () => clearTimeout(releaseTimer));
  document.addEventListener('keydown', event => {
    if (!opening) return;
    if (event.key === 'Escape') releaseOpening();
    if (event.key === 'Tab') {
      const controls = [...loader.querySelectorAll('button')].filter(button => !button.hidden && !button.disabled && getComputedStyle(button).display !== 'none');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('pagehide', () => { scene?.dispose(); scene = null; });
  window.addEventListener('pageshow', event => { if (event.persisted && opening) mountScene(); });
  showOpening();
  // Begin the next scene after the opening has had first access to decoding.
  setTimeout(prepareRug, 1800);
})();
