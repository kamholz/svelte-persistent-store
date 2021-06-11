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

var js_cookie = {exports: {}};

/*!
 * JavaScript Cookie v2.2.1
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */

(function (module, exports) {
(function (factory) {
	var registeredInModuleLoader;
	{
		module.exports = factory();
		registeredInModuleLoader = true;
	}
	if (!registeredInModuleLoader) {
		var OldCookies = window.Cookies;
		var api = window.Cookies = factory();
		api.noConflict = function () {
			window.Cookies = OldCookies;
			return api;
		};
	}
}(function () {
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function decode (s) {
		return s.replace(/(%[0-9A-Z]{2})+/g, decodeURIComponent);
	}

	function init (converter) {
		function api() {}

		function set (key, value, attributes) {
			if (typeof document === 'undefined') {
				return;
			}

			attributes = extend({
				path: '/'
			}, api.defaults, attributes);

			if (typeof attributes.expires === 'number') {
				attributes.expires = new Date(new Date() * 1 + attributes.expires * 864e+5);
			}

			// We're using "expires" because "max-age" is not supported by IE
			attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

			try {
				var result = JSON.stringify(value);
				if (/^[\{\[]/.test(result)) {
					value = result;
				}
			} catch (e) {}

			value = converter.write ?
				converter.write(value, key) :
				encodeURIComponent(String(value))
					.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);

			key = encodeURIComponent(String(key))
				.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent)
				.replace(/[\(\)]/g, escape);

			var stringifiedAttributes = '';
			for (var attributeName in attributes) {
				if (!attributes[attributeName]) {
					continue;
				}
				stringifiedAttributes += '; ' + attributeName;
				if (attributes[attributeName] === true) {
					continue;
				}

				// Considers RFC 6265 section 5.2:
				// ...
				// 3.  If the remaining unparsed-attributes contains a %x3B (";")
				//     character:
				// Consume the characters of the unparsed-attributes up to,
				// not including, the first %x3B (";") character.
				// ...
				stringifiedAttributes += '=' + attributes[attributeName].split(';')[0];
			}

			return (document.cookie = key + '=' + value + stringifiedAttributes);
		}

		function get (key, json) {
			if (typeof document === 'undefined') {
				return;
			}

			var jar = {};
			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all.
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var cookie = parts.slice(1).join('=');

				if (!json && cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					var name = decode(parts[0]);
					cookie = (converter.read || converter)(cookie, name) ||
						decode(cookie);

					if (json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					jar[name] = cookie;

					if (key === name) {
						break;
					}
				} catch (e) {}
			}

			return key ? jar[key] : jar;
		}

		api.set = set;
		api.get = function (key) {
			return get(key, false /* read as raw */);
		};
		api.getJSON = function (key) {
			return get(key, true /* read as json */);
		};
		api.remove = function (key, attributes) {
			set(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.defaults = {};

		api.withConverter = init;

		return api;
	}

	return init(function () {});
}));
}(js_cookie));

var Cookies = js_cookie.exports;

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
            return Cookies.getJSON(key) || null;
        },
        deleteValue(key) {
            Cookies.remove(key);
        },
        setValue(key, value) {
            Cookies.set(key, value, { expires: 1e4 });
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
