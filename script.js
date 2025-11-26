/**
 * GOLABII — Cinematic Interactions
 * Page loader, scroll reveals, particles, rose cursor, rose explosion
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. PAGE LOADER
  // ==========================================
  const loader = document.querySelector('.page-loader');
  
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('loaded');
    }, 800);
  });

  // Fallback: remove loader after 3s max
  setTimeout(() => {
    loader.classList.add('loaded');
  }, 3000);

  // ==========================================
  // 2. CUSTOM ROSE CURSOR
  // ==========================================
  const cursor = document.querySelector('.rose-cursor');
  
  if (cursor && window.innerWidth > 900) {
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    document.addEventListener('mousedown', () => {
      cursor.classList.add('clicking');
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });
  }

  // ==========================================
  // 3. SCROLL REVEAL ANIMATIONS
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal-up, .depth-reveal');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 4. FLOATING PARTICLES
  // ==========================================
  const particlesContainer = document.getElementById('particles');
  
  if (particlesContainer) {
    const particleCount = 25;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (6 + Math.random() * 4) + 's';
      particle.style.width = (4 + Math.random() * 4) + 'px';
      particle.style.height = particle.style.width;
      particle.style.opacity = 0.3 + Math.random() * 0.5;
      particlesContainer.appendChild(particle);
    }
  }

  // ==========================================
  // 5. ROSE EXPLOSION ON BUTTON CLICK
  // ==========================================
  const roseSVGs = [
    // Red rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 8c-2-6-9-7-9-1s7 6 9 10c2-4 9-4 9-10s-7-5-9 1z" fill="#8B2332"/><path d="M16 12c-1.5-4-6-5-6-1s5 4 6 7c1-3 6-3 6-7s-5-3-6 1z" fill="#B83A4B"/></svg>`,
    // Yellow rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 8c-2-6-9-7-9-1s7 6 9 10c2-4 9-4 9-10s-7-5-9 1z" fill="#D4A84B"/><path d="M16 12c-1.5-4-6-5-6-1s5 4 6 7c1-3 6-3 6-7s-5-3-6 1z" fill="#E8D5A3"/></svg>`,
    // Pink rose
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 8c-2-6-9-7-9-1s7 6 9 10c2-4 9-4 9-10s-7-5-9 1z" fill="#E8C4B8"/><path d="M16 12c-1.5-4-6-5-6-1s5 4 6 7c1-3 6-3 6-7s-5-3-6 1z" fill="#F5DED6"/></svg>`
  ];

  function createRoseExplosion(container) {
    const roseCount = 20;
    
    for (let i = 0; i < roseCount; i++) {
      const rose = document.createElement('div');
      rose.className = 'rose-particle';
      
      // Random rose type
      const roseSVG = roseSVGs[Math.floor(Math.random() * roseSVGs.length)];
      rose.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(roseSVG)}")`;
      
      // Random explosion direction
      const angle = (Math.PI * 2 * i) / roseCount + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const rotation = Math.random() * 720 - 360;
      
      rose.style.setProperty('--tx', tx + 'px');
      rose.style.setProperty('--ty', ty + 'px');
      rose.style.setProperty('--r', rotation + 'deg');
      rose.style.animationDelay = Math.random() * 0.1 + 's';
      rose.style.width = (15 + Math.random() * 15) + 'px';
      rose.style.height = rose.style.width;
      
      container.appendChild(rose);
      
      // Remove after animation
      setTimeout(() => {
        rose.remove();
      }, 1500);
    }
  }

  // Attach to buttons
  const heroBtn = document.getElementById('heroJoinBtn');
  const roseExplosion = document.getElementById('roseExplosion');
  
  if (heroBtn && roseExplosion) {
    heroBtn.addEventListener('click', (e) => {
      createRoseExplosion(roseExplosion);
      // Navigate after a short delay
      setTimeout(() => {
        window.location.href = '#waitlist';
      }, 300);
    });
  }

  const ctaBtn = document.getElementById('ctaJoinBtn');
  const roseExplosion2 = document.getElementById('roseExplosion2');
  
  if (ctaBtn && roseExplosion2) {
    ctaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      createRoseExplosion(roseExplosion2);
      // Navigate after explosion
      setTimeout(() => {
        window.location.href = 'waitlist.html';
      }, 500);
    });
  }

  // ==========================================
  // 6. OVERSCROLL HEADER (Pull-down reveal)
  // ==========================================
  const overscrollHeader = document.querySelector('.overscroll-header');
  let lastScrollY = 0;
  let overscrollActive = false;

  if (overscrollHeader) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      
      // Detect overscroll at top (negative scroll or bounce)
      if (scrollY <= 0 && !overscrollActive) {
        // Check if user is pulling down
        overscrollHeader.classList.add('visible');
        overscrollActive = true;
        
        setTimeout(() => {
          overscrollHeader.classList.remove('visible');
          overscrollActive = false;
        }, 800);
      }
      
      lastScrollY = scrollY;
    });

    // Touch events for mobile overscroll
    let touchStartY = 0;
    
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    });

    document.addEventListener('touchmove', (e) => {
      const touchY = e.touches[0].clientY;
      const scrollY = window.scrollY;
      
      // If at top and pulling down
      if (scrollY <= 0 && touchY > touchStartY + 50 && !overscrollActive) {
        overscrollHeader.classList.add('visible');
        overscrollActive = true;
      }
    });

    document.addEventListener('touchend', () => {
      if (overscrollActive) {
        setTimeout(() => {
          overscrollHeader.classList.remove('visible');
          overscrollActive = false;
        }, 500);
      }
    });
  }

  // ==========================================
  // 7. PARALLAX EFFECT ON HERO
  // ==========================================
  const heroBg = document.querySelector('.hero-bg img');
  
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY < window.innerHeight) {
        heroBg.style.transform = `scale(1.1) translateY(${scrollY * 0.3}px)`;
      }
    });
  }

  // ==========================================
  // 8. SMOOTH SCROLL FOR ANCHOR LINKS
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ==========================================
  // 9. NAV BACKGROUND ON SCROLL
  // ==========================================
  const nav = document.querySelector('.main-nav');
  
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        nav.style.background = 'rgba(253, 246, 233, 0.98)';
        nav.style.boxShadow = '0 8px 32px rgba(74, 14, 28, 0.15)';
      } else {
        nav.style.background = 'rgba(253, 246, 233, 0.9)';
        nav.style.boxShadow = '0 8px 32px rgba(74, 14, 28, 0.1)';
      }
    });
  }

});
