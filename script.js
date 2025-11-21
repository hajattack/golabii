document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Scroll Observer for Reveal Animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  const revealElements = document.querySelectorAll('.reveal-up');
  revealElements.forEach(el => observer.observe(el));


  // 2. Parallax Effect for Hero Image
  const heroVisual = document.querySelector('.parallax-target');
  
  if (heroVisual) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      // Only apply parallax if we are near the top to save performance
      if (scrollY < window.innerHeight) {
        // Move the image slightly slower than scroll
        // TranslateY moves it down as we scroll down, creating depth
        heroVisual.style.transform = `translateY(${scrollY * 0.15}px)`; 
      }
    });
  }

  // 3. Smooth Scroll for Anchor Links (enhancing native behavior)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });

});
