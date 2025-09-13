// Content script for ChromaLens colorblind filter
class ColorblindFilter {
    constructor() {
        this.isActive = false;
        this.filterType = 'protanopia';
        this.overlay = null;
        this.selectionBox = null;
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        
        this.init();
    }

    init() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request);
            
            if (request.action === 'startFilter') {
                this.startFilter(request.filterType);
                sendResponse({ success: true });
            } else if (request.action === 'stopFilter') {
                this.stopFilter();
                sendResponse({ success: true });
            }
            
            return true; // Keep the message channel open for async response
        });
        
        console.log('ChromaLens content script initialized');
    }

    startFilter(filterType) {
        if (this.isActive) {
            this.stopFilter();
        }
        
        this.isActive = true;
        this.filterType = filterType;
        this.createOverlay();
        this.addEventListeners();
        this.createGlobalControls();
    }

    stopFilter() {
        this.isActive = false;
        this.removeOverlay();
        this.removeEventListeners();
        this.removeGlobalControls();
        this.removeCurrentFilter();
    }

    createOverlay() {
        // Create overlay that covers the entire page
        this.overlay = document.createElement('div');
        this.overlay.id = 'chromalens-filter-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: transparent;
            z-index: 999999;
            pointer-events: auto;
            cursor: crosshair;
        `;

        // Create selection box
        this.selectionBox = document.createElement('div');
        this.selectionBox.id = 'chromalens-selection-box';
        this.selectionBox.style.cssText = `
            position: absolute;
            border: 2px dashed #667eea;
            background: rgba(102, 126, 234, 0.1);
            pointer-events: none;
            display: none;
        `;

        this.overlay.appendChild(this.selectionBox);
        document.body.appendChild(this.overlay);
    }

    removeOverlay() {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
            this.selectionBox = null;
        }
    }

    addEventListeners() {
        if (this.overlay) {
            this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.overlay.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.overlay.addEventListener('mouseup', this.handleMouseUp.bind(this));
            this.overlay.addEventListener('click', this.handleClick.bind(this));
        }
    }

    removeEventListeners() {
        if (this.overlay) {
            this.overlay.removeEventListener('mousedown', this.handleMouseDown.bind(this));
            this.overlay.removeEventListener('mousemove', this.handleMouseMove.bind(this));
            this.overlay.removeEventListener('mouseup', this.handleMouseUp.bind(this));
            this.overlay.removeEventListener('click', this.handleClick.bind(this));
        }
    }

    handleMouseDown(e) {
        e.preventDefault();
        this.isSelecting = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        this.selectionBox.style.display = 'block';
    }

    handleMouseMove(e) {
        if (!this.isSelecting) return;
        
        e.preventDefault();
        this.endX = e.clientX;
        this.endY = e.clientY;
        
        const left = Math.min(this.startX, this.endX);
        const top = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
    }

    handleMouseUp(e) {
        if (!this.isSelecting) return;
        
        e.preventDefault();
        this.isSelecting = false;
        
        const left = Math.min(this.startX, this.endX);
        const top = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        
        // Only apply filter if selection is large enough
        if (width > 10 && height > 10) {
            this.applyFilter(left, top, width, height);
        }
        
        this.selectionBox.style.display = 'none';
    }

    handleClick(e) {
        // Prevent clicks from reaching the page
        e.preventDefault();
        e.stopPropagation();
    }

    applyFilter(x, y, width, height) {
        // Create a filter overlay that only covers the selected region
        // This approach avoids affecting elements directly and only shows the filter in the selected area

        // Create a filter overlay that only covers the selected region
        const filterIndicator = document.createElement('div');
        filterIndicator.className = 'chromalens-filter-overlay';
        filterIndicator.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: ${width}px;
            height: ${height}px;
            pointer-events: none;
            z-index: 999998;
            border: 2px solid #ff9800;
            box-shadow: 0 0 15px rgba(255, 152, 0, 0.5);
        `;

        // Apply the color filter only to this specific region
        const filterCSS = this.getColorblindCSSFilter(this.filterType);
        
        // Use backdrop-filter to apply the colorblind effect to the content behind
        filterIndicator.style.backdropFilter = filterCSS;
        filterIndicator.style.webkitBackdropFilter = filterCSS;
        
        // Add a semi-transparent background to make the effect visible
        filterIndicator.style.background = 'rgba(255, 255, 255, 0.1)';
        
        // Create a mask to ensure the filter only affects the selected area
        filterIndicator.style.clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
        filterIndicator.style.webkitClipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;

        // Create a control panel for the filter
        const controlPanel = this.createControlPanel(filterIndicator, x, y, width, height);
        
        document.body.appendChild(filterIndicator);
        document.body.appendChild(controlPanel);

        // Remove the overlay temporarily to show the result
        this.overlay.style.display = 'none';

        // Store references for cleanup
        this.currentFilterOverlay = filterIndicator;
        this.currentControlPanel = controlPanel;

        // Show the filter for 10 seconds, then remove it
        setTimeout(() => {
            this.removeCurrentFilter();
            this.overlay.style.display = 'block';
        }, 10000);
    }

    getElementsInArea(x, y, width, height) {
        const elementsInArea = [];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            
            // Check if element intersects with our area
            if (rect.left < x + width && rect.right > x && 
                rect.top < y + height && rect.bottom > y) {
                
                // Skip elements that are too small or have no visual content
                if (rect.width > 5 && rect.height > 5) {
                    elementsInArea.push(element);
                }
            }
        });
        
        return elementsInArea;
    }

    getColorblindCSSFilter(filterType) {
        // CSS filters that match Windows/macOS colorblind filters
        const filters = {
            protanopia: 'sepia(1) hue-rotate(240deg) saturate(1.5) contrast(1.2)',
            deuteranopia: 'sepia(1) hue-rotate(180deg) saturate(1.5) contrast(1.2)',
            tritanopia: 'sepia(1) hue-rotate(60deg) saturate(1.5) contrast(1.2)'
        };
        return filters[filterType] || filters.protanopia;
    }


    createControlPanel(filterElement, x, y, width, height) {
        const panel = document.createElement('div');
        panel.className = 'chromalens-filter-controls';
        panel.style.cssText = `
            position: fixed;
            left: ${Math.max(10, x - 200)}px;
            top: ${Math.max(10, y - 60)}px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 999999;
            pointer-events: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const filterTypeNames = {
            protanopia: 'Protanopia (Red-blind)',
            deuteranopia: 'Deuteranopia (Green-blind)',
            tritanopia: 'Tritanopia (Blue-blind)'
        };

        panel.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>🔍 ${filterTypeNames[this.filterType]}</strong>
            </div>
            <div style="margin-bottom: 8px;">
                Filter applied to selected area (${Math.round(width)}×${Math.round(height)}px)
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="chromalens-remove-filter" style="
                    background: #e03131;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                ">Remove Filter</button>
                <button id="chromalens-new-selection" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                ">New Selection</button>
            </div>
        `;

        // Add event listeners for the buttons
        panel.querySelector('#chromalens-remove-filter').addEventListener('click', () => {
            this.removeCurrentFilter();
        });

        panel.querySelector('#chromalens-new-selection').addEventListener('click', () => {
            this.removeCurrentFilter();
            this.overlay.style.display = 'block';
        });

        return panel;
    }

    removeCurrentFilter() {
        // Remove filter overlay
        if (this.currentFilterOverlay && document.body.contains(this.currentFilterOverlay)) {
            document.body.removeChild(this.currentFilterOverlay);
        }
        
        // Remove control panel
        if (this.currentControlPanel && document.body.contains(this.currentControlPanel)) {
            document.body.removeChild(this.currentControlPanel);
        }
        
        // Clean up references
        this.currentFilterOverlay = null;
        this.currentControlPanel = null;
    }


    createGlobalControls() {
        // Create a floating control panel that stays visible
        this.globalControls = document.createElement('div');
        this.globalControls.className = 'chromalens-global-controls';
        this.globalControls.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 1000000;
            pointer-events: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 2px solid #667eea;
        `;

        const filterTypeNames = {
            protanopia: 'Protanopia (Red-blind)',
            deuteranopia: 'Deuteranopia (Green-blind)',
            tritanopia: 'Tritanopia (Blue-blind)'
        };

        this.globalControls.innerHTML = `
            <div style="margin-bottom: 10px; text-align: center;">
                <strong>🔍 ChromaLens Filter</strong>
            </div>
            <div style="margin-bottom: 10px; text-align: center;">
                ${filterTypeNames[this.filterType]}
            </div>
            <div style="margin-bottom: 10px; font-size: 11px; color: #ccc;">
                Click and drag to select an area
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="chromalens-stop-filter" style="
                    background: #e03131;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                ">Stop Filter</button>
            </div>
        `;

        // Add event listener for stop button
        this.globalControls.querySelector('#chromalens-stop-filter').addEventListener('click', () => {
            this.stopFilter();
        });

        document.body.appendChild(this.globalControls);
    }

    removeGlobalControls() {
        if (this.globalControls && document.body.contains(this.globalControls)) {
            document.body.removeChild(this.globalControls);
            this.globalControls = null;
        }
    }
}

// Initialize the filter when the script loads
const colorblindFilter = new ColorblindFilter();
