class ChromaLensPopup {
    constructor() {
        this.cache = new Map();
        this.speechEnabled = true;
        this.synth = window.speechSynthesis;
        this.init();
    }

    async init() {
        this.ui = {
            // Inspector
            activateInspectorBtn: document.getElementById('activate-inspector'),
            inspectorResult: document.getElementById('inspector-result'),
            inspectorColorPreview: document.getElementById('inspector-color-preview'),
            inspectorColorName: document.getElementById('inspector-color-name'),
            inspectorColorHex: document.getElementById('inspector-color-hex'),

            // Speech
            speechEnabledCheckbox: document.getElementById('speech-enabled'),

            // General
            errorMessage: document.getElementById('error-message'),
        };

        await this.loadSettings();
        this.initializeSpeech();
        this.addEventListeners();
    }

    addEventListeners() {
        this.ui.activateInspectorBtn.addEventListener('click', () => this.runInspector());
        this.ui.speechEnabledCheckbox.addEventListener('change', (e) => this.toggleSpeech(e.target.checked));
    }

    // --- COLOR INSPECTOR LOGIC ---

    async runInspector() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError("No active tab found.");
                return;
            }

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: injectedEyeDropper,
            });

            const result = injectionResults[0].result;
            if (result.error) {
                this.showError(result.error);
            } else if (result.hexValue) {
                this.fetchColorDetails(result.hexValue);
            }
        } catch (error) {
            console.error("ChromaLens Error:", error);
            this.showError("Could not inspect color. Try reloading the page.");
        }
    }

    async fetchColorDetails(hex) {
        // Show "Identifying..." without speaking it
        this.displayColorInfoSilent({ name: 'Identifying...', hex });
        
        if (this.cache.has(hex)) {
            this.displayColorInfo(this.cache.get(hex));
            return;
        }

        try {
            const cleanHex = hex.substring(1);
            const response = await fetch(`https://www.thecolorapi.com/id?hex=${cleanHex}`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            
            const data = await response.json();
            const colorInfo = {
                name: data.name.value,
                hex: data.hex.value,
            };

            this.cache.set(hex, colorInfo);
            this.displayColorInfo(colorInfo);
        } catch (error) {
            console.error("Color API Error:", error);
            this.showError("Could not get color name.");
            this.displayColorInfo({ name: "Unknown Color", hex });
        }
    }

    displayColorInfo({ name, hex }) {
        this.ui.inspectorResult.classList.remove('hidden');
        this.ui.inspectorColorPreview.style.backgroundColor = hex;
        this.ui.inspectorColorName.textContent = name;
        this.ui.inspectorColorHex.textContent = hex.toUpperCase();
        this.hideError();
        
        // Speak the color name if speech is enabled
        if (this.speechEnabled) {
            this.speakColorName(name);
        }
    }

    displayColorInfoSilent({ name, hex }) {
        this.ui.inspectorResult.classList.remove('hidden');
        this.ui.inspectorColorPreview.style.backgroundColor = hex;
        this.ui.inspectorColorName.textContent = name;
        this.ui.inspectorColorHex.textContent = hex.toUpperCase();
        this.hideError();
        
        // Don't speak for "Identifying..." or other temporary text
    }

    // --- SPEECH FUNCTIONALITY ---

    initializeSpeech() {
        // Ensure voices are loaded
        if (this.synth.getVoices().length === 0) {
            // Voices might not be loaded yet, wait for them
            this.synth.addEventListener('voiceschanged', () => {
                console.log('Voices loaded:', this.synth.getVoices().length);
                this.logAvailableVoices();
            });
        } else {
            this.logAvailableVoices();
        }
    }

    logAvailableVoices() {
        const voices = this.synth.getVoices();
        console.log('Available voices:');
        voices.forEach(voice => {
            if (voice.lang.startsWith('en')) {
                console.log(`- ${voice.name} (${voice.lang})`);
            }
        });
    }

    speakColorName(colorName) {
        if (!this.synth) {
            console.warn('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(colorName);
        
        // Configure speech settings for smoother, clearer speech
        utterance.rate = 0.75; // Slower for better clarity
        utterance.pitch = 1.1; // Slightly higher pitch for clarity
        utterance.volume = 0.9; // Higher volume for better audibility
        
        // Get available voices
        const voices = this.synth.getVoices();
        
        // Priority order for voice selection (Indian English first)
        const voicePriorities = [
            // Indian English voices (highest priority)
            voice => voice.lang === 'en-IN' && (voice.name.includes('Google') || voice.name.includes('Microsoft')),
            voice => voice.lang === 'en-IN',
            voice => voice.lang.startsWith('en-IN'),
            
            // Other English voices with Indian characteristics
            voice => voice.lang === 'en' && (voice.name.includes('India') || voice.name.includes('Indian')),
            voice => voice.lang === 'en' && (voice.name.includes('Ravi') || voice.name.includes('Priya') || voice.name.includes('Kiran')),
            
            // High-quality English voices as fallback
            voice => voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Microsoft')),
            voice => voice.lang.startsWith('en') && voice.name.includes('Natural'),
            voice => voice.lang.startsWith('en') && voice.name.includes('Enhanced'),
            
            // Any English voice as last resort
            voice => voice.lang.startsWith('en')
        ];
        
        // Find the best available voice
        let selectedVoice = null;
        for (const priority of voicePriorities) {
            selectedVoice = voices.find(priority);
            if (selectedVoice) break;
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
        } else {
            console.log('Using default voice');
        }

        // Speak the color name
        this.synth.speak(utterance);
    }

    toggleSpeech(enabled) {
        this.speechEnabled = enabled;
        this.saveSettings();
        
        // If disabling, cancel any ongoing speech
        if (!enabled && this.synth) {
            this.synth.cancel();
        }
    }

    // --- SETTINGS MANAGEMENT ---

    async loadSettings() {
        try {
            const data = await chrome.storage.local.get(['speechEnabled']);
            this.speechEnabled = data.speechEnabled !== undefined ? data.speechEnabled : true;
            this.ui.speechEnabledCheckbox.checked = this.speechEnabled;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({
                speechEnabled: this.speechEnabled
            });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    showError(message) {
        this.ui.errorMessage.textContent = message;
        this.ui.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.ui.errorMessage.classList.add('hidden');
    }
}

// This function gets injected into the webpage to run the EyeDropper
function injectedEyeDropper() {
    return new Promise(async (resolve) => {
        if (!window.EyeDropper) {
            resolve({ error: "EyeDropper API not supported in your browser." });
            return;
        }

        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            resolve({ hexValue: result.sRGBHex.toLowerCase() });
        } catch (e) {
            // This error means the user cancelled the dropper, which is normal.
            resolve({ hexValue: null });
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    new ChromaLensPopup();
});