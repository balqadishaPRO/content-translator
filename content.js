const POS_TAGS = {
    noun: ['NN', 'NNS', 'NNP', 'NNPS'],
    verb: ['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'],
    adjective: ['JJ', 'JJR', 'JJS'],
    adverb: ['RB', 'RBR', 'RBS'],
    pronoun: ['PRP', 'PRP$', 'WP', 'WP$'],
    preposition: ['IN']
};

const POS_COLORS = {
    noun: 'lingua-word-noun',
    verb: 'lingua-word-verb',
    adjective: 'lingua-word-adjective',
    adverb: 'lingua-word-adverb',
    pronoun: 'lingua-word-pronoun',
    preposition: 'lingua-word-preposition',
    other: 'lingua-word-other'
};

let currentVideo = null;
let subtitleContainer = null;
let toolbar = null;
let isEnabled = false;
let settings = { nativeLang: 'en', learningLang: 'es' };
let wordPairs = [];
let activeWordPopup = null;

async function init() {
    await loadSettings();
    detectVideos();
    
    const observer = new MutationObserver(() => detectVideos());
    observer.observe(document.body, { childList: true, subtree: true });
    
    createToolbar();
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'settingsUpdated') {
            settings.nativeLang = message.nativeLang;
            settings.learningLang = message.learningLang;
        }
        if (message.type === 'toggleSubtitles') {
            toggleSubtitles();
        }
    });
}

async function loadSettings() {
    const result = await chrome.storage.local.get(['nativeLang', 'learningLang']);
    if (result.nativeLang) settings.nativeLang = result.nativeLang;
    if (result.learningLang) settings.learningLang = result.learningLang;
}

function detectVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        if (!video.dataset.linguaInitialized) {
            video.dataset.linguaInitialized = 'true';
            video.addEventListener('play', () => handleVideoPlay(video));
            video.addEventListener('timeupdate', () => handleTimeUpdate(video));
        }
    });
}

function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'lingua-toolbar';
    toolbar.innerHTML = `
        <button class="lingua-toolbar-btn" id="linguaToggle" title="Toggle Subtitles">S</button>
        <button class="lingua-toolbar-btn" id="linguaCapture" title="Capture Video">📹</button>
    `;
    document.body.appendChild(toolbar);
    
    document.getElementById('linguaToggle').addEventListener('click', toggleSubtitles);
    document.getElementById('linguaCapture').addEventListener('click', captureVideo);
}

function toggleSubtitles() {
    isEnabled = !isEnabled;
    const btn = document.getElementById('linguaToggle');
    btn.classList.toggle('active', isEnabled);
    
    if (!isEnabled && subtitleContainer) {
        subtitleContainer.remove();
        subtitleContainer = null;
    }
}

function handleVideoPlay(video) {
    currentVideo = video;
    if (isEnabled) {
        showSubtitles(video);
    }
}

function handleTimeUpdate(video) {
    if (isEnabled && subtitleContainer) {
        updateSubtitles(video.currentTime);
    }
}

