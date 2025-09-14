# Bnb-hackathon---chromalens


🎨 **ChromaLens** is a comprehensive web extension designed to help colorblind users navigate the digital world with confidence. It provides three powerful tools: a magnifying glass with colorblind filters, an intelligent color picker with human-readable descriptions, and a webcam-based live video filtering system.

## 🌟 Features

### 1. 🔍 Magnifying Glass Tool
- **Selective Filtering**: Apply colorblind filters only to specific areas of the screen
- **Draggable Interface**: Move the magnifying glass anywhere on the page
- **Real-time Preview**: See filtered content in real-time as you move the tool
- **Multiple Filter Types**: Support for Protanopia, Deuteranopia, and Tritanopia

### 2. 🎯 Color Picker Tool
- **Human-Readable Descriptions**: Get color names like "Light Blue" instead of hex codes
- **Live Color Detection**: Hover over any element to see its color information
- **Accessibility Focused**: Designed specifically for colorblind users
- **Crosshair Interface**: Precise color selection with visual feedback

### 3. 📹 Webcam Integration
- **Live Video Filtering**: Apply colorblind filters to your webcam feed in real-time
- **Color Picking from Video**: Click on any part of the video to identify colors
- **Frame Capture**: Capture filtered frames for analysis
- **Privacy-First**: All processing happens locally, no data sent to servers

## Instructions to Install 
1. Clone the repository through `git clone`
2. Upon cloning the repository, open your browser and enter `chrome://extensions` in your URL bar
3. Turn on developer mode and click on "Load Unpacked"
4. Upload the cloned repository folder and click on the reload button in the extension card in the "All Extensions" page.
5. Run the extension through extensions section in your browser (the puzzle icon right next to the URL bar)

## API used and their documentations

1. EyeDropper API:
   Purpose --> Color picking from screen
   Documentaion -->  https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper
   
2. Speech Synthesis API:
   Purpose --> Text-to-speech functionality
   Documentaion --> https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

3. MediaDevices API:
  Purpose --> Camera access for real-world vision
  Documentation --> https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices

4. Canvas API:
  Purpose --> Image processing and pixel manipulation
  Documentation --> https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

5. Chrome extension API's --> these are builtin chrome function which we can use for easier and better functionality.


