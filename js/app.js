// Point d'entrée : rendu de l'écran courant à chaque changement d'état.
import { h, render } from './vdom.js';
import { S, init, subscribe } from './store.js';
import { current, nav } from './nav.js';
import './install.js'; // capte tout de suite la proposition d'installation (Android, Chrome, Edge)
import { HomeScreen, HomeSkeleton } from './screens/home.js';
import { RoomScreen } from './screens/room.js';
import { AdvancedScreen, CapDialog } from './screens/advanced.js';
import { DaySheet, ProgramScreen } from './screens/program.js';
import { AbsenceScreen } from './screens/absence.js';
import { DevicesScreen } from './screens/devices.js';
import { Drawer, LoginScreen, LogoutDialog, SettingsSheet, Toast } from './screens/shell.js';
import { Logo } from './ui.js';

const root = document.getElementById('app');

function screen(now) {
  const top = current();
  if (top?.kind === 'room') return RoomScreen(top.id, now);
  if (top?.kind === 'adv') return AdvancedScreen(top.id, now);
  if (nav.top === 'program') return ProgramScreen(now);
  if (nav.top === 'absence') return AbsenceScreen(now);
  if (nav.top === 'devices') return DevicesScreen(now);
  return HomeScreen(now);
}

function overlay() {
  const o = nav.overlay;
  if (!o) return null;
  if (o.type === 'day') return DaySheet();
  if (o.type === 'cap') return CapDialog();
  if (o.type === 'settings') return SettingsSheet();
  if (o.type === 'logout') return LogoutDialog();
  return null;
}

function view() {
  const now = Date.now();
  if (S.phase === 'starting') return h('div', { class: 'splash' }, Logo(96));
  if (S.phase === 'loggedOut') return h('div', { class: 'app' }, LoginScreen(), Toast());
  if (S.phase === 'loading') return h('div', { class: 'app' }, HomeSkeleton());
  const top = current();
  return h('div', { class: 'app' },
    h('div', { key: 'screen:' + (top ? top.kind + top.id : nav.top) + (nav.reorder ? ':order' : '') }, screen(now)),
    Drawer(),
    overlay(),
    Toast());
}

let scheduled = false;
function draw() {
  scheduled = false;
  render(view(), root);
  const locked = !!nav.overlay || nav.drawer;
  document.documentElement.classList.toggle('locked', locked);
  if (nav.pendingScroll != null) {
    window.scrollTo(0, nav.pendingScroll);
    nav.pendingScroll = null;
  }
}
function invalidate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(draw);
}

subscribe(invalidate);
// Les « il y a 5 s » avancent même sans nouvelle donnée.
setInterval(() => { if (document.visibilityState === 'visible' && S.phase === 'ready') invalidate(); }, 5000);
// Échap : fermer la fenêtre ouverte (clavier).
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (nav.overlay || nav.drawer)) { nav.overlay = null; nav.drawer = false; invalidate(); } });

draw();
init();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
