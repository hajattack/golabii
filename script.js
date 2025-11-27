/**
 * GOLABII — Luxury Interactions V2
 * Grayscale-to-color, smooth rose cursor, rose explosion, scroll reveals
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PAGE LOADER & HERO COLOR TRANSITION
  // ==========================================
  const loader = document.getElementById('pageLoader');
  const heroImg = document.getElementById('heroImg');
  
  window.addEventListener('load', () => {
    // Fade out loader
    setTimeout(() => {
      loader.classList.add('loaded');
      
      // After loader fades, reveal hero color
      setTimeout(() => {
        if (heroImg) {
          heroImg.classList.add('color-revealed');
        }
      }, 400);
    }, 600);
  });

  // Fallback: ensure loader disappears and color reveals
  setTimeout(() => {
    loader.classList.add('loaded');
    if (heroImg) {
      heroImg.classList.add('color-revealed');
    }
  }, 3500);

  // ==========================================
  // 2. CUSTOM ROSE CURSOR (Smooth & Animated)
  // ==========================================
  const cursor = document.getElementById('roseCursor');
  
  if (cursor && window.innerWidth > 900) {
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    const smoothing = 0.15; // Lower = smoother lag
    
    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    // Smooth cursor follow with requestAnimationFrame
    function animateCursor() {
      // Lerp (linear interpolation) for smooth follow
      cursorX += (mouseX - cursorX) * smoothing;
      cursorY += (mouseY - cursorY) * smoothing;
      
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Click animation
    document.addEventListener('mousedown', () => {
      cursor.classList.add('clicking');
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });
    
    // Hover state for interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .nav-card, .btn-gold');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('hovering');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hovering');
      });
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
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 4. ROSE EXPLOSION ON BUTTON CLICK
  // ==========================================
  const roseSVGs = [
    // Red rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#c41e3a"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#e84a6f"/></svg>`,
    // Yellow rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#D4A84B"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f0d78c"/></svg>`,
    // Pink rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#E8C4B8"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#f8ddd5"/></svg>`,
    // Deep red rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 6c-2-7-10-8-10-1s8 7 10 11c2-4 10-5 10-11s-8-6-10 1z" fill="#8B2332"/><path d="M16 10c-1.5-5-7-6-7-1s6 5 7 8c1-3 7-4 7-8s-6-4-7 1z" fill="#b83a4b"/></svg>`
  ];

  function createRoseExplosion(container) {
    const roseCount = 24;
    
    for (let i = 0; i < roseCount; i++) {
      const rose = document.createElement('div');
      rose.className = 'rose-particle';
      
      // Random rose type
      const roseSVG = roseSVGs[Math.floor(Math.random() * roseSVGs.length)];
      rose.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(roseSVG)}")`;
      
      // Random explosion direction (full 360 degrees)
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
      
      // Remove after animation
      setTimeout(() => {
        rose.remove();
      }, 1600);
    }
  }

  // Hero button
  const heroBtn = document.getElementById('heroJoinBtn');
  const roseExplosion = document.getElementById('roseExplosion');
  
  if (heroBtn && roseExplosion) {
    heroBtn.addEventListener('click', (e) => {
      e.preventDefault();
      createRoseExplosion(roseExplosion);
      setTimeout(() => {
        window.location.href = 'waitlist.html';
      }, 400);
    });
  }

  // Thank you section button
  const thankYouSection = document.getElementById('section-6');
  if (thankYouSection) {
    const ctaBtn = thankYouSection.querySelector('.btn-gold');
    const roseExplosion2 = document.getElementById('roseExplosion2');
    
    if (ctaBtn && roseExplosion2) {
      ctaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createRoseExplosion(roseExplosion2);
        setTimeout(() => {
          window.location.href = 'waitlist.html';
        }, 400);
      });
    }
  }

  // ==========================================
  // 5. SMOOTH SCROLL FOR ANCHOR LINKS
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
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ==========================================
  // 6. NAV BACKGROUND ENHANCEMENT ON SCROLL
  // ==========================================
  const nav = document.querySelector('.main-nav');
  
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        nav.style.background = 'rgba(255, 253, 249, 0.97)';
        nav.style.boxShadow = '0 4px 30px rgba(74, 14, 28, 0.12)';
      } else {
        nav.style.background = 'rgba(255, 253, 249, 0.92)';
        nav.style.boxShadow = '0 4px 24px rgba(74, 14, 28, 0.08)';
      }
    });
  }

  // ==========================================
  // 7. CARD NAV HOVER SOUND EFFECT (Optional)
  // ==========================================
  // Subtle visual feedback already handled in CSS
  // Could add audio here if desired

});
