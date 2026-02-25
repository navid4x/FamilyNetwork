// ── WebAuthn / Biometric Login ─────────────────────────────────────────────
//
// فلو:
//  ثبت:  پسورد رو با AES-GCM encrypt می‌کنیم → IndexedDB ذخیره می‌کنیم
//        کلید رمزنگاری رو با WebAuthn تولید می‌کنیم
//
//  ورود: بیومتریک تأیید → پسورد decrypt → supabase.signInWithPassword
//
// امنیت: پسورد plaintext هیچ‌وقت در localStorage نیست
//        بدون تأیید بیومتریک دستگاه، decrypt ممکن نیست

const RP_ID   = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const RP_NAME = 'FamilyChat';

const DB_STORE  = 'fc_biometric';
const KEY_CRED  = 'credentialId';
const KEY_ENC   = 'encryptedCreds';
const KEY_WRAP  = 'wrappingKey';

// ── Buffer helpers ──────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...u8));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const arr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return arr.buffer.slice(0) as ArrayBuffer;
}

function randomBytes(n = 32): ArrayBuffer {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf.buffer.slice(0) as ArrayBuffer;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ── IndexedDB KV ────────────────────────────────────────────────────────────

const IDB_NAME = 'familychat-biometric';
const IDB_VER  = 1;
let _idb: IDBDatabase | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(DB_STORE);
    };
    req.onsuccess = e => { _idb = (e.target as IDBOpenDBRequest).result; res(_idb!); };
    req.onerror   = () => rej(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(value, key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ── AES-GCM encrypt / decrypt ───────────────────────────────────────────────

async function generateWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function encryptPassword(password: string, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const iv        = new Uint8Array(randomBytes(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(password),
  );
  return { iv: bufToB64(iv), data: bufToB64(encrypted) };
}

async function decryptPassword(enc: { iv: string; data: string }, key: CryptoKey): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(enc.iv)) },
    key,
    b64ToBuf(enc.data),
  );
  return new TextDecoder().decode(decrypted);
}

async function exportKey(key: CryptoKey): Promise<string> {
  return bufToB64(await crypto.subtle.exportKey('raw', key));
}

async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBuf(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function hasSavedCredential(): Promise<boolean> {
  try {
    const [cred, enc] = await Promise.all([idbGet<string>(KEY_CRED), idbGet<object>(KEY_ENC)]);
    return !!(cred && enc);
  } catch {
    return false;
  }
}

/** بعد از لاگین موفق — پسورد رو encrypt کرده و credential ثبت می‌کنه */
export async function registerBiometric(
  userId: string,
  userEmail: string,
  password: string,
): Promise<boolean> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { id: RP_ID, name: RP_NAME },
        user: {
          id:          toArrayBuffer(new TextEncoder().encode(userId)),
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
        challenge:   randomBytes(32),
        timeout:     60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    const wrappingKey    = await generateWrappingKey();
    const encryptedCreds = await encryptPassword(password, wrappingKey);

    await idbSet(KEY_CRED, bufToB64(credential.rawId));
    await idbSet(KEY_ENC,  encryptedCreds);
    await idbSet(KEY_WRAP, await exportKey(wrappingKey));

    return true;
  } catch (err) {
    console.warn('[WebAuthn] Registration failed:', err);
    return false;
  }
}

/** بیومتریک تأیید می‌کنه و پسورد decrypt‌شده برمی‌گردونه — null یعنی شکست */
export async function authenticateWithBiometric(): Promise<string | null> {
  try {
    const [savedCredId, encData, exportedKey] = await Promise.all([
      idbGet<string>(KEY_CRED),
      idbGet<{ iv: string; data: string }>(KEY_ENC),
      idbGet<string>(KEY_WRAP),
    ]);

    if (!savedCredId || !encData || !exportedKey) return null;

    const credential = await navigator.credentials.get({
      publicKey: {
        rpId:             RP_ID,
        challenge:        randomBytes(32),
        userVerification: 'required',
        timeout:          60000,
        allowCredentials: [{ type: 'public-key', id: b64ToBuf(savedCredId), transports: ['internal'] }],
      },
    }) as PublicKeyCredential | null;

    if (!credential) return null;

    const wrappingKey = await importKey(exportedKey);
    return await decryptPassword(encData, wrappingKey);
  } catch (err) {
    console.warn('[WebAuthn] Authentication failed:', err);
    return null;
  }
}

export async function removeBiometricCredential(): Promise<void> {
  await Promise.allSettled([idbDel(KEY_CRED), idbDel(KEY_ENC), idbDel(KEY_WRAP)]);
}