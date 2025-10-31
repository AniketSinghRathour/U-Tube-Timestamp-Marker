/// <reference types="chrome"/>

/** @type {string} */
let currentUrl = '';
let currentKey = '';
/** @type {string} */
let currentVideoTitle = '';
/** @type {Array<{time: number, note: string, created: number}>} */
let timestamps = [];

// Format seconds to timestamp
function formatTime(seconds) {
    const pad = (num) => String(Math.floor(num)).padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return hours > 0 
        ? `${hours}:${pad(minutes)}:${pad(secs)}`
        : `${minutes}:${pad(secs)}`;
}

// Parse timestamp string back to seconds
function parseTime(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] * 60 + parts[1];
}

// Update timestamps list in UI
function renderTimestamps(filter = '') {
    const list = /** @type {HTMLElement|null} */ (document.getElementById('timestampsList'));
    if (!list) return;
    list.innerHTML = '';
    
    const filteredTimestamps = timestamps.filter(ts => 
        ts.note.toLowerCase().includes(filter.toLowerCase()) ||
        formatTime(ts.time).includes(filter)
    );

    filteredTimestamps.forEach((ts, index) => {
        const item = document.createElement('div');
        item.className = 'timestamp-item';
        item.innerHTML = `
            <div class="timestamp">${formatTime(ts.time)}</div>
            <div class="note">${ts.note || 'No note'}</div>
            <div class="actions">
                <button class="action-btn delete-btn" data-index="${index}">🗑️</button>
            </div>
        `;

        // Add click handlers
        const timestampEl = /** @type {HTMLElement|null} */ (item.querySelector('.timestamp'));
        if (timestampEl) {
            timestampEl.style.cursor = 'pointer';
            timestampEl.addEventListener('click', () => {
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: 'SEEK_TO',
                            time: ts.time
                        });
                    }
                });
            });
        }

        const deleteBtn = /** @type {HTMLElement|null} */ (item.querySelector('.delete-btn'));
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteTimestamp(index);
            });
        }

        list.appendChild(item);
    });
}

// Save new timestamp
function saveTimestamp(time, note) {
    const timestamp = {
        time,
        note: note.trim(),
        created: Date.now()
    };

    chrome.runtime.sendMessage({
        type: 'SAVE_TIMESTAMP',
        url: currentKey || currentUrl,
        data: timestamp
    }, () => {
        loadTimestamps();
    });
}

// Delete timestamp
function deleteTimestamp(index) {
    chrome.runtime.sendMessage({
        type: 'DELETE_TIMESTAMP',
        url: currentKey || currentUrl,
        index
    }, () => {
        loadTimestamps();
    });
}

// Load timestamps for current URL
function loadTimestamps() {
    const key = currentKey || currentUrl;
    chrome.runtime.sendMessage({ type: 'GET_TIMESTAMPS', url: key }, (response) => {
        if (response && response.success) {
            timestamps = response.data || [];
            const searchEl = /** @type {HTMLInputElement|null} */ (document.getElementById('searchInput'));
            const filter = searchEl ? (searchEl.value || '') : '';
            renderTimestamps(filter);
        }
    });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    // Get current tab info
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.url) {
            currentUrl = tabs[0].url;
            
            // Only proceed if we're on a YouTube video
            if (currentUrl.includes('youtube.com/watch')) {
                // compute stable key (video id) to store timestamps per video reliably
                try {
                    const u = new URL(currentUrl);
                    const v = u.searchParams.get('v');
                    currentKey = v ? `yt:${v}` : currentUrl;
                } catch (e) {
                    currentKey = currentUrl;
                }

                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_VIDEO_INFO' }, (response) => {
                    if (response && response.success) {
                        currentVideoTitle = response.data.title;
                        const titleEl = /** @type {HTMLElement} */ (document.getElementById('videoTitle'));
                        const timeEl = /** @type {HTMLElement} */ (document.getElementById('currentTime'));
                        
                        if (titleEl) titleEl.textContent = currentVideoTitle;
                        if (timeEl) timeEl.textContent = formatTime(response.data.currentTime);
                        
                        // Start timestamp update interval
                        setInterval(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_VIDEO_INFO' }, 
                                (response) => {
                                    if (response && response.success) {
                                        const timeEl = /** @type {HTMLElement} */ (document.getElementById('currentTime'));
                                        if (timeEl) {
                                            timeEl.textContent = formatTime(response.data.currentTime);
                                        }
                                    }
                                });
                        }, 1000);
                        
                        loadTimestamps();
                    }
                });
            }
        }
    });

    // Set up event listeners
    const pinBtn = /** @type {HTMLElement} */ (document.getElementById('pinButton'));
    const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('searchInput'));
    const noteInput = /** @type {HTMLInputElement} */ (document.getElementById('noteInput'));

    if (pinBtn) {
        pinBtn.addEventListener('click', () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_VIDEO_INFO' }, (response) => {
                        if (response && response.success) {
                            const note = noteInput?.value || '';
                            saveTimestamp(response.data.currentTime, note);
                            if (noteInput) noteInput.value = '';
                        }
                    });
                }
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            renderTimestamps(target.value || '');
        });
    }
});