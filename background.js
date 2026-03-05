const capturedVideos = new Map();

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.url.includes('.mp4') || details.url.includes('.webm') || details.url.includes('.m3u8')) {
            console.log('[LinguaVid] Media captured:', details.url);
            
            capturedVideos.set(details.tabId, {
                url: details.url,
                timestamp: Date.now()
            });
            
            chrome.tabs.sendMessage(details.tabId, {
                type: 'videoDetected',
                url: details.url
            }).catch(() => {});
        }
    },
    { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest'] },
    ['blocking']
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getVideoUrl') {
        const videoData = capturedVideos.get(sender.tab.id);
        if (videoData) {
            sendResponse({ url: videoData.url });
        } else {
            sendResponse({ url: null });
        }
    }
    
    if (message.type === 'saveWord') {
        chrome.storage.local.get('savedWords', (result) => {
            const words = result.savedWords || [];
            words.push(message.word);
            chrome.storage.local.set({ savedWords: words });
            sendResponse({ success: true });
        });
        return true;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { type: 'toggleSubtitles' }).catch(() => {
        console.log('Could not send message to tab');
    });
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[LinguaVid] Extension installed');
    
    chrome.storage.local.set({
        nativeLang: 'en',
        learningLang: 'es',
        savedWords: []
    });
});
