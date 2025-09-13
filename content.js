class Magnifier {
    constructor() {
        this.magnifierEl = null;
        this.canvasEl = null;
        this.ctx = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.animationFrameId = null;
        this.currentFilter = 'protanopia';
    }

    create() {
        if (this.magnifierEl) return;

        this.magnifierEl = document.createElement('div');
        this.magnifierEl.id = 'chromalens-magnifier';
        
        this.canvasEl = document.createElement('canvas');
        this.canvasEl.width = 200;
        this.canvasEl.height = 200;
        this.ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });

        this.magnifierEl.appendChild(this.canvasEl);
        document.body.appendChild(this.magnifierEl);

        this.addEventListeners();
        this.loop();
    }

    destroy() {
        if (!this.magnifierEl) return;
        
        cancelAnimationFrame(this.animationFrameId);
        this.magnifierEl.remove();
        this.magnifierEl = null;
        this.canvasEl = null;
        this.ctx = null;
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
        try {
            const rect = this.magnifierEl.getBoundingClientRect();
            // Capture a slightly larger area for better centering
            const captureX = rect.left + (rect.width / 2) - (this.canvasEl.width / 4);
            const captureY = rect.top + (rect.height / 2) - (this.canvasEl.height / 4);

            // Hide magnifier before capture to avoid capturing itself
            this.magnifierEl.style.display = 'none';

            // Use browser.display.capture API
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'never',
                    displaySurface: 'monitor',
                }
            });
            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            
            track.stop(); // Stop the track immediately after capture
            
            // Restore magnifier visibility
            this.magnifierEl.style.display = 'block';

            this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
            // Draw a magnified version of the captured area
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
            if (this.magnifierEl) this.magnifierEl.style.display = 'block'; // Ensure it's visible on error
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'activateMagnifier') {
        magnifierInstance.create();
        magnifierInstance.setFilter(message.filter);
    } else if (message.action === 'deactivateMagnifier') {
        magnifierInstance.destroy();
    }
    sendResponse({ status: "done" });
    return true;
});