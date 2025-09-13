class ChromaLensPopup {
    constructor() {
        this.cache = new Map();
        this.speechEnabled = true;
        this.synth = window.speechSynthesis;
        this.cameraActive = false;
        this.videoStream = null;
        this.colorDetectionInterval = null;
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

            // Camera
            toggleCameraBtn: document.getElementById('toggle-camera'),
            cameraContainer: document.getElementById('camera-container'),
            cameraVideo: document.getElementById('camera-video'),
            colorDetector: document.getElementById('color-detector'),
            captureColorBtn: document.getElementById('capture-color'),
            stopCameraBtn: document.getElementById('stop-camera'),
            cameraResult: document.getElementById('camera-result'),
            cameraColorPreview: document.getElementById('camera-color-preview'),
            cameraColorName: document.getElementById('camera-color-name'),
            cameraColorHex: document.getElementById('camera-color-hex'),

            // General
            errorMessage: document.getElementById('error-message'),
        };

        this.addEventListeners();
    }

    addEventListeners() {
        this.ui.activateInspectorBtn.addEventListener('click', () => this.runInspector());
        this.ui.speechEnabledCheckbox.addEventListener('change', (e) => this.toggleSpeech(e.target.checked));
        
        // Camera event listeners
        this.ui.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        this.ui.captureColorBtn.addEventListener('click', () => this.captureColorFromCamera());
        this.ui.stopCameraBtn.addEventListener('click', () => this.stopCamera());
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
        
        // Speak the color name if speech is enabled and it's not "Identifying..."
        if (this.speechEnabled && name !== 'Identifying...' && name !== 'Unknown Color') {
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

    // --- SPEECH SYNTHESIS LOGIC ---

    speakColorName(colorName) {
        try {
            // Cancel any ongoing speech
            this.synth.cancel();

            // Create speech utterance
            const utterance = new SpeechSynthesisUtterance(colorName);
            
            // Configure speech settings for cross-platform compatibility
            utterance.volume = 0.8;
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.lang = 'en-US';

            // Try to select a good voice
            this.selectBestVoice(utterance);

            // Handle speech events
            utterance.onstart = () => {
                console.log('Speaking:', colorName);
            };

            utterance.onerror = (event) => {
                console.warn('Speech synthesis error:', event.error);
                // Don't show error to user, just fail silently
            };

            utterance.onend = () => {
                console.log('Finished speaking:', colorName);
            };

            // Speak the color name
            this.synth.speak(utterance);

        } catch (error) {
            console.warn('Speech synthesis not available:', error);
            // Fail silently - don't interrupt the user experience
        }
    }

    selectBestVoice(utterance) {
        try {
            const voices = this.synth.getVoices();
            
            if (voices.length === 0) {
                // If no voices are loaded yet, wait a bit and try again
                setTimeout(() => {
                    const voices = this.synth.getVoices();
                    this.selectBestVoiceFromList(utterance, voices);
                }, 100);
                return;
            }

            this.selectBestVoiceFromList(utterance, voices);
        } catch (error) {
            console.warn('Error getting voices:', error);
        }
    }

    selectBestVoiceFromList(utterance, voices) {
        // Priority order for voice selection (cross-platform)
        const preferredVoices = [
            'Microsoft Zira Desktop',      // Windows 10/11
            'Microsoft David Desktop',     // Windows 10/11
            'Alex',                        // macOS
            'Samantha',                    // macOS
            'Victoria',                    // macOS
            'Daniel',                      // macOS
            'Google US English',           // Chrome
            'English (United States)',     // Generic
            'en-US'                        // Language fallback
        ];

        // Try to find a preferred voice
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => 
                v.name.includes(preferred) || 
                v.lang.includes(preferred) ||
                (preferred === 'en-US' && v.lang.startsWith('en'))
            );
            
            if (voice) {
                utterance.voice = voice;
                console.log('Selected voice:', voice.name);
                return;
            }
        }

        // Fallback to first available English voice
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
            console.log('Using fallback voice:', englishVoice.name);
        } else if (voices.length > 0) {
            // Last resort - use any available voice
            utterance.voice = voices[0];
            console.log('Using default voice:', voices[0].name);
        }
    }

    toggleSpeech(enabled) {
        this.speechEnabled = enabled;
        console.log('Speech enabled:', enabled);
        
        // If disabling speech, cancel any ongoing speech
        if (!enabled) {
            this.synth.cancel();
        }
    }

    // --- CAMERA COLOR DETECTION LOGIC ---

    async toggleCamera() {
        if (this.cameraActive) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            // Request camera access
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'environment' // Use back camera if available
                }
            });

            // Set video source
            this.ui.cameraVideo.srcObject = this.videoStream;
            
            // Wait for video to load
            this.ui.cameraVideo.onloadedmetadata = () => {
                this.ui.cameraVideo.play();
                this.cameraActive = true;
                this.updateCameraUI();
                this.startColorDetection();
            };

        } catch (error) {
            console.error('Camera error:', error);
            this.showError('Could not access camera. Please check permissions.');
        }
    }

    stopCamera() {
        // Stop video stream
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }

        // Clear video source
        this.ui.cameraVideo.srcObject = null;
        
        // Stop color detection
        if (this.colorDetectionInterval) {
            clearInterval(this.colorDetectionInterval);
            this.colorDetectionInterval = null;
        }

        this.cameraActive = false;
        this.updateCameraUI();
    }

    updateCameraUI() {
        if (this.cameraActive) {
            this.ui.toggleCameraBtn.textContent = 'Stop Camera';
            this.ui.toggleCameraBtn.classList.add('active');
            this.ui.cameraContainer.classList.remove('hidden');
        } else {
            this.ui.toggleCameraBtn.textContent = 'Start Camera';
            this.ui.toggleCameraBtn.classList.remove('active');
            this.ui.cameraContainer.classList.add('hidden');
            this.ui.cameraResult.classList.add('hidden');
        }
    }

    startColorDetection() {
        // Detect color every 500ms for smooth performance
        this.colorDetectionInterval = setInterval(() => {
            this.detectColorFromVideo();
        }, 500);
    }

    detectColorFromVideo() {
        if (!this.cameraActive || this.ui.cameraVideo.videoWidth === 0) return;

        try {
            // Create canvas to capture video frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to video size
            canvas.width = this.ui.cameraVideo.videoWidth;
            canvas.height = this.ui.cameraVideo.videoHeight;
            
            // Draw current video frame
            ctx.drawImage(this.ui.cameraVideo, 0, 0);
            
            // Get pixel color from center of video (where the detector circle is)
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const pixelData = ctx.getImageData(centerX, centerY, 1, 1).data;
            
            // Convert to hex
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            // Update detector circle color
            this.ui.colorDetector.style.borderColor = hex;
            this.ui.colorDetector.style.boxShadow = `0 0 20px ${hex}80`;
            
        } catch (error) {
            console.warn('Color detection error:', error);
        }
    }

    async captureColorFromCamera() {
        if (!this.cameraActive) return;

        try {
            // Create canvas to capture video frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to video size
            canvas.width = this.ui.cameraVideo.videoWidth;
            canvas.height = this.ui.cameraVideo.videoHeight;
            
            // Draw current video frame
            ctx.drawImage(this.ui.cameraVideo, 0, 0);
            
            // Get pixel color from center of video
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const pixelData = ctx.getImageData(centerX, centerY, 1, 1).data;
            
            // Convert to hex
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            // Fetch color details and display
            await this.fetchColorDetailsForCamera(hex);
            
        } catch (error) {
            console.error('Capture error:', error);
            this.showError('Could not capture color from camera.');
        }
    }

    async fetchColorDetailsForCamera(hex) {
        // Show "Identifying..." without speaking it
        this.displayCameraColorInfo({ name: 'Identifying...', hex });
        
        if (this.cache.has(hex)) {
            this.displayCameraColorInfo(this.cache.get(hex));
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
            this.displayCameraColorInfo(colorInfo);
        } catch (error) {
            console.error("Color API Error:", error);
            this.showError("Could not get color name.");
            this.displayCameraColorInfo({ name: "Unknown Color", hex });
        }
    }

    displayCameraColorInfo({ name, hex }) {
        this.ui.cameraResult.classList.remove('hidden');
        this.ui.cameraColorPreview.style.backgroundColor = hex;
        this.ui.cameraColorName.textContent = name;
        this.ui.cameraColorHex.textContent = hex.toUpperCase();
        this.hideError();
        
        // Speak the color name if speech is enabled and it's not "Identifying..."
        if (this.speechEnabled && name !== 'Identifying...' && name !== 'Unknown Color') {
            this.speakColorName(name);
        }
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