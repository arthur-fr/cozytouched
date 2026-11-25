// Thème de l'app : Auto (selon le téléphone), Clair ou Sombre. Mémorisé sur l'appareil.
import { invalidate } from './store.js';

const KEY = 'cz.theme';
const COLORS = { light: '#F4F6F9', dark: '#0D1117' };

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function apply(t) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  // Couleur de la barre d'état (iPhone) et de la barre d'adresse (Android).
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!m.hasAttribute('data-media')) m.setAttribute('data-media', m.getAttribute('media') || '');
    const media = m.getAttribute('data-media');
    if (t === 'auto') {
      if (media) m.setAttribute('media', media);
      m.setAttribute('content', media.includes('dark') ? COLORS.dark : COLORS.light);
    } else {
      m.removeAttribute('media');
      m.setAttribute('content', COLORS[t]);
    }
  }
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t === 'auto' ? 'light dark' : t);
}

export function setTheme(t) {
  try {
    if (t === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch { /* stockage indisponible : le choix vaut pour cette session */ }
  apply(t);
  invalidate();
}
