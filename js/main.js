/**
 * Application entry point
 */

import { AudioChunkingEditor } from './audio-cropper.js';

// Initialize the audio chunking editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AudioChunkingEditor();
});