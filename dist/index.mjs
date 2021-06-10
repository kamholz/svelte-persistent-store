function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        // @ts-ignore - file size hacks
        request.onabort = request.onerror = () => reject(request.error);
    });
}
function createStore(dbName, storeName) {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request);
    return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
let defaultGetStoreFunc;
function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }
    return defaultGetStoreFunc;
}
/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function get(key, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}
/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function del(key, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.delete(key);
        return promisifyRequest(store.transaction);
    });
}

const encode = (val) => {
  try {
    return encodeURIComponent(val);
  } catch (e) {
    console.error('error encode %o');
  }
  return null;
};

const decode = (val) => {
  try {
    return decodeURIComponent(val);
  } catch (err) {
    console.error('error decode %o');
  }
  return null;
};

const handleSkey = (sKey) => encode(sKey).replace(/[\-\.\+\*]/g, '\\$&');

const Cookies = {
  getItem(sKey) {
    if (!sKey) { return null; }
    return (
      decode(
        document.cookie
        .replace(
          new RegExp(`(?:(?:^|.*;)\\s*${handleSkey(sKey)}\\s*\\=\\s*([^;]*).*$)|^.*$`)
        , '$1')
      ) || null
    );
  },

  setItem(sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
    let sExpires = '';
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          if (vEnd === Infinity) {
            sExpires = '; expires=Fri, 31 Dec 9999 23:59:59 GMT';
          } else {
            sExpires = `; max-age=${vEnd}`;
          }
          break;
        case String:
          sExpires = `; expires=${vEnd}`;
          break;
        case Date:
          sExpires = `; expires=${vEnd.toUTCString()}`;
          break;
      }
    }
    document.cookie = [
      encode(sKey), '=', encode(sValue),
      sExpires,
      (sDomain ? `; domain=${sDomain}` : ''),
      (sPath ? `; path=${sPath}` : ''),
      (bSecure ? '; secure' : ''),
    ].join('');
    return true;
  },

  removeItem(sKey, sPath, sDomain) {
    if (!this.hasItem(sKey)) { return false; }
    document.cookie = [
      encode(sKey), '=; expires=Thu, 01 Jan 1970 00:00:00 GMT',
      (sDomain ? `; domain=${sDomain}` : ''),
      (sPath ? `; path=${sPath}` : ''),
    ].join('');
    return true;
  },

  hasItem(sKey) {
    if (!sKey) { return false; }
    return (
      new RegExp(`(?:^|;\\s*)${encode(sKey).replace(/[\-\.\+\*]/g, '\\$&')}\\s*\\=`)
    ).test(document.cookie);
  },

  keys() {
    let aKeys = document.cookie
    .replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, '')
    .split(/\s*(?:\=[^;]*)?;\s*/);
    aKeys = aKeys.map((key) => decode(key));
    return aKeys;
  },
};

/**
 * Make a store persistent
 * @param {Writable<*>} store The store to enhance
 * @param {StorageInterface} storage The storage to use
 * @param {string} key The name of the data key
 */
function persist(store, storage, key) {
    const initialValue = storage.getValue(key);
    if (null !== initialValue) {
        store.set(initialValue);
    }
    if (storage.addListener) {
        storage.addListener(key, newValue => {
            store.set(newValue);
        });
    }
    store.subscribe(value => {
        storage.setValue(key, value);
    });
    return Object.assign(Object.assign({}, store), { delete() {
            storage.deleteValue(key);
        } });
}
function getBrowserStorage(browserStorage, listenExternalChanges = false) {
    const listeners = [];
    const listenerFunction = (event) => {
        const eventKey = event.key;
        if (event.storageArea === browserStorage) {
            listeners
                .filter(({ key }) => key === eventKey)
                .forEach(({ listener }) => {
                let value = event.newValue;
                try {
                    value = JSON.parse(event.newValue);
                }
                catch (e) {
                    // Do nothing
                    // use the value "as is"
                }
                listener(value);
            });
        }
    };
    const connect = () => {
        if (listenExternalChanges && typeof window !== "undefined" && (window === null || window === void 0 ? void 0 : window.addEventListener)) {
            window.addEventListener("storage", listenerFunction);
        }
    };
    const disconnect = () => {
        if (listenExternalChanges && typeof window !== "undefined" && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
            window.removeEventListener("storage", listenerFunction);
        }
    };
    return {
        addListener(key, listener) {
            listeners.push({ key, listener });
            if (listeners.length === 1) {
                connect();
            }
        },
        removeListener(key, listener) {
            const index = listeners.indexOf({ key, listener });
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                disconnect();
            }
        },
        getValue(key) {
            let value = browserStorage.getItem(key);
            if (value !== null && value !== undefined) {
                try {
                    value = JSON.parse(value);
                }
                catch (e) {
                    // Do nothing
                    // use the value "as is"
                }
            }
            return value;
        },
        deleteValue(key) {
            browserStorage.removeItem(key);
        },
        setValue(key, value) {
            browserStorage.setItem(key, JSON.stringify(value));
        }
    };
}
/**
 * Storage implementation that use the browser local storage
 * @param {boolean} listenExternalChanges - Update the store if the localStorage is updated from another page
 */
