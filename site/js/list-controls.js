(function () {
  const btnCompact = document.getElementById('btn-view-compact');
  const linksRoot = document.getElementById('verbs-links');
  if (!btnCompact || !linksRoot) return;

  btnCompact.addEventListener('click', () => {
    const on = !linksRoot.classList.contains('links-list--compact');
    linksRoot.classList.toggle('links-list--compact', on);
    btnCompact.setAttribute('aria-pressed', on ? 'true' : 'false');
    btnCompact.textContent = on ? 'Обычный вид' : 'Компактно';
  });
})();
