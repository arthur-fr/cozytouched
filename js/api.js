// Accès aux serveurs Atlantic : authentification (OAuth2) et API Magellan.
// Mêmes appels que l'app Android (voir docs/PROTOCOLE_COZYTOUCH.md). Les serveurs Atlantic
// acceptent les appels depuis une page web (en-têtes CORS ouverts) : aucun serveur intermédiaire.

export const API = 'https://apis.groupe-atlantic.com';
const MG = API + '/magellan';

// client_id:client_secret de l'application Cozytouch (valeur publique, aussi utilisée par Home Assistant).
const CLIENT_BASIC = 'Q3RfMUpWeVRtSUxYOEllZkE3YVVOQmpGblpVYToyRWNORHpfZHkzNDJVSnFvMlo3cFNKTnZVdjBh';

export class HttpError extends Error {
  constructor(status, body, path) {
    super(`HTTP ${status} sur ${path}`);
    this.status = status; this.body = body; this.path = path;
  }
}
export class NetworkError extends Error {}
export class BadCredentials extends Error {}
export class Unauthorized extends Error { constructor() { super('Jeton Atlantic expiré'); } }

async function req(url, opts = {}, timeoutMs = 40000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store', credentials: 'omit' });
  } catch (e) {
    throw new NetworkError(navigator.onLine === false ? 'Pas de connexion Internet' : 'Problème réseau : serveur injoignable');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text, new URL(url).pathname);
  return text;
}

// ---------------------------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------------------------

async function requestToken(form, path = '/users/token', fallback = '/token') {
  try {
    const body = await req(API + path, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + CLIENT_BASIC, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const t = JSON.parse(body);
    if (!t.access_token) throw new Error('Réponse d\'authentification inattendue');
    t.obtainedAt = Date.now();
    return t;
  } catch (e) {
    if (e instanceof HttpError) {
      let code = null;
      try { code = JSON.parse(e.body).error; } catch { /* corps non JSON */ }
      if (code === 'invalid_grant') throw new BadCredentials('E-mail ou mot de passe incorrect');
      if (fallback && (e.status === 404 || e.status === 405)) return requestToken(form, fallback, null);
    }
    throw e;
  }
}

export const login = (email, password) => requestToken({
  grant_type: 'password',
  username: 'GA-PRIVATEPERSON/' + email.trim(),
  password,
  scope: 'openid device_' + Math.floor(Date.now() / 1000),
});

export const refresh = refreshToken => requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });

export const tokenExpired = t =>
  !t || Date.now() >= t.obtainedAt + Math.max(60, (t.expires_in || 3600) - 60) * 1000;

// ---------------------------------------------------------------------------------------------
// Magellan (appareils Wi-Fi / Bridge V2)
// ---------------------------------------------------------------------------------------------

async function mg(token, path, opts = {}) {
  try {
    return await req(MG + path, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw new Unauthorized();
    throw e;
  }
}

const normDevice = d => ({ ...d, capabilities: Array.isArray(d.capabilities) ? d.capabilities : [] });
const normSetup = s => ({
  ...s,
  devices: (s.devices || []).map(normDevice),
  gateways: s.gateways || [],
  zones: s.zones || [],
});

export async function setups(token) {
  const j = JSON.parse(await mg(token, '/cozytouch/setupviewv2'));
  return (Array.isArray(j) ? j : [j]).map(normSetup);
}

export async function capabilities(token, deviceId) {
  const j = JSON.parse(await mg(token, `/capabilities/?deviceId=${deviceId}`));
  return Array.isArray(j) ? j : [];
}

export async function writeCapability(token, deviceId, capabilityId, value) {
  const body = await mg(token, '/executions/writecapability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ deviceId, capabilityId, value }),
  });
  const n = parseInt(body.trim().replace(/"/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function execution(token, executionId) {
  return JSON.parse(await mg(token, `/executions/${executionId}`));
}
