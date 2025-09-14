class ChromaLensPopup {
    constructor() {
        this.cache = new Map();
        this.speechEnabled = true;
        this.synth = window.speechSynthesis;
        this.cameraActive = false;
        this.videoStream = null;
        this.colorDetectionInterval = null;
        this.filterActive = false;
        this.init();
    }

    async init() {
        // Windows compatibility check
        const browserInfo = this.getWindowsBrowserInfo();
        if (browserInfo.isWindows && !browserInfo.isSupported) {
            console.warn('Windows browser compatibility warning:', browserInfo);
        }

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

            // Filter
            activateFilterBtn: document.getElementById('activate-filter'),
            filterInstructions: document.getElementById('filter-instructions'),
            stopFilterBtn: document.getElementById('stop-filter'),

            // General
            errorMessage: document.getElementById('error-message'),
        };

        // Windows-specific initialization
        if (browserInfo.isWindows) {
            this.initializeWindowsFeatures();
        }

        this.addEventListeners();
    }

    initializeWindowsFeatures() {
        // Windows-specific speech synthesis initialization
        if (this.synth) {
            // Load voices for Windows
            this.synth.onvoiceschanged = () => {
                console.log('Voices loaded for Windows');
            };
        }

        // Windows-specific error handling
        window.addEventListener('error', (event) => {
            if (this.detectWindows()) {
                console.error('Windows error:', event.error);
                // Don't show generic errors to user on Windows
            }
        });

        // Windows-specific unhandled promise rejection handling
        window.addEventListener('unhandledrejection', (event) => {
            if (this.detectWindows()) {
                console.error('Windows unhandled promise rejection:', event.reason);
                // Prevent default error display
                event.preventDefault();
            }
        });
    }

    addEventListeners() {
        this.ui.activateInspectorBtn.addEventListener('click', () => this.runInspector());
        this.ui.speechEnabledCheckbox.addEventListener('change', (e) => this.toggleSpeech(e.target.checked));
        
        // Camera event listeners
        this.ui.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        this.ui.captureColorBtn.addEventListener('click', () => this.captureColorFromCamera());
        this.ui.stopCameraBtn.addEventListener('click', () => this.stopCamera());
        
        // Filter event listeners
        this.ui.activateFilterBtn.addEventListener('click', () => this.toggleFilter());
        this.ui.stopFilterBtn.addEventListener('click', () => this.stopFilter());
    }

    // --- COLOR INSPECTOR LOGIC ---

    async runInspector() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError("No active tab found.");
                return;
            }

            // Enhanced Windows compatibility check
            const isWindows = this.detectWindows();
            const isChrome = this.detectChrome();
            const chromeVersion = this.getChromeVersion();

            // Check if EyeDropper API is supported with Windows-specific handling
            if (window.EyeDropper) {
                try {
                    // Use native EyeDropper API with Windows-specific error handling
                    const injectionResults = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: injectedEyeDropper,
                    });

                    const result = injectionResults[0].result;
                    if (result.error) {
                        if (isWindows && result.error.includes('NotAllowedError')) {
                            this.showError("Color picker was cancelled or blocked. Please try again and allow the permission.");
                        } else if (isWindows && result.error.includes('AbortError')) {
                            // User cancelled - don't show error
                            return;
                        } else {
                            this.showError(result.error);
                        }
                    } else if (result.hexValue) {
                        this.fetchColorDetails(result.hexValue);
                    }
                } catch (injectionError) {
                    console.error("Injection error:", injectionError);
                    if (isWindows) {
                        this.showError("Failed to access color picker on Windows. Using fallback method.");
                        this.showFallbackColorPicker();
                    } else {
                        this.showError("Could not inspect color. Try reloading the page.");
                    }
                }
            } else {
                // Enhanced fallback for Windows
                if (isWindows && isChrome && chromeVersion < 95) {
                    this.showError("EyeDropper API requires Chrome 95+ on Windows. Please update Chrome or use the fallback color picker.");
                }
                this.showFallbackColorPicker();
            }
        } catch (error) {
            console.error("ChromaLens Error:", error);
            const isWindows = this.detectWindows();
            if (isWindows && error.name === 'NotAllowedError') {
                this.showError("Permission denied. Please allow the color picker permission and try again.");
            } else {
                this.showError("Could not inspect color. Try reloading the page.");
            }
        }
    }

    // Windows compatibility detection methods
    detectWindows() {
        const platform = navigator.platform.toLowerCase();
        const userAgent = navigator.userAgent.toLowerCase();
        
        return platform.indexOf('win') > -1 || 
               userAgent.indexOf('windows') > -1 ||
               userAgent.indexOf('win32') > -1 ||
               userAgent.indexOf('win64') > -1;
    }

    detectChrome() {
        const userAgent = navigator.userAgent;
        return userAgent.indexOf('Chrome') > -1 && 
               userAgent.indexOf('Edg') === -1 &&
               userAgent.indexOf('OPR') === -1;
    }

    detectEdge() {
        const userAgent = navigator.userAgent;
        return userAgent.indexOf('Edg') > -1 || userAgent.indexOf('Edge') > -1;
    }

    getChromeVersion() {
        const match = navigator.userAgent.match(/Chrome\/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    getEdgeVersion() {
        const match = navigator.userAgent.match(/Edg\/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    // Enhanced Windows browser detection
    getWindowsBrowserInfo() {
        const isWindows = this.detectWindows();
        const isChrome = this.detectChrome();
        const isEdge = this.detectEdge();
        const chromeVersion = this.getChromeVersion();
        const edgeVersion = this.getEdgeVersion();
        
        return {
            isWindows,
            isChrome,
            isEdge,
            chromeVersion,
            edgeVersion,
            isSupported: isWindows && (isChrome || isEdge) && (chromeVersion >= 95 || edgeVersion >= 95)
        };
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
            // Check if speech synthesis is available
            if (!this.synth) {
                console.warn('Speech synthesis not available');
                return;
            }

            // Windows-specific speech synthesis initialization
            const isWindows = this.detectWindows();
            
            // Cancel any ongoing speech
            this.synth.cancel();

            // Create speech utterance
            const utterance = new SpeechSynthesisUtterance(colorName);
            
            // Configure speech settings for Windows compatibility
            utterance.volume = isWindows ? 0.9 : 0.8;
            utterance.rate = isWindows ? 0.8 : 0.9;  // Slower for Windows
            utterance.pitch = isWindows ? 0.9 : 1.0; // Slightly lower pitch for Windows
            utterance.lang = 'en-US';

            // Windows-specific voice selection
            if (isWindows) {
                this.selectWindowsVoice(utterance);
            } else {
                this.selectBestVoice(utterance);
            }

            // Handle speech events with Windows-specific error handling
            utterance.onstart = () => {
                console.log('Speaking:', colorName);
            };

            utterance.onerror = (event) => {
                console.warn('Speech synthesis error:', event.error);
                if (isWindows && event.error === 'not-allowed') {
                    console.warn('Speech synthesis blocked on Windows. User may need to enable microphone permissions.');
                }
                // Don't show error to user, just fail silently
            };

            utterance.onend = () => {
                console.log('Finished speaking:', colorName);
            };

            // Speak the color name with Windows-specific handling
            try {
                this.synth.speak(utterance);
            } catch (speakError) {
                console.warn('Failed to speak on Windows:', speakError);
                // Try with default settings as fallback
                if (isWindows) {
                    const fallbackUtterance = new SpeechSynthesisUtterance(colorName);
                    fallbackUtterance.volume = 0.8;
                    fallbackUtterance.rate = 0.8;
                    fallbackUtterance.pitch = 1.0;
                    this.synth.speak(fallbackUtterance);
                }
            }

        } catch (error) {
            console.warn('Speech synthesis not available:', error);
            // Fail silently - don't interrupt the user experience
        }
    }

    selectWindowsVoice(utterance) {
        try {
            const voices = this.synth.getVoices();
            
            if (voices.length === 0) {
                // If no voices are loaded yet, wait a bit and try again
                setTimeout(() => {
                    const voices = this.synth.getVoices();
                    this.selectWindowsVoiceFromList(utterance, voices);
                }, 200); // Longer wait for Windows
                return;
            }

            this.selectWindowsVoiceFromList(utterance, voices);
        } catch (error) {
            console.warn('Error getting voices on Windows:', error);
        }
    }

    selectWindowsVoiceFromList(utterance, voices) {
        // Windows-specific voice priority
        const windowsVoices = [
            'Microsoft Zira Desktop',      // Windows 10/11 female
            'Microsoft David Desktop',     // Windows 10/11 male
            'Microsoft Mark Desktop',      // Windows 10/11 male
            'Microsoft Hazel Desktop',     // Windows 10/11 female
            'Microsoft Susan Desktop',     // Windows 10/11 female
            'Microsoft Richard Desktop',   // Windows 10/11 male
            'Microsoft Catherine Desktop', // Windows 10/11 female
            'Microsoft James Desktop',     // Windows 10/11 male
            'Microsoft Linda Desktop',     // Windows 10/11 female
            'Microsoft Paul Desktop',      // Windows 10/11 male
            'Google US English',           // Chrome fallback
            'English (United States)',     // Generic fallback
            'en-US'                        // Language fallback
        ];

        // Try to find a Windows voice
        for (const preferred of windowsVoices) {
            const voice = voices.find(v => 
                v.name.includes(preferred) || 
                v.lang.includes(preferred) ||
                (preferred === 'en-US' && v.lang.startsWith('en'))
            );
            
            if (voice) {
                utterance.voice = voice;
                console.log('Selected Windows voice:', voice.name);
                return;
            }
        }

        // Fallback to any available voice
        if (voices.length > 0) {
            utterance.voice = voices[0];
            console.log('Using fallback voice:', voices[0].name);
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
            // Windows-specific camera configuration
            const isWindows = this.detectWindows();
            
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Camera access not supported in this browser. Please use Chrome or Edge on Windows.');
                return;
            }

            // Windows-specific camera constraints
            const constraints = {
                video: {
                    width: { ideal: isWindows ? 800 : 640 },
                    height: { ideal: isWindows ? 600 : 480 },
                    frameRate: { ideal: isWindows ? 30 : 24 },
                    facingMode: 'environment' // Use back camera if available
                }
            };

            // Add Windows-specific constraints
            if (isWindows) {
                constraints.video.deviceId = { exact: undefined }; // Let Windows choose the best camera
            }

            // Request camera access with Windows-specific error handling
            this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Set video source
            this.ui.cameraVideo.srcObject = this.videoStream;
            
            // Wait for video to load with Windows-specific handling
            this.ui.cameraVideo.onloadedmetadata = () => {
                try {
                    this.ui.cameraVideo.play();
                    this.cameraActive = true;
                    this.updateCameraUI();
                    this.startColorDetection();
                } catch (playError) {
                    console.error('Video play error on Windows:', playError);
                    this.showError('Failed to start video playback. Please try again.');
                }
            };

            // Windows-specific error handling for video loading
            this.ui.cameraVideo.onerror = (error) => {
                console.error('Video error on Windows:', error);
                this.showError('Camera video failed to load. Please check your camera connection.');
            };

        } catch (error) {
            console.error('Camera error:', error);
            const isWindows = this.detectWindows();
            
            if (isWindows) {
                if (error.name === 'NotAllowedError') {
                    this.showError('Camera access denied. Please allow camera permissions in Chrome settings and try again.');
                } else if (error.name === 'NotFoundError') {
                    this.showError('No camera found. Please connect a camera and try again.');
                } else if (error.name === 'NotReadableError') {
                    this.showError('Camera is being used by another application. Please close other apps and try again.');
                } else if (error.name === 'OverconstrainedError') {
                    this.showError('Camera constraints not supported. Trying with basic settings...');
                    // Try with basic constraints
                    this.startCameraWithBasicConstraints();
                } else {
                    this.showError(`Camera error: ${error.message}. Please check your camera and try again.`);
                }
            } else {
                this.showError('Could not access camera. Please check permissions.');
            }
        }
    }

    async startCameraWithBasicConstraints() {
        try {
            // Basic constraints for Windows compatibility
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: true
            });

            this.ui.cameraVideo.srcObject = this.videoStream;
            
            this.ui.cameraVideo.onloadedmetadata = () => {
                this.ui.cameraVideo.play();
                this.cameraActive = true;
                this.updateCameraUI();
                this.startColorDetection();
            };

        } catch (basicError) {
            console.error('Basic camera error:', basicError);
            this.showError('Could not access camera with any settings. Please check your camera and browser permissions.');
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

    // --- COLORBLIND FILTER LOGIC ---

    async toggleFilter() {
        if (this.filterActive) {
            await this.stopFilter();
        } else {
            await this.startFilter();
        }
    }

    async startFilter() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError("No active tab found.");
                return;
            }

            // Get selected filter type
            const selectedFilter = document.querySelector('input[name="filter-type"]:checked');
            const filterType = selectedFilter ? selectedFilter.value : 'protanopia';

            // Inject the content script first
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content-script.js']
                });
            } catch (injectError) {
                // If injection fails, try to send message anyway (script might already be injected)
                console.log("Script injection failed, trying to send message anyway:", injectError);
            }

            // Wait a moment for the script to initialize
            await new Promise(resolve => setTimeout(resolve, 100));

            // Send message to content script
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startFilter',
                filterType: filterType
            });

            this.filterActive = true;
            this.updateFilterUI();
            this.hideError();

        } catch (error) {
            console.error("Filter Error:", error);
            this.showError("Could not start filter. Try reloading the page.");
        }
    }

    async stopFilter() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'stopFilter'
                    });
                } catch (messageError) {
                    console.log("Could not send stop message, content script may not be loaded:", messageError);
                }
            }

            this.filterActive = false;
            this.updateFilterUI();
            this.hideError();

        } catch (error) {
            console.error("Stop Filter Error:", error);
            // Still update UI even if there's an error
            this.filterActive = false;
            this.updateFilterUI();
        }
    }

    updateFilterUI() {
        if (this.filterActive) {
            this.ui.activateFilterBtn.textContent = 'Stop Filter';
            this.ui.activateFilterBtn.classList.add('active');
            this.ui.filterInstructions.classList.remove('hidden');
        } else {
            this.ui.activateFilterBtn.textContent = 'Start Filter';
            this.ui.activateFilterBtn.classList.remove('active');
            this.ui.filterInstructions.classList.add('hidden');
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
