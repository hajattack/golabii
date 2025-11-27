/**
 * GOLABII — Luxury Interactions V3.1
 * Fixed: Video loading, loader timing, mobile nav
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PAGE LOADER WITH PROGRESS BAR
  // ==========================================
  const loader = document.getElementById('pageLoader');
  const loaderBar = document.getElementById('loaderBar');
  const heroImg = document.getElementById('heroImg');
  const allVideos = document.querySelectorAll('.section-video');
  
  let loadProgress = 0;
  let assetsLoaded = 0;
  const totalAssets = allVideos.length + 1; // videos + hero image
  
  function updateProgress() {
    assetsLoaded++;
    loadProgress = Math.min((assetsLoaded / totalAssets) * 100, 100);
    if (loaderBar) {
      loaderBar.style.width = loadProgress + '%';
    }
  }
  
  // Track hero image load
  if (heroImg) {
    if (heroImg.complete) {
      updateProgress();
    } else {
      heroImg.addEventListener('load', updateProgress);
    }
  }
  
  // Track video metadata load
  allVideos.forEach(video => {
    if (video.readyState >= 1) {
      updateProgress();
    } else {
      video.addEventListener('loadedmetadata', updateProgress);
    }
  });
  
  // Minimum loader time + wait for assets
  function hideLoader() {
    if (loaderBar) loaderBar.style.width = '100%';
    
    setTimeout(() => {
      loader.classList.add('loaded');
      
      // Reveal hero color after loader fades
      setTimeout(() => {
        if (heroImg) {
          heroImg.classList.add('color-revealed');
        }
      }, 500);
    }, 300);
  }
  
  // Wait at least 2 seconds, then check if assets are ready
  setTimeout(() => {
    if (loadProgress >= 80 || assetsLoaded >= totalAssets - 1) {
      hideLoader();
    } else {
      // Wait a bit more for slow connections
      setTimeout(hideLoader, 1500);
    }
  }, 2000);
  
  // Fallback: always hide loader after 5 seconds
  setTimeout(() => {
    loader.classList.add('loaded');
    if (heroImg) heroImg.classList.add('color-revealed');
  }, 5000);

  // ==========================================
  // 2. CUSTOM ROSE CURSOR
  // ==========================================
  const cursor = document.getElementById('roseCursor');
  
  if (cursor && window.innerWidth > 900) {
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    const smoothing = 0.15;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    function animateCursor() {
      cursorX += (mouseX - cursorX) * smoothing;
      cursorY += (mouseY - cursorY) * smoothing;
      
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
    
    const interactiveElements = document.querySelectorAll('a, button, .nav-card, .btn-chic');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
  }

  // ==========================================
  // 3. SCROLL REVEAL ANIMATIONS
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
  // 4. VIDEO PROXIMITY PLAYBACK (One at a time)
  // ==========================================
  let currentlyPlaying = null;

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      
      if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
        // Pause any currently playing video
        if (currentlyPlaying && currentlyPlaying !== video) {
          currentlyPlaying.pause();
        }
        
        // Play this video
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            currentlyPlaying = video;
          }).catch(err => {
            // Autoplay blocked - that's okay, user can see poster
            console.log('Video autoplay prevented:', err.message);
          });
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

  // Initialize videos
  allVideos.forEach(video => {
    video.load();
    videoObserver.observe(video);
  });

  // ==========================================
  // 5. SMOOTH SCROLL FOR ANCHORS
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
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ==========================================
  // 6. ROSE EXPLOSION ON BUTTON CLICK
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
    const ctaBtn = roseExplosion.closest('.section-text')?.querySelector('.btn-chic');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createRoseExplosion(roseExplosion);
        setTimeout(() => window.location.href = 'waitlist.html', 400);
      });
    }
  }

  // ==========================================
  // 7. NAV SCROLL EFFECT
  // ==========================================
  const nav = document.querySelector('.main-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 60) {
        nav.style.background = 'rgba(255, 253, 249, 0.98)';
        nav.style.boxShadow = '0 4px 25px rgba(74, 14, 28, 0.1)';
      } else {
        nav.style.background = 'rgba(255, 253, 249, 0.95)';
        nav.style.boxShadow = '0 4px 20px rgba(74, 14, 28, 0.08)';
      }
    });
  }

  // ==========================================
  // 8. ANIMATED SPOTS COUNTER
  // ==========================================
  const spotsNumber = document.getElementById('spotsNumber');
  if (spotsNumber) {
    // Occasionally decrease the number for effect
    setInterval(() => {
      const current = parseInt(spotsNumber.textContent);
      if (current > 700 && Math.random() > 0.7) {
        spotsNumber.textContent = current - 1;
        spotsNumber.style.transform = 'scale(1.15)';
        setTimeout(() => spotsNumber.style.transform = 'scale(1)', 200);
      }
    }, 8000);
  }

});
