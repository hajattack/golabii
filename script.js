
const menuIcon = document.getElementById('menuIcon');
const nav = document.querySelector('nav');

menuIcon.addEventListener('click', () => {
    nav.classList.toggle('open');
});
