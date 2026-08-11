const DB_NAME = 'ApexDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

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
      store.put(session);
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
