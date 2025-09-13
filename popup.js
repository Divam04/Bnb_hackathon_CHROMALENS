class ChromaLensPopup {
    constructor() {
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

            // General
            errorMessage: document.getElementById('error-message'),
        };

        this.addEventListeners();
    }

    addEventListeners() {
        this.ui.activateInspectorBtn.addEventListener('click', () => this.runInspector());
    }

    // --- COLOR INSPECTOR LOGIC ---

    async runInspector() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError("No active tab found.");
                return;
            }

            // Check if EyeDropper API is supported
            if (window.EyeDropper) {
                // Use native EyeDropper API
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
            } else {
                // Fallback to HTML color picker
                this.showFallbackColorPicker();
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
    }

    displayColorInfoSilent({ name, hex }) {
        this.ui.inspectorResult.classList.remove('hidden');
        this.ui.inspectorColorPreview.style.backgroundColor = hex;
        this.ui.inspectorColorName.textContent = name;
        this.ui.inspectorColorHex.textContent = hex.toUpperCase();
        this.hideError();
        
        // Don't speak for "Identifying..." or other temporary text
    }

    showFallbackColorPicker() {
        // Create a hidden color input for fallback
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.style.position = 'fixed';
        colorInput.style.top = '-1000px';
        colorInput.style.left = '-1000px';
        colorInput.style.opacity = '0';
        colorInput.style.pointerEvents = 'none';
        
        // Add to DOM temporarily
        document.body.appendChild(colorInput);
        
        // Trigger color picker
        colorInput.click();
        
        // Handle color selection
        colorInput.addEventListener('change', (e) => {
            const hexValue = e.target.value;
            if (hexValue) {
                this.fetchColorDetails(hexValue);
            }
            // Clean up
            document.body.removeChild(colorInput);
        });
        
        // Clean up if user cancels (clicks outside)
        setTimeout(() => {
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        }, 1000);
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
        // Check for EyeDropper API support
        if (typeof window.EyeDropper === 'undefined') {
            resolve({ error: "EyeDropper API not supported in your browser. Please use Chrome 95+ or try the fallback color picker." });
            return;
        }

        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            resolve({ hexValue: result.sRGBHex.toLowerCase() });
        } catch (e) {
            // This error means the user cancelled the dropper, which is normal.
            if (e.name === 'AbortError') {
                resolve({ hexValue: null });
            } else {
                resolve({ error: `EyeDropper error: ${e.message}` });
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    new ChromaLensPopup();
});