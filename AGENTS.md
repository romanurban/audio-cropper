# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side audio cropping tool that runs entirely in the browser using vanilla JavaScript and the Web Audio API. The application allows users to upload audio files, visualize them as waveforms, select regions, split audio into chunks, apply audio effects (fade in/out, silence, normalize), and export trimmed segments as WAV or MP3 files.

## Architecture

### Modular Structure
- **index.html**: Clean HTML structure with external CSS and JS references
- **styles.css**: All application styling and UI components
- **js/**: Modular JavaScript files organized by functionality
- **No build system**: The application runs directly in the browser using ES6 modules
- **Core deps**: No build system; core uses browser APIs only. MP3 export loads lamejs in a Web Worker via CDN.

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
- Audio processing effects (normalize with RMS-based algorithm)
- File download helpers

**js/main.js** - Application entry point
- Initializes the AudioChunkingEditor when DOM is ready
- Exposes global functions for HTML onclick handlers (sample file loading)

**Key Features:**
- Drag & drop file upload with visual feedback and sample file loading
- Waveform visualization using HTML5 Canvas
- Audio chunking system that allows splitting at any position
- Region selection for cropping specific segments
- Audio effects: fade in/out, silence, and RMS-based normalize to target dB level
- Playback controls with seek functionality and loop mode
- Multi-format export: WAV (uncompressed) and MP3 (128/192/256/320 kbps)
- Web Worker-based MP3 encoding to prevent UI blocking
- Visual chunk overlays and selection indicators
- Resizable selection handles for precise region adjustment
- Comprehensive keyboard shortcuts for efficient editing

### Audio Processing Pipeline

1. **File Loading**: Uses FileReader API or fetch for sample files to convert to ArrayBuffer
2. **Audio Decoding**: Web Audio API's `decodeAudioData()` processes the buffer
3. **Waveform Generation**: Samples audio data into 1000 points for visualization
4. **Canvas Rendering**: Draws waveform with proportional chunk representation
5. **Audio Effects**: Real-time processing (fade, silence, RMS-based normalize)
6. **Playback**: Creates buffer sources for real-time audio playback
7. **Export**: WAV encoding with proper headers and PCM data, or MP3 encoding via Web Worker

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
- Test manually by uploading various audio formats (WAV, MP3, OGG) or using the sample file
- Verify waveform rendering, playback, chunk operations, audio effects, and export functionality
- Sample file available: `samples/stereo-test.mp3` for quick testing

### Key Technical Constraints
- Requires modern browser with Web Audio API and ES6 module support
- Must be served over HTTP/HTTPS (not file://) for module imports
- Audio processing happens entirely in memory (limited by browser memory)
- Export formats: WAV (16-bit PCM) and MP3 (128/192/256/320 kbps via lamejs in worker)
- No server-side components; optional CDN load for MP3 encoder

## Code Organization

### Module Responsibilities

**AudioChunkingEditor (audio-cropper.js)**
- Main controller coordinating all components
- Event handling and user interactions
- File upload, sample file loading, and audio buffer management
- Audio effects processing (fade in/out, silence, normalize)
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
- Time formatting utilities (standard and millisecond precision)
- WAV file format conversion with proper headers
- Audio normalization with RMS analysis and target dB level
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
│   ├── utils.js        # Utility functions
│   ├── encoders/
│   │   └── mp3.js      # MP3 encoder wrapper
│   └── workers/
│       └── mp3-encoder-worker.js # MP3 encoding Web Worker
├── samples/
│   └── stereo-test.mp3 # Sample audio file for testing
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

## Audio Effects Implementation

### Normalize Effect
- Uses RMS (Root Mean Square) analysis for professional audio normalization
- Default target level: -3dB (configurable)
- Analyzes both RMS and peak levels to prevent clipping
- Applies safety limits (max 20dB gain) to prevent extreme amplification
- Works on selected regions or chunks, boosting quiet sections to consistent levels

### Fade Effects
- Smooth cosine interpolation curves for natural-sounding fades
- Applies to selection regions or selected chunks
- Fade in: 0% to 100% volume over the selected duration
- Fade out: 100% to 0% volume over the selected duration

### Silence Effect
- Complete audio muting for selected regions or chunks
- Preserves audio buffer structure while setting samples to zero
- Useful for removing unwanted sections or creating gaps

## User Interface Features

### File Loading
- Drag & drop support with visual feedback
- File browser with audio format filtering
- Sample file loading via "load sample file" link
- Supports WAV, MP3, OGG formats

### Selection System
- Click-and-drag region selection with visual feedback
- Resizable selection handles for precise adjustment
- Chunk-based selection for pre-split audio segments
- Clear selection functionality

### Audio Controls
- Play/pause with single button interface
- Stop and loop mode toggles
- Seek by clicking on waveform
- Split functionality at current position
- Multi-format export: WAV (uncompressed) or MP3 (compressed)
- MP3 quality selection: 128, 192, 256, or 320 kbps
- Progress indicator during export operations

## Keyboard Shortcuts (highlights)

- Space: Toggle play/pause; Shift+Space: play from selection start
- Ctrl/Cmd+L: Toggle loop; Ctrl/Cmd+S: Split; Ctrl/Cmd+E: Export
- Arrow Left/Right: Seek 1s (Shift: 5s); 0–9: Jump by 10% increments
- Ctrl/Cmd+F / Ctrl/Cmd+Shift+F: Fade in/out; Ctrl/Cmd+N: Normalize; Ctrl/Cmd+M: Silence
- Escape: Stop and clear selection; H or ?: Show shortcuts

## Large File Handling

- File read progress with size and speed estimate; extra feedback for files >10MB
- Decoding progress indicator (simulated) and waveform loading overlay to keep UI responsive
- MP3 encoding runs in a Web Worker to avoid blocking the main thread

## MP3 Export Implementation

### Architecture
- **lamejs Library**: Uses lamejs (JavaScript port of LAME) for MP3 encoding
- **Web Worker**: MP3 encoding runs in a separate thread to prevent UI blocking
- **Progressive Encoding**: Processes audio in chunks with progress reporting
- **Memory Efficient**: Streams encoded data to avoid large peak memory usage

### Technical Details
- **Input Format**: Float32Array per channel (native Web Audio format)
- **Chunked Processing**: 1152-sample frames (LAME standard frame size)
- **Bitrate Support**: 128, 192, 256, 320 kbps (constant bitrate)
- **Sample Rate**: Preserves original sample rate (no resampling)
- **Stereo/Mono**: Automatically handles mono and stereo audio

### Performance Characteristics
- **Non-blocking**: UI remains responsive during encoding
- **Progress Reporting**: Real-time progress updates during encoding
- **Lazy Loading**: MP3 encoder only loads when first needed
- **Memory Management**: Efficient handling of large audio files
- **Error Handling**: Comprehensive error reporting and recovery

### Quality Settings
- **128 kbps**: Smaller file size, good for speech
- **192 kbps**: Balanced quality/size, recommended default
- **256 kbps**: High quality, good for music
- **320 kbps**: Maximum quality, largest file size

