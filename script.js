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
// Gentle float on hero cards
document.querySelectorAll('.card').forEach((el) => {
  el.style.transition = 'transform .6s ease, box-shadow .2s ease';
  el.addEventListener('pointermove', e => {
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `translateY(${ -2 + dy * -2 }px) rotate(${dx * 1.2}deg)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = 'translateY(0) rotate(0)';
  });
});