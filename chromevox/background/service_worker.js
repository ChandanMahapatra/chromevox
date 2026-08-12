// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Bootstraps ChromeVox inside an MV3 service worker.
 */

(function(global) {
  var STORAGE_KEY = 'chromevoxLocalStorage';
  var backingStore = {};

  var persist = function() {
    var payload = {};
    payload[STORAGE_KEY] = backingStore;
    chrome.storage.local.set(payload);
  };

  var normalizeValue = function(value) {
    return String(value);
  };

  var getValue = function(key) {
    return Object.prototype.hasOwnProperty.call(backingStore, key) ?
        backingStore[key] : undefined;
  };

  var localStorageShim = new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'getItem') {
        return function(key) {
          var value = getValue(String(key));
          return value === undefined ? null : value;
        };
      }
      if (prop === 'setItem') {
        return function(key, value) {
          backingStore[String(key)] = normalizeValue(value);
          persist();
        };
      }
      if (prop === 'removeItem') {
        return function(key) {
          delete backingStore[String(key)];
          persist();
        };
      }
      if (prop === 'clear') {
        return function() {
          backingStore = {};
          persist();
        };
      }
      if (prop === 'key') {
        return function(index) {
          return Object.keys(backingStore)[index] || null;
        };
      }
      if (prop === 'length') {
        return Object.keys(backingStore).length;
      }
      if (typeof prop === 'string') {
        return getValue(prop);
      }
      return target[prop];
    },
    set: function(target, prop, value) {
      if (typeof prop !== 'string') {
        target[prop] = value;
        return true;
      }
      backingStore[prop] = normalizeValue(value);
      persist();
      return true;
    },
    deleteProperty: function(target, prop) {
      if (typeof prop === 'string') {
        delete backingStore[prop];
        persist();
        return true;
      }
      return delete target[prop];
    },
    ownKeys: function() {
      return Object.keys(backingStore);
    },
    has: function(target, prop) {
      return typeof prop === 'string' &&
          Object.prototype.hasOwnProperty.call(backingStore, prop);
    },
    getOwnPropertyDescriptor: function(target, prop) {
      if (typeof prop === 'string' &&
          Object.prototype.hasOwnProperty.call(backingStore, prop)) {
        return {
          configurable: true,
          enumerable: true,
          value: backingStore[prop],
          writable: true
        };
      }
      return undefined;
    }
  });

  global.window = global;
  global.localStorage = localStorageShim;
  global.CLOSURE_BASE_PATH = chrome.runtime.getURL('/');
  global.CLOSURE_IMPORT_SCRIPT = function(src) {
    importScripts(chrome.runtime.getURL(src));
    return true;
  };

  chrome.storage.local.get(STORAGE_KEY, function(items) {
    var persisted = items[STORAGE_KEY] || {};
    Object.keys(persisted).forEach(function(key) {
      backingStore[key] = normalizeValue(persisted[key]);
    });

    importScripts(
        chrome.runtime.getURL('closure/base.js'),
        chrome.runtime.getURL('deps.js'),
        chrome.runtime.getURL('chromevox/background/loader.js'));
  });
})(self);