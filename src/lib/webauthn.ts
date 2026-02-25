// ── WebAuthn / Biometric Login ─────────────────────────────────────────────
//
// فلو ثبت:
//   ۱. WebAuthn credential روی دستگاه ساخته میشه (اثر انگشت / Face ID)
//   ۲. یه AES-GCM key تولید میشه
//   ۳. {email, password} با اون key encrypt میشه و توی IndexedDB ذخیره میشه
//
// فلو ورود:
//   ۱. بیومتریک تأیید میشه (WebAuthn)
//   ۲. key از IDB خونده میشه → {email,password} decrypt
//   ۳. supabase.signInWithPassword → session جدید
//
// امنیت: پسورد plaintext هیچ‌جا ذخیره نمیشه

const RP_ID   = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const RP_NAME = 'FamilyChat';

const IDB_NAME  = 'familychat-biometric';
const IDB_VER   = 1;
const DB_STORE  = 'kv';
const KEY_CRED  = 'credentialId';   // b64 rawId
const KEY_ENC   = 'encryptedCreds'; // {iv,data} b64
const KEY_WRAP  = 'wrappingKey';    // AES key b64

// ── Buffer utils ────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...u8));
}

function b64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer.slice(0) as ArrayBuffer;
}

function rnd(n = 32): ArrayBuffer {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b.buffer.slice(0) as ArrayBuffer;
}

function toAB(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// ── IndexedDB KV ─────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = e => (e.target as IDBOpenDBRequest).result.createObjectStore(DB_STORE);
    r.onsuccess = e => { _db = (e.target as IDBOpenDBRequest).result; res(_db!); };
    r.onerror   = () => rej(r.error);
  });
}

async function kSet(k: string, v: unknown) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const r = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(v, k);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

async function kGet<T>(k: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(k);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror   = () => rej(r.error);
  });
}

async function kDel(k: string) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const r = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(k);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// ── AES-GCM ──────────────────────────────────────────────────────────────────

async function genKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function aesEncrypt(plain: string, key: CryptoKey) {
  const iv  = new Uint8Array(rnd(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return { iv: bufToB64(iv), data: bufToB64(enc) };
}

async function aesDecrypt(enc: { iv: string; data: string }, key: CryptoKey): Promise<string> {
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(enc.iv)) },
    key,
    b64ToBuf(enc.data),
  );
  return new TextDecoder().decode(dec);
}

async function exportKey(k: CryptoKey) {
  return bufToB64(await crypto.subtle.exportKey('raw', k));
}

async function importKey(b64: string) {
  return crypto.subtle.importKey('raw', b64ToBuf(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function hasSavedCredential(): Promise<boolean> {
  try {
    const [cred, enc] = await Promise.all([kGet(KEY_CRED), kGet(KEY_ENC)]);
    return !!(cred && enc);
  } catch { return false; }
}

/**
 * بعد از لاگین موفق صدا زده میشه.
 * email + password رو encrypt کرده و credential ثبت می‌کنه.
 */
export async function registerBiometric(
  userId: string,
  userEmail: string,
  password: string,
): Promise<boolean> {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        rp:   { id: RP_ID, name: RP_NAME },
        user: {
          id:          toAB(new TextEncoder().encode(userId)),
          name:        userEmail,
          displayName: userEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7   },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification:        'required',
          residentKey:             'preferred',
        },
        challenge:   rnd(32),
        timeout:     60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!cred) return false;

    const key = await genKey();
    // email و password هر دو رو encrypt کن تا هیچ وابستگی به cache نداشته باشیم
    const encEmail = await aesEncrypt(userEmail, key);
    const encPass  = await aesEncrypt(password,  key);

    await kSet(KEY_CRED, bufToB64(cred.rawId));
    await kSet(KEY_ENC,  { email: encEmail, pass: encPass });
    await kSet(KEY_WRAP, await exportKey(key));

    return true;
  } catch (err) {
    console.warn('[WebAuthn] register failed:', err);
    return false;
  }
}

/**
 * بیومتریک تأیید می‌کنه و {email, password} decrypt‌شده برمیگردونه.
 * null یعنی شکست (لغو کاربر یا خطا).
 */
export async function authenticateWithBiometric(): Promise<{ email: string; password: string } | null> {
  try {
    const [credId, encData, keyB64] = await Promise.all([
      kGet<string>(KEY_CRED),
      kGet<{ email: { iv: string; data: string }; pass: { iv: string; data: string } }>(KEY_ENC),
      kGet<string>(KEY_WRAP),
    ]);

    if (!credId || !encData || !keyB64) return null;

    const pkCred = await navigator.credentials.get({
      publicKey: {
        rpId:             RP_ID,
        challenge:        rnd(32),
        userVerification: 'required',
        timeout:          60000,
        allowCredentials: [{ type: 'public-key', id: b64ToBuf(credId), transports: ['internal'] }],
      },
    }) as PublicKeyCredential | null;

    if (!pkCred) return null;

    const key      = await importKey(keyB64);
    const email    = await aesDecrypt(encData.email, key);
    const password = await aesDecrypt(encData.pass,  key);

    return { email, password };
  } catch (err) {
    console.warn('[WebAuthn] auth failed:', err);
    return null;
  }
}

/** credential و داده‌های رمزنگاری‌شده رو کامل پاک می‌کنه */
export async function removeBiometricCredential(): Promise<void> {
  await Promise.allSettled([kDel(KEY_CRED), kDel(KEY_ENC), kDel(KEY_WRAP)]);
}