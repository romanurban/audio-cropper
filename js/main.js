/**
 * Application entry point
 */

import { AudioChunkingEditor } from './audio-cropper.js';

let audioEditor;

// Initialize the audio chunking editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    audioEditor = new AudioChunkingEditor();
});

// Global function to load sample file (accessible from HTML)
window.loadSampleFile = () => {
    if (audioEditor) {
        audioEditor.loadSampleFile();
    }
};