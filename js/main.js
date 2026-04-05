/**
 * Application entry point
 */

import { AudioChunkingEditor } from './audio-cropper.js';
import { toast } from './toast.js';

let audioEditor;

// Global error handlers to catch unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    toast('An unexpected error occurred. Please try again.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    toast('An unexpected error occurred. Please try again.', 'error');
    event.preventDefault();
});

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