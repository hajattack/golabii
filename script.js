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
    // Initialize position and velocity
    const rect = card.getBoundingClientRect();
    let w = rect.width || card.offsetWidth;
    let h = rect.height || card.offsetHeight;
    let x = Math.random() * (window.innerWidth - w);
    let y = Math.random() * (window.innerHeight - h);
    // Velocity between 0.15 and 0.4 pixels per millisecond (converted in rAF)
    let vx = (Math.random() * 0.25 + 0.15) * (Math.random() < 0.5 ? -1 : 1);
    let vy = (Math.random() * 0.25 + 0.15) * (Math.random() < 0.5 ? -1 : 1);
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
      // Bounce on vertical edges
      if (y <= 0) {
        y = 0;
        vy *= -1;
      } else if (y + h >= window.innerHeight) {
        y = window.innerHeight - h;
        vy *= -1;
      }
      card.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(animateCard);
    }
    requestAnimationFrame(animateCard);
  });
});