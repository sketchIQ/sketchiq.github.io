import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

// Check for dark mode preference immediately to initialize mermaid with the correct theme
const isDarkMode = localStorage.getItem('dark-mode') === 'true';

mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? 'dark' : 'default',
});

// --- DOM Elements ---
const apiKeyBtn = document.getElementById('api-key-btn');
const apiKeyModal = document.getElementById('api-key-modal');
const closeBtn = document.querySelector('.close-btn');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyInput = document.getElementById('api-key-input');
const darkModeCheckbox = document.getElementById('dark-mode-checkbox');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const resetBtn = document.getElementById('reset-btn');
const chatContainer = document.getElementById('chat-container');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const diagramContainer = document.querySelector('#diagram .mermaid');
const mermaidCodeEl = document.getElementById('mermaid-code');
const copyBtn = document.getElementById('copy-btn');
const downloadPngBtn = document.getElementById('download-png-btn');

// --- App State ---
let apiKey = localStorage.getItem('gemini-api-key');
let sessionData = JSON.parse(localStorage.getItem('sketchiq-session')) || { messages: [], mermaidCode: '' };

// --- Event Listeners ---

apiKeyBtn.addEventListener('click', () => apiKeyModal.style.display = 'block');
closeBtn.addEventListener('click', () => apiKeyModal.style.display = 'none');
window.addEventListener('click', (event) => {
    if (event.target === apiKeyModal) {
        apiKeyModal.style.display = 'none';
    }
});

saveApiKeyBtn.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('gemini-api-key', apiKey);
        apiKeyModal.style.display = 'none';
        alert('API Key saved!');
    } else {
        alert('Please enter a valid API Key.');
    }
});

darkModeCheckbox.addEventListener('change', () => {
    localStorage.setItem('dark-mode', darkModeCheckbox.checked);
    window.location.reload();
});

resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the chat history?')) {
        localStorage.removeItem('sketchiq-session');
        window.location.reload();
    }
});

generateBtn.addEventListener('click', handleGenerateClick);

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(mermaidCodeEl.textContent).then(() => {
        alert('Mermaid code copied to clipboard!');
    }, () => {
        alert('Failed to copy code.');
    });
});

downloadPngBtn.addEventListener('click', () => {
    const svgElement = diagramContainer.querySelector('svg');
    if (!svgElement) {
        alert('No diagram to download.');
        return;
    }
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = 'sketchiq-diagram.png';
        downloadLink.href = pngFile;
        downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// --- Functions ---

function loadState() {
    const darkMode = localStorage.getItem('dark-mode') === 'true';
    darkModeCheckbox.checked = darkMode;
    document.body.classList.toggle('dark-mode', darkMode);

    renderChat();

    if (sessionData.mermaidCode) {
        renderDiagram(sessionData.mermaidCode);
        mermaidCodeEl.textContent = sessionData.mermaidCode;
        generateBtn.textContent = 'Update Diagram';
    } else {
        const defaultDiagram = 'graph TD\n    A[Start] --> B{Is it?};\n    B -->|Yes| C[OK];\n    C --> D[End];\n    B -->|No| E[Oops];\n    E --> D;';
        renderDiagram(defaultDiagram);
        mermaidCodeEl.textContent = defaultDiagram;
    }
}

function renderChat() {
    chatContainer.innerHTML = '';
    sessionData.messages.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.classList.add('chat-message', `${msg.role}-message`);
        messageEl.textContent = msg.content;
        chatContainer.appendChild(messageEl);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(role, content) {
    sessionData.messages.push({ role, content });
    renderChat();
    saveSession();
}

function saveSession() {
    localStorage.setItem('sketchiq-session', JSON.stringify(sessionData));
}

async function handleGenerateClick() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Please enter a prompt.');
        return;
    }
    if (!apiKey) {
        alert('Please set your Gemini API Key first.');
        apiKeyModal.style.display = 'block';
        return;
    }

    addMessage('user', prompt);
    promptInput.value = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const fullPrompt = `
            You are an expert in Mermaid.js syntax.
            The user wants to create or update a diagram.
            Based on the user's prompt, generate a complete and valid Mermaid.js script.
            Only output the Mermaid script, without any explanation or markdown backticks.
            User prompt: "${prompt}"
            Current diagram context (if any):
            ${sessionData.mermaidCode || 'No previous context.'}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text.trim();
        const cleanMermaidCode = generatedText.replace(/```mermaid\n/g, '').replace(/```/g, '').trim();

        sessionData.mermaidCode = cleanMermaidCode;
        renderDiagram(cleanMermaidCode);
        mermaidCodeEl.textContent = cleanMermaidCode;
        addMessage('system', 'Diagram updated successfully!');

    } catch (error) {
        console.error('Error generating diagram:', error);
        addMessage('system', `Error: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Update Diagram';
    }
}

async function renderDiagram(code) {
    try {
        const { svg } = await mermaid.render('mermaid-graph', code);
        diagramContainer.innerHTML = svg;
    } catch (error) {
        diagramContainer.innerHTML = `<p>Error rendering diagram:</p><pre>${error.message}</pre>`;
    }
}

// --- Initial Load ---
loadState();
