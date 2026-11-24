// Connexion, menu latéral, paramètres, confirmation de déconnexion, message temporaire.
import { h } from '../vdom.js';
import { S, consumeMessage, invalidate, login, logout, setDerogationHours, startDemo } from '../store.js';
import { Caps, absenceHubs, cap } from '../model.js';
import { closeOverlay, go, nav, resetNav, setDrawer, setOverlay } from '../nav.js';
import { Button, Chip, Chips, Dialog, Hint, Icon, Logo, SectionLabel, Sheet, TextButton, plural } from '../ui.js';

export const VERSION = '1.1.0';

export const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function InstallTip() {
  if (isStandalone()) return null;
  return h('div', { class: 'install' },
    Icon('ios_share'),
    h('span', null, isIOS()
      ? 'Pour l\'installer : bouton Partager, puis « Sur l\'écran d\'accueil ». L\'app s\'ouvrira en plein écran, avec son icône.'
      : 'Ouvrez cette page dans Safari sur iPhone, puis Partager › « Sur l\'écran d\'accueil » pour l\'installer.'));
}

// ---------------------------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------------------------

const form = { email: null, password: '', show: false };

export function LoginScreen() {
  if (form.email == null) form.email = S.email || '';
  const submit = e => {
    e?.preventDefault();
    document.activeElement?.blur?.();
    resetNav();
    login(form.email, form.password).then(() => { if (S.phase !== 'loggedOut') form.password = ''; });
  };
  return h('div', { class: 'login' },
    h('div', { class: 'login-in' },
      Logo(96),
      h('h1', null, 'Cozytouched'),
      h('p', { class: 'muted' }, 'Votre chauffage Atlantic, simplement.'),
      h('form', { class: 'login-form', onSubmit: submit },
        h('label', { class: 'input' }, Icon('mail'),
          h('input', {
            type: 'email', name: 'email', autocomplete: 'username', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false',
            placeholder: 'E-mail du compte Cozytouch', value: form.email, 'aria-label': 'E-mail du compte Cozytouch',
            onInput: e => { form.email = e.target.value; },
          })),
        h('label', { class: 'input' }, Icon('lock'),
          h('input', {
            type: form.show ? 'text' : 'password', name: 'password', autocomplete: 'current-password',
            placeholder: 'Mot de passe', value: form.password, 'aria-label': 'Mot de passe', enterkeyhint: 'go',
            onInput: e => { form.password = e.target.value; },
          }),
          h('button', {
            type: 'button', class: 'ibtn sm', 'aria-label': form.show ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
            onClick: () => { form.show = !form.show; invalidate(); },
          }, Icon(form.show ? 'visibility_off' : 'visibility'))),
        S.loginError ? h('p', { class: 'error', role: 'alert' }, S.loginError) : null,
        h('button', { type: 'submit', class: 'btn fill big', disabled: S.loggingIn }, S.loggingIn ? h('span', { class: 'spinner' }) : 'Se connecter'),
        h('button', { type: 'button', class: 'tbtn wide', onClick: () => { resetNav(); startDemo(); } }, 'Découvrir en mode démo')),
      InstallTip(),
      h('p', { class: 'muted small foot' },
        'Utilise votre compte Atlantic Cozytouch existant. Vous restez connecté : vos identifiants sont chiffrés sur cet appareil et ne sont envoyés qu\'aux serveurs Atlantic.')));
}

// ---------------------------------------------------------------------------------------------
// Menu latéral
// ---------------------------------------------------------------------------------------------

