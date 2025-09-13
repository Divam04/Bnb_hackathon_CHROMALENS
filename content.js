class Magnifier {
    constructor() {
        this.magnifierEl = null;
        this.canvasEl = null;
        this.ctx = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.animationFrameId = null;
        this.currentFilter = 'protanopia';
        this.stream = null;
        this.imageCapture = null;
    }

    async create() {
        if (this.magnifierEl) return;

        try {
            // Ask for screen sharing permission only ONCE when creating the magnifier
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'never', displaySurface: 'monitor' }
            });
            const track = this.stream.getVideoTracks()[0];
            this.imageCapture = new ImageCapture(track);

            // Now, create the UI elements after getting permission
            this.magnifierEl = document.createElement('div');
            this.magnifierEl.id = 'chromalens-magnifier';
            
            this.canvasEl = document.createElement('canvas');
            this.canvasEl.width = 200;
            this.canvasEl.height = 200;
            this.ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });

            this.magnifierEl.appendChild(this.canvasEl);
            document.body.appendChild(this.magnifierEl);

            this.addEventListeners();
            this.loop(); // Start the animation loop

        } catch (err) {
            console.error("ChromaLens Permission Error:", err);
            // If the user denies permission, ensure we clean up everything
            this.destroy(); 
        }
    }

    destroy() {
        // Stop the screen sharing stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Stop the animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Remove the magnifier element from the page
        if (this.magnifierEl) {
            this.magnifierEl.remove();
        }

        // Reset all class properties to their initial state
        this.magnifierEl = null;
        this.canvasEl = null;
        this.ctx = null;
        this.imageCapture = null;
        this.animationFrameId = null;
    }

    addEventListeners() {
        this.magnifierEl.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    onMouseDown(e) {
        this.isDragging = true;
        const rect = this.magnifierEl.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        this.magnifierEl.style.cursor = 'grabbing';
    }

    onMouseMove(e) {
        if (this.isDragging) {
            this.magnifierEl.style.left = `${e.clientX - this.dragOffset.x}px`;
            this.magnifierEl.style.top = `${e.clientY - this.dragOffset.y}px`;
        }
    }

    onMouseUp() {
        this.isDragging = false;
        if(this.magnifierEl) this.magnifierEl.style.cursor = 'grab';
    }

    loop() {
        if (!this.magnifierEl) return;
        this.captureAndDraw();
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    async captureAndDraw() {
        if (!this.imageCapture) return;

        try {
            // 1. Get the magnifier's position and size WHILE IT IS VISIBLE.
            const rect = this.magnifierEl.getBoundingClientRect();
            const captureX = rect.left + (rect.width / 2) - (this.canvasEl.width / 4);
            const captureY = rect.top + (rect.height / 2) - (this.canvasEl.height / 4);

            // 2. NOW, hide the magnifier to avoid capturing it.
            this.magnifierEl.style.display = 'none';

            // 3. Capture the screen using the CORRECT coordinates.
            const bitmap = await this.imageCapture.grabFrame();
            
            // 4. Restore magnifier visibility.
            this.magnifierEl.style.display = 'block';

            this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
            this.ctx.drawImage(
                bitmap,
                captureX * window.devicePixelRatio, captureY * window.devicePixelRatio,
                (this.canvasEl.width / 2) * window.devicePixelRatio, (this.canvasEl.height / 2) * window.devicePixelRatio,
                0, 0,
                this.canvasEl.width, this.canvasEl.height
            );

            this.applyFilter();

        } catch (err) {
            console.error("ChromaLens Capture Error:", err);
            this.destroy();
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
    }

    applyFilter() {
        if (!this.ctx) return;
        const imageData = this.ctx.getImageData(0, 0, this.canvasEl.width, this.canvasEl.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            let newR, newG, newB;

            switch (this.currentFilter) {
                case 'protanopia': // Red-blind
                    newR = 0.567 * r + 0.433 * g;
                    newG = 0.558 * r + 0.442 * g;
                    newB = 0.242 * g + 0.758 * b;
                    break;
                case 'deuteranopia': // Green-blind
                    newR = 0.625 * r + 0.375 * g;
                    newG = 0.700 * r + 0.300 * g;
                    newB = 0.300 * g + 0.700 * b;
                    break;
                case 'tritanopia': // Blue-blind
                    newR = 0.950 * r + 0.050 * g;
                    newG = 0.433 * g + 0.567 * b;
                    newB = 0.475 * g + 0.525 * b;
                    break;
                default:
                    newR = r; newG = g; newB = b;
            }
            data[i] = newR;
            data[i + 1] = newG;
            data[i + 2] = newB;
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
}


// --- Global Listener ---
const magnifierInstance = new Magnifier();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'activateMagnifier') {
        await magnifierInstance.create(); // Await the async create function
        magnifierInstance.setFilter(message.filter);
    } else if (message.action === 'deactivateMagnifier') {
        magnifierInstance.destroy();
    }
    sendResponse({ status: "done" });
    return true; // Keep the message channel open for async response
});