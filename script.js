import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

// Check for dark mode preference immediately to initialize mermaid with the correct theme
const isDarkMode = localStorage.getItem('dark-mode') === 'true';

mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? 'dark' : 'default',
});

const apiKeyBtn = document.getElementById('api-key-btn');
const apiKeyModal = document.getElementById('api-key-modal');
const closeBtn = document.querySelector('.close-btn');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyInput = document.getElementById('api-key-input');

const darkModeCheckbox = document.getElementById('dark-mode-checkbox');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const historyList = document.getElementById('history-list');

const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const diagramContainer = document.querySelector('#diagram .mermaid');
const mermaidCode = document.getElementById('mermaid-code');
const copyBtn = document.getElementById('copy-btn');
const downloadPngBtn = document.getElementById('download-png-btn');

let apiKey = localStorage.getItem('gemini-api-key');
let history = JSON.parse(localStorage.getItem('sketchiq-history')) || [];

// --- API Key Modal ---
apiKeyBtn.addEventListener('click', () => {
    apiKeyModal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    apiKeyModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == apiKeyModal) {
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

// --- Dark Mode ---
darkModeCheckbox.addEventListener('change', () => {
    localStorage.setItem('dark-mode', darkModeCheckbox.checked);
    window.location.reload();
});

function loadDarkModePreference() {
    const darkMode = localStorage.getItem('dark-mode') === 'true';
    darkModeCheckbox.checked = darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
}

// --- Tabs ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// --- History ---
function renderHistory() {
    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item.prompt.substring(0, 40) + '...';
        li.dataset.index = index;
        li.addEventListener('click', () => {
            const selectedItem = history[index];
            promptInput.value = selectedItem.prompt;
            renderDiagram(selectedItem.mermaidCode);
            mermaidCode.textContent = selectedItem.mermaidCode;
        });
        historyList.prepend(li);
    });
}

function addToHistory(prompt, mermaidCode) {
    history.push({ prompt, mermaidCode });
    localStorage.setItem('sketchiq-history', JSON.stringify(history));
    renderHistory();
}

// --- Diagram Generation ---
generateBtn.addEventListener('click', async () => {
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

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const fullPrompt = `
            You are an expert in Mermaid.js syntax.
            The user wants to create a diagram.
            Based on the user's prompt, generate a complete and valid Mermaid.js script.
            Only output the Mermaid script, without any explanation or markdown backticks.
            User prompt: "${prompt}"
            Previous diagram context (if any):
            ${mermaidCode.textContent || 'No previous context.'}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text.trim();

        const cleanMermaidCode = generatedText.replace(/```mermaid\n/g, '').replace(/```/g, '').trim();

        renderDiagram(cleanMermaidCode);
        mermaidCode.textContent = cleanMermaidCode;
        addToHistory(prompt, cleanMermaidCode);

    } catch (error) {
        console.error('Error generating diagram:', error);
        alert('Failed to generate diagram. Check the console for details.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Diagram';
    }
});

async function renderDiagram(code) {
    try {
        const { svg } = await mermaid.render('mermaid-graph', code);
        diagramContainer.innerHTML = svg;
    } catch (error) {
        diagramContainer.innerHTML = `Error rendering diagram: <pre>${error.message}</pre>`;
    }
}


// --- Copy and Download ---
copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(mermaidCode.textContent).then(() => {
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


// --- Initial Load ---
loadDarkModePreference();
renderHistory();
if (history.length > 0) {
    const lastItem = history[history.length - 1];
    promptInput.value = lastItem.prompt;
    renderDiagram(lastItem.mermaidCode);
    mermaidCode.textContent = lastItem.mermaidCode;
} else {
    const defaultDiagram = 'graph TD\n    A[Start] --> B{Is it?};\n    B -->|Yes| C[OK];\n    C --> D[End];\n    B -->|No| E[Oops];\n    E --> D;';
    renderDiagram(defaultDiagram);
    mermaidCode.textContent = defaultDiagram;
}
