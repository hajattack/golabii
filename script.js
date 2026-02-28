/**
 * GOLABII — Interactions V4
 * Loader, scroll reveal, video playback, rose explosion
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PAGE LOADER + 3D MODEL PRELOAD
  // ==========================================
  const loader = document.getElementById('pageLoader');
  const bottleModel = document.getElementById('bottleModel');
  const modelContainer = document.getElementById('modelContainer');

  if (bottleModel && modelContainer) {
    modelContainer.classList.add('loading');

    bottleModel.addEventListener('progress', (e) => {
      const progressFill = bottleModel.querySelector('.model-progress-fill');
      if (progressFill && e.detail && e.detail.totalProgress !== undefined) {
        progressFill.style.width = (e.detail.totalProgress * 100) + '%';
      }
    });

    bottleModel.addEventListener('load', () => {
      modelContainer.classList.remove('loading');
      const progressBar = bottleModel.querySelector('.model-progress-bar');
      if (progressBar) progressBar.style.display = 'none';
    });
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('loaded');
    }, 1800);
  });

  setTimeout(() => {
    loader.classList.add('loaded');
  }, 5000);

  // ==========================================
  // 2. SCROLL REVEAL ANIMATIONS
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal-up');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 3. VIDEO PROXIMITY PLAYBACK (One at a time)
  // ==========================================
  const allVideos = document.querySelectorAll('.section-video');
  let currentlyPlaying = null;

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
        if (currentlyPlaying && currentlyPlaying !== video) {
          currentlyPlaying.pause();
        }

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            currentlyPlaying = video;
          }).catch(() => {});
        }
      } else if (!entry.isIntersecting && video === currentlyPlaying) {
        video.pause();
        currentlyPlaying = null;
      }
    });
  }, {
    threshold: [0, 0.4, 0.8],
    rootMargin: '-5% 0px -5% 0px'
  });

  allVideos.forEach(video => {
    video.load();
    videoObserver.observe(video);
  });

  // ==========================================
  // 4. SMOOTH SCROLL FOR ANCHORS
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = document.querySelector('.main-nav')?.offsetHeight || 60;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // ==========================================
  // 5. ROSE EXPLOSION ON BUTTON CLICK
  // ==========================================
  const roseSVGs = [
    `<svg viewBox="0 0 32 32"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#c41e3a"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#e84a6f"/></svg>`,
    `<svg viewBox="0 0 32 32"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#D4A84B"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f0d78c"/></svg>`,
    `<svg viewBox="0 0 32 32"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#E8C4B8"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f8ddd5"/></svg>`,
    `<svg viewBox="0 0 32 32"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#8B2332"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#b83a4b"/></svg>`
  ];

  function createRoseExplosion(container) {
    for (let i = 0; i < 24; i++) {
      const rose = document.createElement('div');
      rose.className = 'rose-particle';

      const roseSVG = roseSVGs[Math.floor(Math.random() * roseSVGs.length)];
      rose.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(roseSVG)}")`;

      const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.6;
      const distance = 100 + Math.random() * 140;

      rose.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
      rose.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
      rose.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
      rose.style.animationDelay = Math.random() * 0.12 + 's';
      rose.style.width = rose.style.height = (18 + Math.random() * 14) + 'px';

      container.appendChild(rose);
      setTimeout(() => rose.remove(), 1600);
    }
  }

  const roseExplosion = document.getElementById('roseExplosion');
  if (roseExplosion) {
    const ctaBtn = roseExplosion.closest('.section-inner-book')?.querySelector('.btn-chic');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createRoseExplosion(roseExplosion);
        setTimeout(() => window.location.href = 'waitlist.html', 400);
      });
    }
  }

});
