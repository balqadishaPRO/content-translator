const POS_COLORS = {
    noun: '#ff6b6b',
    verb: '#4ecdc4',
    adjective: '#ffe66d',
    adverb: '#a29bfe',
    pronoun: '#fd79a8',
    preposition: '#74b9ff',
    other: '#b2bec3'
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadUserData();
    loadSettings();
    loadSavedWords();
    setupEventListeners();
});

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
}

async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showNotification('Please enter email and password');
        return;
    }
    
    const user = {
        email: email,
        createdAt: Date.now()
    };
    
    await chrome.storage.local.set({ user: user });
    loadUserData();
    showNotification('Account created successfully!');
}

async function handleLogout() {
    await chrome.storage.local.remove('user');
    await chrome.storage.local.remove('savedWords');
    loadUserData();
    showNotification('Signed out successfully');
}

async function loadUserData() {
    const result = await chrome.storage.local.get('user');
    const user = result.user;
    
    if (user) {
        document.getElementById('loggedOut').style.display = 'none';
        document.getElementById('loggedIn').style.display = 'block';
        document.getElementById('userEmail').textContent = user.email;
    } else {
        document.getElementById('loggedOut').style.display = 'block';
        document.getElementById('loggedIn').style.display = 'none';
    }
}

async function loadSettings() {
    const result = await chrome.storage.local.get(['nativeLang', 'learningLang']);
    if (result.nativeLang) {
        document.getElementById('nativeLang').value = result.nativeLang;
    }
    if (result.learningLang) {
        document.getElementById('learningLang').value = result.learningLang;
    }
}

async function saveSettings() {
    const nativeLang = document.getElementById('nativeLang').value;
    const learningLang = document.getElementById('learningLang').value;
    
    await chrome.storage.local.set({
        nativeLang: nativeLang,
        learningLang: learningLang
    });
    
    showNotification('Settings saved!');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', nativeLang, learningLang });
    }
}

async function loadSavedWords() {
    const result = await chrome.storage.local.get('savedWords');
    const words = result.savedWords || [];
    
    const wordList = document.getElementById('wordList');
    const noWords = document.getElementById('noWords');
    
    if (words.length === 0) {
        wordList.innerHTML = '';
        noWords.style.display = 'block';
        return;
    }
    
    noWords.style.display = 'none';
    wordList.innerHTML = words.map((word, index) => `
        <div class="word-card">
            <div>
                <span class="word" style="color: ${POS_COLORS[word.pos] || POS_COLORS.other}">${word.word}</span>
                <span class="pos-tag" style="background: ${POS_COLORS[word.pos] || POS_COLORS.other}20; color: ${POS_COLORS[word.pos] || POS_COLORS.other}">${word.pos || 'word'}</span>
                <div class="translation">${word.translation}</div>
            </div>
            <button class="delete-btn" data-index="${index}">×</button>
        </div>
    `).join('');
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteWord(parseInt(e.target.dataset.index)));
    });
}

async function deleteWord(index) {
    const result = await chrome.storage.local.get('savedWords');
    let words = result.savedWords || [];
    words.splice(index, 1);
    await chrome.storage.local.set({ savedWords: words });
    loadSavedWords();
    showNotification('Word deleted');
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}
