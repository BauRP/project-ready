// IndexedDB wrapper for Trivo Chat local-only storage

const DB_NAME = "trivo-chat";
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("identity")) db.createObjectStore("identity");
        if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      }

      // v2: fix contacts store — use no inline keyPath so we can use explicit keys
      if (oldVersion < 2) {
        if (db.objectStoreNames.contains("contacts")) {
          db.deleteObjectStore("contacts");
        }
        db.createObjectStore("contacts");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[Storage] dbGet error:", e);
    return undefined;
  }
}

export async function dbPut(store: string, key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const objectStore = tx.objectStore(store);
      // If store has inline keyPath, don't pass explicit key
      if (objectStore.keyPath) {
        objectStore.put(value);
      } else {
        objectStore.put(value, key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[Storage] dbPut error:", e);
  }
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[Storage] dbGetAll error:", e);
    return [];
  }
}

export async function dbDelete(store: string, key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[Storage] dbDelete error:", e);
  }
}

export async function nukeAllData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
      localStorage.clear();
      sessionStorage.clear();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}