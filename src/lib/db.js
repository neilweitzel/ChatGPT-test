export const DB_NAME = 'ApexDB';
export const STORE_NAME = 'sessions';
const DB_VERSION = 1;

/**
 * Merges an incoming session into one already stored under the same id.
 *
 * Laps are keyed by driver and lap number so re-uploading the same file is
 * idempotent, while uploading a second driver's file for the same track and
 * date adds to the session instead of replacing it.
 *
 * @param {Object|undefined} existing - The stored session, if any.
 * @param {Object} incoming - The newly parsed session.
 * @returns {Object} The session to persist.
 */
export function mergeSession(existing, incoming) {
  if (!existing) return incoming;

  const laps = [...(existing.laps || [])];
  const seen = new Map(laps.map((lap) => [`${lap.driver}#${lap.lap}`, lap]));

  for (const lap of incoming.laps || []) {
    const key = `${lap.driver}#${lap.lap}`;
    const previous = seen.get(key);
    if (previous) {
      // Newer upload wins for a lap that already exists.
      laps[laps.indexOf(previous)] = lap;
    } else {
      laps.push(lap);
      seen.set(key, lap);
    }
  }

  const drivers = Array.from(new Set([...(existing.drivers || []), ...(incoming.drivers || [])]));

  return { ...existing, ...incoming, drivers, laps };
}

/**
 * Initializes and returns a connection to the IndexedDB database.
 * Creates the object store if it does not exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject('IndexedDB error: ' + event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves a list of session objects to the database.
 * @param {Array<Object>} sessions - An array of session objects to save.
 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
 */
export async function saveSessions(sessions) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (event) => {
      reject('Error saving sessions: ' + event.target.error);
    };

    for (const session of sessions) {
      // Read-modify-write inside the same transaction so laps already stored
      // for this track and date are preserved rather than overwritten.
      const existingRequest = store.get(session.id);
      existingRequest.onsuccess = () => {
        store.put(mergeSession(existingRequest.result, session));
      };
    }
  });
}

/**
 * Retrieves all saved sessions from the database.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of session objects.
 */
export async function getSessions() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject('Error getting sessions: ' + event.target.error);
    };
  });
}
