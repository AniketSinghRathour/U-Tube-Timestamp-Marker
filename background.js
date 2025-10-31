// Simple, callback-based background script for MV3 service worker
// No top-level await or extraneous code to avoid registration errors
/// <reference types="chrome"/>

/** @type {string} */
const STORAGE_KEY = 'video_timestamps';

function getStorage(cb) {
  chrome.storage.local.get(STORAGE_KEY, (result) => cb(result[STORAGE_KEY] || {}));
}

function setStorage(data, cb) {
  chrome.storage.local.set({ [STORAGE_KEY]: data }, cb);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TIMESTAMPS') {
    getStorage((data) => sendResponse({ success: true, data: data[request.url] || [] }));
    return true;
  }

  if (request.type === 'SAVE_TIMESTAMP') {
    getStorage((data) => {
      if (!data[request.url]) data[request.url] = [];
      data[request.url].push(request.data);
      data[request.url].sort((a, b) => a.time - b.time);
      setStorage(data, () => sendResponse({ success: true }));
    });
    return true;
  }

  if (request.type === 'DELETE_TIMESTAMP') {
    getStorage((data) => {
      if (data[request.url] && data[request.url][request.index]) {
        data[request.url].splice(request.index, 1);
        setStorage(data, () => sendResponse({ success: true }));
      } else {
        sendResponse({ success: false, error: 'Invalid timestamp' });
      }
    });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});