export function Drawer() {
  const states = absenceHubs(S.home.magellan).map(d => cap(d, Caps.ABSENCE_HOME_STATE)?.trim());
  const absence = states.includes('1') ? 'En cours' : states.includes('2') ? 'Prévue' : null;
  const plans = S.home.rooms.filter(r => r.isProg).length;
  const rooms = S.home.rooms.length;
  const item = (icon, label, top, badge) => h('button', {
    class: 'di' + (nav.top === top && !nav.stack.length ? ' sel' : ''),
    onClick: () => go(top),
  }, Icon(icon, { fill: nav.top === top }), h('span', { class: 'dl' }, label), badge ? h('span', { class: 'badge' }, badge) : null);
  return h('div', { class: 'overlay drawer-wrap' + (nav.drawer ? ' open' : ''), 'aria-hidden': nav.drawer ? 'false' : 'true' },
    h('div', { class: 'scrim', onClick: () => setDrawer(false) }),
    h('nav', { class: 'drawer', 'aria-label': 'Menu' },
      h('div', { class: 'dh' }, Logo(48),
        h('div', null, h('b', null, 'Cozytouched'),
          h('span', null, S.demo ? 'Logement de démonstration' : 'Mon logement' + (rooms ? ' · ' + plural(rooms, 'pièce') : '')))),
      item('home', 'Accueil', 'home'),
      item('calendar_month', 'Programmer', 'program', plans ? `${plans} actif${plans > 1 ? 's' : ''}` : null),
      item('luggage', 'Mode absence', 'absence', absence),
      item('router', 'Appareils Wi-Fi / Bridge', 'devices'),
      h('div', { class: 'dsep' }),
      h('button', { class: 'di', onClick: () => { nav.drawer = false; setOverlay({ type: 'settings' }); } }, Icon('settings'), h('span', { class: 'dl' }, 'Paramètres')),
      h('button', { class: 'di', onClick: () => { nav.drawer = false; setOverlay({ type: 'logout' }); } }, Icon('logout'), h('span', { class: 'dl' }, S.demo ? 'Quitter la démo' : 'Se déconnecter')),
      h('div', { class: 'dfoot' }, `Cozytouched ${VERSION} · serveurs Atlantic`)));
}

// ---------------------------------------------------------------------------------------------
// Paramètres et déconnexion
// ---------------------------------------------------------------------------------------------

export function SettingsSheet() {
  return Sheet({
    label: 'Paramètres',
    onClose: closeOverlay,
    children: [
      h('h2', { class: 'sheet-title' }, 'Paramètres'),
      h('div', { class: 'row first' },
        h('span', { class: 'tile' }, Icon('account_circle')),
        h('div', { class: 'tx' }, h('b', null, S.demo ? 'Mode démo' : S.email || '—'), h('span', null, 'Compte Atlantic Cozytouch'))),
      SectionLabel('Durée du forçage temporaire'),
      h('p', { class: 'muted small' }, 'Quand une pièce est en planning, modifier la consigne la force pendant cette durée.'),
      Chips([1, 2, 4, 8, 12, 24].map(hh => Chip({ label: `${hh} h`, selected: S.derogationHours === hh, onClick: () => setDerogationHours(hh) })), true),
      InstallTip(),
      Button({ text: S.demo ? 'Quitter le mode démo' : 'Se déconnecter', icon: 'logout', kind: 'out', onClick: () => setOverlay({ type: 'logout' }) }),
      h('p', { class: 'muted small' }, `Cozytouched ${VERSION} (web) · client non officiel, sans lien avec Groupe Atlantic. Utilise les mêmes services cloud que l'application Cozytouch.`),
    ],
  });
}

export function LogoutDialog() {
  const doIt = () => { resetNav(); if (S.demo) logout(); else logout(); };
  return Dialog({
    title: S.demo ? 'Quitter la démo ?' : 'Se déconnecter ?',
    onClose: closeOverlay,
    children: [h('p', { class: 'muted' }, S.demo
      ? 'Vous reviendrez à l\'écran de connexion.'
      : 'Vos identifiants seront effacés de cet appareil. Il faudra vous reconnecter.')],
    actions: [TextButton('Annuler', closeOverlay), TextButton(S.demo ? 'Quitter' : 'Se déconnecter', doIt, 'strong danger')],
  });
}

let toastTimer = null;
let toastText = null;
export function Toast() {
  if (S.message && S.message !== toastText) {
    toastText = S.message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastText = null; consumeMessage(); }, 4000);
  }
  if (!S.message) return null;
  return h('div', { class: 'toast', role: 'status', onClick: () => { clearTimeout(toastTimer); toastText = null; consumeMessage(); } }, S.message);
}

export { Hint };
