(function () {
  'use strict';

  if (document.querySelector('.site-footer')) return;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">湘ICP备2026024341号</a>';
  document.body.appendChild(footer);
})();