function showSubtitles(video) {
    if (subtitleContainer) {
        subtitleContainer.remove();
    }
    
    subtitleContainer = document.createElement('div');
    subtitleContainer.className = 'lingua-subtitle-container';
    subtitleContainer.innerHTML = `
        <div class="lingua-subtitle-native" id="nativeSub"></div>
        <div class="lingua-subtitle-learning" id="learningSub"></div>
    `;
    
    const videoRect = video.getBoundingClientRect();
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        bottom: ${window.innerHeight - videoRect.top - videoRect.height + 20}px;
        left: ${videoRect.left}px;
        width: ${videoRect.width}px;
        height: ${videoRect.height}px;
        pointer-events: none;
        z-index: 999998;
    `;
    container.appendChild(subtitleContainer);
    document.body.appendChild(container);
    
    updateSubtitles(video.currentTime);
}

function updateSubtitles(currentTime) {
    if (!currentVideo) return;
    
    const track = currentVideo.textTracks?.[0];
    if (!track) {
        generateMockSubtitles(currentTime);
        return;
    }
    
    let activeCue = null;
    for (let i = 0; i < track.cues?.length; i++) {
        const cue = track.cues[i];
        if (cue.startTime <= currentTime && cue.endTime >= currentTime) {
            activeCue = cue;
            break;
        }
    }
    
    if (activeCue) {
        displaySubtitles(activeCue.text);
    }
}

function generateMockSubtitles(currentTime) {
    const mockSubtitles = [
        { start: 0, end: 5, native: 'Hello, how are you?', learning: 'Hola, ¿cómo estás?' },
        { start: 5, end: 10, native: 'I am learning a new language.', learning: 'Estoy aprendiendo un nuevo idioma.' },
        { start: 10, end: 15, native: 'The key is on the table.', learning: 'La llave está en la mesa.' },
        { start: 15, end: 20, native: 'She runs quickly every morning.', learning: 'Ella corre rápido cada mañana.' },
        { start: 20, end: 25, native: 'The beautiful flower is red.', learning: 'La flor hermosa es roja.' },
    ];
    
    const current = mockSubtitles.find(s => currentTime >= s.start && currentTime < s.end);
    if (current) {
        displaySubtitles(current.native, current.learning);
    }
}

function displaySubtitles(nativeText, learningText) {
    if (!subtitleContainer) return;
    
    const nativeEl = document.getElementById('nativeSub');
    const learningEl = document.getElementById('learningSub');
    
    if (learningText) {
        nativeEl.innerHTML = colorizeText(nativeText, settings.nativeLang);
        learningEl.innerHTML = colorizeText(learningText, settings.learningLang);
    } else {
        nativeEl.innerHTML = colorizeText(nativeText, settings.nativeLang);
        learningEl.innerHTML = '<span class="lingua-loading"></span> Fetching translation...';
        fetchTranslation(nativeText);
    }
}

function fetchTranslation(text) {
    const words = text.split(/\s+/);
    const translatedWords = words.map(word => {
        return { word: word.replace(/[^\w]/g, ''), translated: word };
    });
    
    setTimeout(() => {
        const learningEl = document.getElementById('learningSub');
        if (learningEl) {
            learningEl.innerHTML = colorizeText(text, settings.learningLang);
        }
    }, 500);
}

function colorizeText(text, lang) {
    const words = text.split(/(\s+|[.,!?;:'"]+)/);
    
    return words.map(fragment => {
        if (/^\s+$/.test(fragment) || /^[.,!?;:'"]+$/.test(fragment)) {
            return fragment;
        }
        
        const pos = detectPOS(fragment, lang);
        const colorClass = POS_COLORS[pos] || POS_COLORS.other;
        
        return `<span class="lingua-word ${colorClass}" 
                      data-word="${fragment.replace(/[^\w]/g, '').toLowerCase()}" 
                      data-pos="${pos}"
                      onclick="window.linguaHandleWordClick(event, '${fragment.replace(/[^\w]/g, '')}', '${pos}')">${fragment}</span>`;
    }).join('');
}

function detectPOS(word, lang) {
    const commonPOS = {
        noun: ['key', 'table', 'flower', 'car', 'house', 'book', 'water', 'food', 'time', 'person', 'way', 'day', 'thing', 'life', 'hand', 'world', 'eye', 'place', 'case', 'week', 'company', 'system', 'program', 'question', 'government', 'number', 'night', 'point', 'home', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'lot', 'study', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'city', 'community', 'name', 'president', 'team', 'minute', 'idea', 'kid', 'body', 'parent', 'face', 'level', 'office', 'door', 'health', 'art', 'war', 'history', 'party', 'result', 'morning', 'reason', 'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education', 'foot', 'boy', 'age', 'policy', 'process', 'music', 'market', 'sense', 'nation', 'plan', 'college', 'interest', 'death', 'experience', 'effect', 'class', 'control', 'care', 'field', 'development', 'role', 'effort', 'rate', 'heart', 'drug', 'show', 'leader', 'light', 'voice', 'wife', 'police', 'mind', 'church', 'report', 'action', 'price', 'need', 'difference', 'picture', 'mountain', 'garden', 'group', 'problem', 'state', 'radio', 'course', 'computer', 'type', 'film', 'road', 'library', 'term', 'industry', 'paper'],
        verb: ['is', 'are', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'run', 'walk', 'eat', 'drink', 'sleep', 'think', 'know', 'see', 'hear', 'feel', 'love', 'hate', 'want', 'need', 'get', 'make', 'say', 'tell', 'speak', 'talk', 'come', 'go', 'take', 'give', 'put', 'let', 'begin', 'seem', 'help', 'show', 'play', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'win', 'offer', 'remember', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'decide', 'pull', 'develop'],
        adjective: ['new', 'first', 'last', 'long', 'great', 'little', 'own', 'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad', 'same', 'able', 'beautiful', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'happy', 'sad', 'good', 'better', 'best', 'worst', 'hard', 'soft', 'easy', 'simple', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'rich', 'poor', 'strong', 'weak', 'free', 'busy', 'clean', 'dirty', 'full', 'empty', 'tall', 'short', 'wide', 'narrow', 'thick', 'thin', 'heavy', 'light', 'dark', 'bright', 'modern', 'ancient', 'foreign', 'local', 'national', 'international', 'private', 'personal', 'central', 'economic', 'political', 'social', 'cultural', 'religious', 'military', 'financial', 'industrial', 'scientific', 'technical', 'professional', 'commercial', 'available', 'responsible', 'possible', 'necessary', 'expensive', 'cheap', 'popular', 'common', 'special', 'particular', 'recent', 'current', 'present', 'past', 'future', 'human', 'natural', 'physical', 'mental', 'emotional', 'individual', 'collective', 'specific', 'general', 'complete', 'total', 'perfect', 'certain', 'obvious', 'clear', 'likely', 'real', 'true', 'false'],
        adverb: ['quickly', 'slowly', 'easily', 'hard', 'well', 'badly', 'very', 'really', 'just', 'only', 'also', 'still', 'already', 'always', 'never', 'often', 'sometimes', 'usually', 'generally', 'particularly', 'especially', 'certainly', 'definitely', 'probably', 'possibly', 'maybe', 'perhaps', 'almost', 'nearly', 'quite', 'rather', 'too', 'enough', 'together', 'alone', 'apart', 'away', 'back', 'here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'soon', 'later', 'early', 'before', 'after', 'again', 'once', 'twice', 'especially', 'particularly', 'exactly', 'completely', 'totally', 'absolutely', 'simply', 'clearly', 'obviously', 'certainly', 'hopefully', 'especially'],
        pronoun: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what', 'someone', 'something', 'anyone', 'anything', 'everyone', 'everything', 'nobody', 'nothing', 'each', 'every', 'either', 'neither', 'another', 'other'],
        preposition: ['in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very']
    };
    
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    for (const [pos, words] of Object.entries(commonPOS)) {
        if (words.includes(cleanWord)) {
            return pos;
        }
    }
    
    if (cleanWord.endsWith('ing')) return 'verb';
    if (cleanWord.endsWith('ed')) return 'verb';
    if (cleanWord.endsWith('ly')) return 'adverb';
    if (cleanWord.endsWith('tion') || cleanWord.endsWith('ment') || cleanWord.endsWith('ness') || cleanWord.endsWith('ity')) return 'noun';
    if (cleanWord.endsWith('ful') || cleanWord.endsWith('less') || cleanWord.endsWith('ous') || cleanWord.endsWith('able')) return 'adjective';
    
    return 'other';
}

window.linguaHandleWordClick = function(event, word, pos) {
    event.stopPropagation();
    
    if (activeWordPopup) {
        activeWordPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.className = 'lingua-word-popup';
    popup.innerHTML = `
        <button class="close-btn" onclick="this.parentElement.remove(); activeWordPopup = null;">×</button>
        <div class="word" style="color: var(--pos-color, #b2bec3);">${word}</div>
        <input type="text" class="translation-input" placeholder="Enter translation...">
        <button class="save-btn">Save Word</button>
    `;
    
    const posColors = {
        noun: '#ff6b6b',
        verb: '#4ecdc4',
        adjective: '#ffe66d',
        adverb: '#a29bfe',
        pronoun: '#fd79a8',
        preposition: '#74b9ff',
        other: '#b2bec3'
    };
    popup.querySelector('.word').style.color = posColors[pos] || posColors.other;
    
    const rect = event.target.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 10}px`;
    popup.style.left = `${rect.left}px`;
    
    document.body.appendChild(popup);
    activeWordPopup = popup;
    
    popup.querySelector('.save-btn').addEventListener('click', () => {
        const translation = popup.querySelector('.translation-input').value.trim();
        if (translation) {
            saveWord(word, translation, pos);
            popup.remove();
            activeWordPopup = null;
        }
    });
    
    popup.querySelector('.translation-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            popup.querySelector('.save-btn').click();
        }
    });
    
    setTimeout(() => {
        popup.querySelector('.translation-input').focus();
    }, 100);
};

async function saveWord(word, translation, pos) {
    const result = await chrome.storage.local.get('savedWords');
    const words = result.savedWords || [];
    
    words.push({
        word: word,
        translation: translation,
        pos: pos,
        savedAt: Date.now()
    });
    
    await chrome.storage.local.set({ savedWords: words });
    
    console.log(`Word saved: ${word} - ${translation} (${pos})`);
}

function captureVideo() {
    if (!currentVideo) {
        console.log('No video detected');
        return;
    }
    
    const videoUrl = currentVideo.src || currentVideo.currentSrc;
    console.log('Captured video URL:', videoUrl);
    
    if (videoUrl && videoUrl.includes('.mp4')) {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'captured-video.mp4';
        a.click();
    } else {
        console.log('Video format not directly downloadable. Use browser download manager.');
    }
}

init();
