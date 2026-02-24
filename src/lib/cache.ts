// ── Offline Cache Layer ────────────────────────────────────────────────────
// ذخیره‌سازی data در IndexedDB برای کارکرد آفلاین

const DB_NAME = 'familychat-db';
const DB_VERSION = 2;

const STORES = {
  messages:  'messages',
  profiles:  'profiles',
  groups:    'groups',
  session:   'session',
  meta:      'meta',
} as const;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.messages)) {
        const ms = db.createObjectStore(STORES.messages, { keyPath: 'id' });
        ms.createIndex('sender_id',   'sender_id',   { unique: false });
        ms.createIndex('receiver_id', 'receiver_id', { unique: false });
        ms.createIndex('group_id',    'group_id',    { unique: false });
        ms.createIndex('created_at',  'created_at',  { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.profiles)) {
        db.createObjectStore(STORES.profiles, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.groups)) {
        db.createObjectStore(STORES.groups, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.session)) {
        db.createObjectStore(STORES.session, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db!); };
    req.onerror   = () => reject(req.error);
  });
}

function tx(store: string, mode: IDBTransactionMode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

// ── Generic helpers ────────────────────────────────────────────────────────

function getAll<T>(store: string): Promise<T[]> {
  return tx(store).then(s => new Promise((res, rej) => {
    const req = s.getAll();
    req.onsuccess = () => res(req.result as T[]);
    req.onerror   = () => rej(req.error);
  }));
}

function putMany<T>(store: string, items: T[]): Promise<void> {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    items.forEach(item => s.put(item));
    s.transaction.oncomplete = () => res();
    s.transaction.onerror    = () => rej(s.transaction.error);
  }));
}

function deleteOne(store: string, key: string | number): Promise<void> {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    const req = s.delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  }));
}

function getByIndex<T>(store: string, index: string, value: IDBValidKey): Promise<T[]> {
  return tx(store).then(s => new Promise((res, rej) => {
    const req = s.index(index).getAll(value);
    req.onsuccess = () => res(req.result as T[]);
    req.onerror   = () => rej(req.error);
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export const cache = {
  // Profiles
  saveProfiles: (profiles: any[]) => putMany(STORES.profiles, profiles),
  getProfiles:  () => getAll<any>(STORES.profiles),
  updateProfile: async (profile: any) => {
    const s = await tx(STORES.profiles, 'readwrite');
    return new Promise<void>((res, rej) => {
      const req = s.put(profile);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },

  // Groups
  saveGroups: (groups: any[]) => putMany(STORES.groups, groups),
  getGroups:  () => getAll<any>(STORES.groups),

  // Messages — ذخیره/دریافت بر اساس مکالمه
  saveMessages: (messages: any[]) => putMany(STORES.messages, messages),

  getDirectMessages: async (myId: string, otherId: string): Promise<any[]> => {
    const all = await getAll<any>(STORES.messages);
    return all
      .filter(m =>
        (m.sender_id === myId   && m.receiver_id === otherId) ||
        (m.sender_id === otherId && m.receiver_id === myId)
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  getGroupMessages: async (groupId: string): Promise<any[]> => {
    const msgs = await getByIndex<any>(STORES.messages, 'group_id', groupId);
    return msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  upsertMessage: async (msg: any) => {
    const s = await tx(STORES.messages, 'readwrite');
    return new Promise<void>((res, rej) => {
      const req = s.put(msg);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },

  deleteMessage: (id: string) => deleteOne(STORES.messages, id),

  updateMessage: async (id: string, patch: Partial<any>) => {
    const db   = await openDB();
    const store = db.transaction(STORES.messages, 'readwrite').objectStore(STORES.messages);
    return new Promise<void>((res, rej) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) { res(); return; }
        const putReq = store.put({ ...existing, ...patch });
        putReq.onsuccess = () => res();
        putReq.onerror   = () => rej(putReq.error);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  },

  // Session
  saveSession: async (userId: string, userData: any) => {
    const s = await tx(STORES.session, 'readwrite');
    return new Promise<void>((res, rej) => {
      const req = s.put({ key: 'current', userId, userData });
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
  getSession: async (): Promise<{ userId: string; userData: any } | null> => {
    const s = await tx(STORES.session);
    return new Promise((res, rej) => {
      const req = s.get('current');
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  },
  clearSession: async () => {
    const s = await tx(STORES.session, 'readwrite');
    return new Promise<void>((res, rej) => {
      const req = s.clear();
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },

  // Meta (last sync time, etc.)
  getMeta: async (key: string): Promise<any> => {
    const s = await tx(STORES.meta);
    return new Promise((res, rej) => {
      const req = s.get(key);
      req.onsuccess = () => res(req.result?.value ?? null);
      req.onerror   = () => rej(req.error);
    });
  },
  setMeta: async (key: string, value: any) => {
    const s = await tx(STORES.meta, 'readwrite');
    return new Promise<void>((res, rej) => {
      const req = s.put({ key, value });
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
};