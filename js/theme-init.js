// Thème choisi dans Paramètres, appliqué avant l'affichage de la page (évite un flash de l'autre thème).
(function () {
  try {
    var t = localStorage.getItem('cz.theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      var color = t === 'dark' ? '#0D1117' : '#F4F6F9';
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.setAttribute('data-media', m.getAttribute('media') || '');
        m.removeAttribute('media');
        m.setAttribute('content', color);
      });
      var cs = document.querySelector('meta[name="color-scheme"]');
      if (cs) cs.setAttribute('content', t);
    }
  } catch (e) { /* stockage indisponible : thème du téléphone */ }
})();
