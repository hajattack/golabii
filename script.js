// Mobile nav toggle
const burger = document.querySelector('.burger');
if (burger) {
  burger.addEventListener('click', () => {
    const nav = document.querySelector('.nav nav');
    const open = getComputedStyle(nav).display !== 'none';
    nav.style.display = open ? 'none' : 'flex';
    burger.setAttribute('aria-expanded', String(!open));
  });
}
// Animate image cards to float around the viewport and bounce off edges.
window.addEventListener('load', () => {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    // Disable pointer interactions for floating cards
    card.style.pointerEvents = 'none';
    // Determine card dimensions
    const rect = card.getBoundingClientRect();
    let w = rect.width || card.offsetWidth;
    let h = rect.height || card.offsetHeight;
    // Compute the vertical boundary (hero section height)
    const hero = document.querySelector('.hero');
    const heroHeight = hero ? hero.offsetHeight : window.innerHeight * 0.5;
    // Initialize position within hero bounds
    let x = Math.random() * (window.innerWidth - w);
    let y = Math.random() * (heroHeight - h);
    // Slow velocity: between 0.05 and 0.15 pixels per millisecond
    let vx = (Math.random() * 0.10 + 0.05) * (Math.random() < 0.5 ? -1 : 1);
    let vy = (Math.random() * 0.10 + 0.05) * (Math.random() < 0.5 ? -1 : 1);
    // Apply initial transform
    card.style.transform = `translate(${x}px, ${y}px)`;
    function animateCard() {
      x += vx;
      y += vy;
      // Bounce on horizontal edges
      if (x <= 0) {
        x = 0;
        vx *= -1;
      } else if (x + w >= window.innerWidth) {
        x = window.innerWidth - w;
        vx *= -1;
      }
      // Bounce within the hero's vertical bounds
      if (y <= 0) {
        y = 0;
        vy *= -1;
      } else if (y + h >= heroHeight) {
        y = heroHeight - h;
        vy *= -1;
      }
      card.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(animateCard);
    }
    requestAnimationFrame(animateCard);
  });
});