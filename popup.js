class ChromaLensPopup {
    constructor() {
        this.magnifierActive = false;
        this.currentFilter = 'protanopia';
        this.cache = new Map();
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

            // Magnifier
            toggleMagnifierBtn: document.getElementById('toggle-magnifier'),
            filterRadios: document.querySelectorAll('input[name="filter"]'),

            // General
            errorMessage: document.getElementById('error-message'),
        };

        await this.loadState();
        this.addEventListeners();
        this.updateUI();
    }

    addEventListeners() {
        this.ui.activateInspectorBtn.addEventListener('click', () => this.runInspector());
        this.ui.toggleMagnifierBtn.addEventListener('click', () => this.toggleMagnifier());
        this.ui.filterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleFilterChange(e.target.value));
        });
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
        this.displayColorInfo({ name: 'Identifying...', hex });
        
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
    }


    // --- MAGNIFIER LOGIC ---
    
    toggleMagnifier() {
        this.magnifierActive = !this.magnifierActive;
        this.updateAndNotify();
    }
    
    handleFilterChange(newFilter) {
        this.currentFilter = newFilter;
        this.updateAndNotify();
    }
    
    // --- STATE & UI MANAGEMENT ---

    async updateAndNotify() {
        await this.saveState();
        this.updateUI();
        this.sendMessageToContentScript({
            action: this.magnifierActive ? 'activateMagnifier' : 'deactivateMagnifier',
            filter: this.currentFilter,
        });
    }
    
    async saveState() {
        await chrome.storage.local.set({
            magnifierActive: this.magnifierActive,
            currentFilter: this.currentFilter,
        });
    }

    async loadState() {
        const data = await chrome.storage.local.get(['magnifierActive', 'currentFilter']);
        this.magnifierActive = data.magnifierActive || false;
        this.currentFilter = data.currentFilter || 'protanopia';
    }

    updateUI() {
        // Magnifier button
        if (this.magnifierActive) {
            this.ui.toggleMagnifierBtn.textContent = 'Deactivate';
            this.ui.toggleMagnifierBtn.classList.add('active');
        } else {
            this.ui.toggleMagnifierBtn.textContent = 'Activate';
            this.ui.toggleMagnifierBtn.classList.remove('active');
        }

        // Filter radio
        document.querySelector(`input[name="filter"][value="${this.currentFilter}"]`).checked = true;
    }

    async sendMessageToContentScript(message) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.sendMessage(tab.id, message);
            }
        } catch (error) {
            console.error('Error sending message to content script:', error);
            this.showError("Communication error. Please reload the page.");
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