# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side audio cropping tool that runs entirely in the browser using vanilla JavaScript and the Web Audio API. The application allows users to upload audio files, visualize them as waveforms, select regions, split audio into chunks, and export trimmed segments as WAV files.

## Architecture

### Modular Structure
- **index.html**: Clean HTML structure with external CSS and JS references
- **styles.css**: All application styling and UI components
- **js/**: Modular JavaScript files organized by functionality
- **No build system**: The application runs directly in the browser using ES6 modules
- **No dependencies**: Uses only browser APIs (Web Audio API, Canvas API, File API)

### Core Components

**js/audio-cropper.js** - Main AudioChunkingEditor class
- Coordinates all components and manages application state
- Handles file upload, user interactions, and UI updates

**js/waveform-renderer.js** - WaveformRenderer class  
- Manages canvas-based waveform visualization
- Handles drawing, resizing, and pixel-to-time conversions

**js/chunk-manager.js** - ChunkManager class
- Manages audio chunks (creation, selection, deletion, overlays)
- Handles chunk splitting and time range operations

**js/audio-player.js** - AudioPlayer class
- Handles all audio playback functionality
- Supports selection playback, chunk playback, and sequential playback

**js/utils.js** - AudioUtils class
- Utility functions for time formatting and WAV conversion
- File download helpers

**js/main.js** - Application entry point
- Initializes the AudioChunkingEditor when DOM is ready

**Key Features:**
- Drag & drop file upload with visual feedback
- Waveform visualization using HTML5 Canvas
- Audio chunking system that allows splitting at any position
- Region selection for cropping specific segments
- Playback controls with seek functionality
- WAV export using manual buffer-to-WAV conversion
- Visual chunk overlays and selection indicators

### Audio Processing Pipeline

1. **File Loading**: Uses FileReader API to convert uploaded files to ArrayBuffer
2. **Audio Decoding**: Web Audio API's `decodeAudioData()` processes the buffer
3. **Waveform Generation**: Samples audio data into 1000 points for visualization
4. **Canvas Rendering**: Draws waveform with proportional chunk representation
5. **Playback**: Creates buffer sources for real-time audio playback
6. **Export**: Manual WAV encoding with proper headers and PCM data

### State Management

The application manages several key state objects:
- `audioBuffer`: Decoded audio data
- `chunks`: Array of audio segments with start/end times and IDs
- `selection`: Current user selection for cropping
- `selectedChunk`: Currently selected chunk for operations
- `seekPosition`: Current playback/seek position

## Development Workflow

### Running the Application
```bash
# No build process needed - serve locally for ES6 modules
python -m http.server 8000  # Then visit http://localhost:8000
# Or use any local server (Live Server, etc.)
```

**Important**: Due to ES6 modules, the application must be served over HTTP/HTTPS. Opening index.html directly in browser will cause CORS errors.

### Testing
- No automated test suite exists
- Test manually by uploading various audio formats (WAV, MP3, OGG)
- Verify waveform rendering, playback, chunk operations, and export functionality

### Key Technical Constraints
- Requires modern browser with Web Audio API and ES6 module support
- Must be served over HTTP/HTTPS (not file://) for module imports
- Audio processing happens entirely in memory (limited by browser memory)
- Export format is fixed to 16-bit WAV
- No server-side components or external dependencies

## Code Organization

### Module Responsibilities

**AudioChunkingEditor (audio-cropper.js)**
- Main controller coordinating all components
- Event handling and user interactions
- File upload and audio buffer management
- UI state management and updates

**WaveformRenderer (waveform-renderer.js)**
- Canvas management and waveform drawing
- Pixel/time coordinate conversions
- Progress line and seek line rendering
- Canvas resizing and responsive behavior

**ChunkManager (chunk-manager.js)**
- Chunk data structure management
- Chunk splitting, selection, and deletion
- Visual overlay management
- Time range operations

**AudioPlayer (audio-player.js)**
- Audio playback state management  
- Selection, chunk, and sequential playback modes
- Audio buffer creation for different playback types
- Playback timing and position tracking

**AudioUtils (utils.js)**
- Time formatting utilities
- WAV file format conversion
- File download helpers
- Shared utility functions

## Browser Compatibility

Requires browsers that support:
- Web Audio API
- HTML5 Canvas
- File API with drag & drop
- ES6+ JavaScript features (modules, arrow functions, const/let, template literals)

Modern versions of Chrome, Firefox, Safari, and Edge are supported.

## File Structure

```
audio-cropper/
├── index.html          # Main HTML structure
├── styles.css          # Application styling
├── js/
│   ├── main.js         # Application entry point
│   ├── audio-cropper.js # Main controller class
│   ├── waveform-renderer.js # Canvas visualization
│   ├── chunk-manager.js     # Chunk management
│   ├── audio-player.js      # Audio playback
│   └── utils.js        # Utility functions
├── CLAUDE.md           # This documentation
└── README.md           # Project description
```

## Development Notes

- All modules use ES6 class syntax and imports/exports
- No transpilation or bundling required
- Code is organized by functional responsibility 
- Each class has a single, well-defined purpose
- Shared utilities are centralized in utils.js
- Main application coordinates all components through dependency injection