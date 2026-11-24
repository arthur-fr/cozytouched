// Installation sur l'écran d'accueil : consignes adaptées au système (iPhone / iPad, Android, ordinateur)
// et au navigateur, ou bouton « Installer » quand le navigateur le propose (Chrome, Edge, Samsung Internet…).
import { invalidate } from './store.js';

let deferredPrompt = null;
let installed = false;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  invalidate();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installed = true;
  invalidate();
});

export const isStandalone = () => installed || window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;

/** { os: 'ios' | 'android' | 'desktop', browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'other' } */
export function platform() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios'
    : /Android/i.test(ua) ? 'android' : 'desktop';
  let browser = 'other';
  if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\/|OPiOS|OPT\//.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(ua)) browser = 'firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua)) browser = 'safari';
  return { os, browser };
}

export const canPrompt = () => !!deferredPrompt;

export async function promptInstall() {
  const p = deferredPrompt;
  if (!p) return;
  deferredPrompt = null;
  p.prompt();
  try {
    const choice = await p.userChoice;
    if (choice.outcome === 'accepted') installed = true;
  } catch { /* fenêtre fermée */ }
  invalidate();
}

/** Consigne d'installation pour ce téléphone et ce navigateur (null : rien à proposer). */
export function installSteps() {
  if (isStandalone()) return null;
  const { os, browser } = platform();
  if (os === 'ios') {
    if (browser === 'safari') return 'Touchez le bouton Partager, puis « Sur l\'écran d\'accueil ».';
    if (browser === 'chrome') return 'Touchez le bouton Partager de Chrome (dans la barre d\'adresse), puis « Sur l\'écran d\'accueil ».';
    return 'Dans le menu du navigateur, choisissez Partager, puis « Sur l\'écran d\'accueil ». Si l\'option n\'apparaît pas, ouvrez cette page dans Safari.';
  }
  if (os === 'android') {
    if (canPrompt()) return 'Elle s\'ouvrira en plein écran depuis son icône, comme une app classique.';
    if (browser === 'samsung') return 'Touchez le menu ≡ en bas de l\'écran, puis « Ajouter la page à » › « Écran d\'accueil ».';
    if (browser === 'edge') return 'Touchez le menu ⋯ en bas de l\'écran, puis « Ajouter au téléphone ».';
    if (browser === 'firefox') return 'Touchez le menu ⋮, puis « Ajouter à l\'écran d\'accueil » (ou « Installer »).';
    if (browser === 'chrome') return 'Touchez le menu ⋮ en haut à droite, puis « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ».';
    return 'Dans le menu du navigateur, choisissez « Ajouter à l\'écran d\'accueil » ou « Installer ».';
  }
  if (canPrompt()) return 'Elle s\'ouvrira dans sa propre fenêtre, comme une app classique.';
  if (browser === 'safari') return 'Menu Fichier › « Ajouter au Dock ». Sur téléphone, ouvrez cette adresse sur votre iPhone ou votre Android.';
  return null;
}

// Fermeture de la carte d'installation : mémorisée sur l'appareil.
const KEY = 'cz.install.hidden';
export function installHidden() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function hideInstall() { try { localStorage.setItem(KEY, '1'); } catch { /* stockage indisponible */ } invalidate(); }
