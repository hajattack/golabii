(() => {
  'use strict';
  const loader = document.getElementById('pageLoader');
  const floral = document.getElementById('floralOpening');
  const skip = document.getElementById('skipOpening');
  const replay = document.getElementById('replayOpening');
  const rug = document.getElementById('rugScene');
  const experience = document.getElementById('intro');
  const choices = [...document.querySelectorAll('[data-rug-choice]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let releaseTimer, safetyTimer, cleanupTimer;
  let opening = false;
  let replaying = false;
  let sceneVisible = true;

  function releaseOpening() {
    if (!opening) return;
    opening = false;
    clearTimeout(releaseTimer);
    clearTimeout(safetyTimer);
    loader.classList.add('loaded');
    loader.setAttribute('aria-hidden', 'true');
    loader.inert = true;
    if (replaying || document.activeElement === skip) replay.focus({ preventScroll: true });
    cleanupTimer = setTimeout(() => {
      // Unload the WebGL scene after the fade to free its graphics resources.
      floral.src = 'about:blank';
      floral.classList.remove('is-ready');
    }, reducedMotion ? 0 : 850);
  }

  function showOpening(isReplay = false) {
    clearTimeout(cleanupTimer);
    clearTimeout(releaseTimer);
    clearTimeout(safetyTimer);
    opening = true;
    replaying = isReplay;
    loader.dataset.artwork = 'static';
    loader.inert = false;
    loader.removeAttribute('aria-hidden');
    loader.classList.remove('loaded');
    floral.classList.remove('is-ready');
    // Preserve the original artwork when reduced motion is preferred.
    if (reducedMotion) {
      releaseTimer = setTimeout(releaseOpening, 1800);
    } else {
      floral.src = 'scenes/floral.html';
    }
    // No network or graphics failure can leave the opening covering the site.
    safetyTimer = setTimeout(releaseOpening, 5000);
    if (isReplay) skip.focus({ preventScroll: true });
  }

  function sendVisibility() {
    rug.contentWindow?.postMessage({ type: 'scene-visibility', visible: sceneVisible && !document.hidden }, location.origin);
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    if (event.source === floral.contentWindow && opening) {
      if (event.data?.type === 'floral-ready') {
        loader.dataset.artwork = 'spatial';
        floral.classList.add('is-ready');
        clearTimeout(releaseTimer);
        releaseTimer = setTimeout(releaseOpening, 1800);
      } else if (event.data?.type === 'floral-fallback') {
        clearTimeout(releaseTimer);
        releaseTimer = setTimeout(releaseOpening, 1800);
      }
    }
    if (event.source === rug.contentWindow && event.data?.type === 'rug-ready') sendVisibility();
  });

  for (const button of choices) {
    button.addEventListener('click', () => {
      const choice = button.dataset.rugChoice;
      if (experience.dataset.rug === choice) return;
      experience.dataset.rug = choice;
      for (const option of choices) option.setAttribute('aria-pressed', String(option === button));
      rug.title = `${choice === 'yellow' ? 'Saffron yellow' : 'Burgundy velvet'} rug — drag to uncover the bottle`;
      // One iframe at a time: switching colors releases the previous simulation.
      rug.src = `scenes/rug-${choice}.html${choice === 'burgundy' ? '?v=overflow-01' : ''}`;
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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opening) releaseOpening();
  });
  showOpening();
})();
