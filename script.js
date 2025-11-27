/**
 * GOLABII — Luxury Interactions V3
 * Video proximity playback, smooth cursor, scroll reveals
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PAGE LOADER & HERO COLOR TRANSITION
  // ==========================================
  const loader = document.getElementById('pageLoader');
  const heroImg = document.getElementById('heroImg');
  
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('loaded');
      
      setTimeout(() => {
        if (heroImg) {
          heroImg.classList.add('color-revealed');
        }
      }, 400);
    }, 600);
  });

  // Fallback
  setTimeout(() => {
    loader.classList.add('loaded');
    if (heroImg) {
      heroImg.classList.add('color-revealed');
    }
  }, 3500);

  // ==========================================
  // 2. CUSTOM ROSE CURSOR (Smooth Follow)
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

    document.addEventListener('mousedown', () => {
      cursor.classList.add('clicking');
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });
    
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
  const allVideos = document.querySelectorAll('.section-video');
  let currentlyPlaying = null;

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        // Pause any currently playing video
        if (currentlyPlaying && currentlyPlaying !== video) {
          currentlyPlaying.pause();
          currentlyPlaying.classList.remove('playing');
        }
        
        // Play this video
        video.play().then(() => {
          video.classList.add('playing');
          currentlyPlaying = video;
        }).catch(err => {
          // Autoplay might be blocked, show video anyway
          video.classList.add('playing');
          console.log('Video autoplay prevented:', err);
        });
      } else {
        // Pause when out of view
        if (video === currentlyPlaying) {
          video.pause();
          video.classList.remove('playing');
          currentlyPlaying = null;
        }
      }
    });
  }, {
    threshold: [0, 0.5, 1],
    rootMargin: '-10% 0px -10% 0px'
  });

  allVideos.forEach(video => {
    // Preload and set initial state
    video.load();
    videoObserver.observe(video);
  });

  // ==========================================
  // 5. SMOOTH SCROLL FOR CARD NAV & ANCHORS
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
        
        // Calculate offset for fixed nav
        const navHeight = document.querySelector('.main-nav')?.offsetHeight || 70;
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
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#c41e3a"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#e84a6f"/></svg>`,
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#D4A84B"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f0d78c"/></svg>`,
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#E8C4B8"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f8ddd5"/></svg>`,
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#8B2332"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#b83a4b"/></svg>`
  ];

  function createRoseExplosion(container) {
    const roseCount = 24;
    
    for (let i = 0; i < roseCount; i++) {
      const rose = document.createElement('div');
      rose.className = 'rose-particle';
      
      const roseSVG = roseSVGs[Math.floor(Math.random() * roseSVGs.length)];
      rose.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(roseSVG)}")`;
      
      const angle = (Math.PI * 2 * i) / roseCount + (Math.random() - 0.5) * 0.6;
      const distance = 100 + Math.random() * 140;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const rotation = Math.random() * 900 - 450;
      
      rose.style.setProperty('--tx', tx + 'px');
      rose.style.setProperty('--ty', ty + 'px');
      rose.style.setProperty('--r', rotation + 'deg');
      rose.style.animationDelay = Math.random() * 0.12 + 's';
      rose.style.width = (18 + Math.random() * 14) + 'px';
      rose.style.height = rose.style.width;
      
      container.appendChild(rose);
      
      setTimeout(() => rose.remove(), 1600);
    }
  }

  // Thank you section button
  const roseExplosion = document.getElementById('roseExplosion');
  if (roseExplosion) {
    const parentSection = roseExplosion.closest('.content-section');
    const ctaBtn = parentSection?.querySelector('.btn-chic');
    
    if (ctaBtn) {
      ctaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createRoseExplosion(roseExplosion);
        setTimeout(() => {
          window.location.href = 'waitlist.html';
        }, 400);
      });
    }
  }

  // ==========================================
  // 7. NAV ENHANCEMENT ON SCROLL
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
  // 8. MOBILE CARD NAV TOUCH SCROLL
  // ==========================================
  const cardStrip = document.querySelector('.card-nav-strip');
  
  if (cardStrip && window.innerWidth <= 900) {
    let isDown = false;
    let startX;
    let scrollLeft;

    cardStrip.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - cardStrip.offsetLeft;
      scrollLeft = cardStrip.scrollLeft;
    });

    cardStrip.addEventListener('mouseleave', () => {
      isDown = false;
    });

    cardStrip.addEventListener('mouseup', () => {
      isDown = false;
    });

    cardStrip.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - cardStrip.offsetLeft;
      const walk = (x - startX) * 2;
      cardStrip.scrollLeft = scrollLeft - walk;
    });
  }

});
