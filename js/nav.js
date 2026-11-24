// Navigation : écran principal (accueil, programmer, absence, appareils), pile de détails,
// menu latéral et fenêtres (feuilles, dialogues). La position de défilement est restaurée au retour.
import { invalidate } from './store.js';

export const nav = {
  top: 'home',
  stack: [], // { kind: 'room' | 'adv', id }
  drawer: false,
  overlay: null, // { type: 'day' | 'cap' | 'settings' | 'logout', … }
  reorder: null, // ids en cours de réorganisation
  scroll: {},
  pendingScroll: null,
};

const keyOf = e => (e ? e.kind + ':' + e.id : nav.top);
export const current = () => nav.stack[nav.stack.length - 1] || null;

function saveScroll() { nav.scroll[keyOf(current())] = window.scrollY; }

export function go(top) {
  saveScroll();
  nav.top = top;
  nav.stack = [];
  nav.drawer = false;
  nav.reorder = null;
  nav.pendingScroll = 0;
  invalidate();
}

export function open(kind, id) {
  saveScroll();
  nav.stack.push({ kind, id });
  nav.drawer = false;
  nav.pendingScroll = 0;
  invalidate();
}

export function back() {
  if (nav.overlay) { nav.overlay = null; invalidate(); return; }
  if (nav.drawer) { nav.drawer = false; invalidate(); return; }
  if (nav.reorder) { nav.reorder = null; invalidate(); return; }
  if (nav.stack.length) {
    nav.stack.pop();
    nav.pendingScroll = nav.scroll[keyOf(current())] || 0;
    invalidate();
  }
}

export function setDrawer(open) { nav.drawer = open; invalidate(); }
export function setOverlay(o) { nav.overlay = o; invalidate(); }
export function closeOverlay() { nav.overlay = null; invalidate(); }

export function resetNav() {
  Object.assign(nav, { top: 'home', stack: [], drawer: false, overlay: null, reorder: null, scroll: {}, pendingScroll: 0 });
}
