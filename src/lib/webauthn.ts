// ── WebAuthn / Biometric Local Unlock ─────────────────────────────────────
// این ماژول اثر انگشت / Face ID / Windows Hello رو برای unlock محلی مدیریت می‌کنه
// هیچ اطلاعات بیومتریک به سرور نمی‌ره — فقط یه credential محلی ذخیره میشه

const RP_ID   = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const RP_NAME = 'FamilyChat';
const CRED_KEY = 'fc_webauthn_cred_id';   // localStorage key برای credentialId

// ── helpers ────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const arr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return arr.buffer.slice(0) as ArrayBuffer;
}

// crypto.getRandomValues یه Uint8Array<ArrayBufferLike> برمی‌گردونه
// ولی WebAuthn API به صراحت ArrayBuffer (نه SharedArrayBuffer) می‌خواد
// با slice(0) یه کپی با type خالص ArrayBuffer می‌سازیم
function randomBytes(n = 32): ArrayBuffer {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf.buffer.slice(0) as ArrayBuffer;
}

// TextEncoder هم همین مشکل رو داره — برای user.id
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ── Feature detection ──────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

export function hasSavedCredential(): boolean {
  return !!localStorage.getItem(CRED_KEY);
}

// ── Registration: ثبت اثر انگشت برای اولین بار ────────────────────────────

export async function registerBiometric(userId: string, userEmail: string): Promise<boolean> {
  try {
    const challenge  = randomBytes(32);
    const userIdBuf  = toArrayBuffer(new TextEncoder().encode(userId));

    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { id: RP_ID, name: RP_NAME },
        user: {
          id:          userIdBuf,
          name:        userEmail,
          displayName: userEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7  },   // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',      // فقط authenticator داخلی دستگاه
          userVerification:        'required',      // حتماً biometric / PIN بخواد
          residentKey:             'preferred',
        },
        challenge,
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // credentialId رو ذخیره می‌کنیم تا هنگام authentication پیداش کنیم
    localStorage.setItem(CRED_KEY, bufToB64(credential.rawId));
    return true;
  } catch (err) {
    console.warn('[WebAuthn] Registration failed:', err);
    return false;
  }
}

// ── Authentication: ورود با اثر انگشت ─────────────────────────────────────

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const savedCredId = localStorage.getItem(CRED_KEY);
    if (!savedCredId) return false;

    const challenge = randomBytes(32);

    const credential = await navigator.credentials.get({
      publicKey: {
        rpId:             RP_ID,
        challenge,
        userVerification: 'required',
        timeout:          60000,
        allowCredentials: [
          {
            type: 'public-key',
            id:   b64ToBuf(savedCredId),
            transports: ['internal'],
          },
        ],
      },
    }) as PublicKeyCredential | null;

    // اگه credential برگشت یعنی کاربر تأیید شد
    return !!credential;
  } catch (err) {
    console.warn('[WebAuthn] Authentication failed:', err);
    return false;
  }
}

// ── Remove: حذف credential ذخیره‌شده ──────────────────────────────────────

export function removeBiometricCredential(): void {
  localStorage.removeItem(CRED_KEY);
}