function localStorage(listenExternalChanges = false) {
    if (typeof window !== "undefined" && (window === null || window === void 0 ? void 0 : window.localStorage)) {
        return getBrowserStorage(window.localStorage, listenExternalChanges);
    }
    console.warn("Unable to find the localStorage. No data will be persisted.");
    return noopStorage();
}
/**
 * Storage implementation that use the browser session storage
 * @param {boolean} listenExternalChanges - Update the store if the sessionStorage is updated from another page
 */
function sessionStorage(listenExternalChanges = false) {
    if (typeof window !== "undefined" && (window === null || window === void 0 ? void 0 : window.sessionStorage)) {
        return getBrowserStorage(window.sessionStorage, listenExternalChanges);
    }
    console.warn("Unable to find the sessionStorage. No data will be persisted.");
    return noopStorage();
}
/**
 * Storage implementation that use the browser cookies
 */
function cookieStorage() {
    if (typeof document === "undefined" || typeof (document === null || document === void 0 ? void 0 : document.cookie) !== "string") {
        console.warn("Unable to find the cookies. No data will be persisted.");
        return noopStorage();
    }
    return {
        getValue(key) {
            if (!Cookies.hasItem(key)) {
                return null;
            }
            const value = Cookies.getItem(key);
            try {
                return JSON.parse(value);
            }
            catch (e) {
                return value;
            }
        },
        deleteValue(key) {
            Cookies.removeItem(key);
        },
        setValue(key, value) {
            Cookies.setItem(key, JSON.stringify(value), Infinity);
        }
    };
}
/**
 * Storage implementation that use the browser IndexedDB
 */
function indexedDBStorage() {
    if (typeof indexedDB !== "object" || typeof window === "undefined" || typeof (window === null || window === void 0 ? void 0 : window.indexedDB) !== "object") {
        console.warn("Unable to find the IndexedDB. No data will be persisted.");
        return noopSelfUpdateStorage();
    }
    const database = createStore("svelte-persist", "persist");
    const listeners = [];
    const listenerFunction = (eventKey, newValue) => {
        if (newValue === undefined) {
            return;
        }
        listeners
            .filter(({ key }) => key === eventKey)
            .forEach(({ listener }) => listener(newValue));
    };
    return {
        addListener(key, listener) {
            listeners.push({ key, listener });
        },
        removeListener(key, listener) {
            const index = listeners.indexOf({ key, listener });
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        },
        getValue(key) {
            get(key, database).then(value => listenerFunction(key, value));
            return null;
        },
        setValue(key, value) {
            set(key, value, database);
        },
        deleteValue(key) {
            del(key, database);
        }
    };
}
/**
 * Storage implementation that do nothing
 */
function noopStorage() {
    return {
        getValue() {
            return null;
        },
        deleteValue() {
            // Do nothing
        },
        setValue() {
            // Do nothing
        }
    };
}
function noopSelfUpdateStorage() {
    return {
        addListener() {
            // Do nothing
        },
        removeListener() {
            // Do nothing
        },
        getValue() {
            return null;
        },
        deleteValue() {
            // Do nothing
        },
        setValue() {
            // Do nothing
        }
    };
}

export { cookieStorage, indexedDBStorage, localStorage, noopStorage, persist, sessionStorage };
