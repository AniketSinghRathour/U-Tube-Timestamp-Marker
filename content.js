// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_VIDEO_INFO') {
        const videoElement = document.querySelector('video');
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
        
        if (!videoElement) {
            sendResponse({ success: false, message: 'No video found' });
            return true;
        }

        sendResponse({
            success: true,
            data: {
                currentTime: videoElement.currentTime,
                title: videoTitle || 'Untitled Video',
                url: window.location.href
            }
        });
    }
    else if (request.type === 'SEEK_TO') {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            videoElement.currentTime = request.time;
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, message: 'No video found' });
        }
    }
    return true;
});