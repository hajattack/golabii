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
// There are no floating cards in the refined hero.
// The script now only handles the mobile nav toggle defined above.