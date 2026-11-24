// Mot de passe chiffré sur l'appareil (AES-GCM, clé non exportable gardée dans IndexedDB) :
// l'équivalent web du Keystore Android, pour rester connecté quand le jeton ne peut plus être rafraîchi.

const DB = 'cozytouched', STORE = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function key(create) {
  const db = await openDb();
  let k = await run(db, 'readonly', s => s.get('aes'));
  if (!k && create) {
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await run(db, 'readwrite', s => s.put(k, 'aes'));
  }
  return k || null;
}

const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function seal(text) {
  const k = await key(true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
  return b64(iv) + '.' + b64(new Uint8Array(ct));
}

export async function unseal(sealed) {
  const [iv, ct] = sealed.split('.');
  const k = await key(false);
  if (!k) return null;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct));
  return new TextDecoder().decode(pt);
}

export async function forget() {
  try {
    const db = await openDb();
    await run(db, 'readwrite', s => s.delete('aes'));
  } catch { /* rien à effacer */ }
}
