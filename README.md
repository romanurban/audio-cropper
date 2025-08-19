# Audio Cropper (Browser)

A minimal, client‑side audio editor that runs entirely in the browser. Load a file, visualize the waveform, select or split regions, apply simple effects, and export to WAV or MP3 — no server required.

## Quick Start

- Serve the folder over HTTP (ES modules require it):
  - `python -m http.server 8000` then open `http://localhost:8000`
- Drag & drop an audio file (WAV/MP3/OGG) or use the picker.
- Select a region, split into chunks, preview playback, and export.

## Features

- Waveform visualization with Canvas
- Region selection and chunk splitting
- Zero-crossing snap for clean edits (toggleable)
- Keyboard shortcuts (e.g., Space play/pause, Shift+Space play from selection)
- Playback controls with seek and loop
- Simple effects: fade in/out, silence, normalize
- Undo/Redo with toolbar buttons and Ctrl/Cmd shortcuts
- Export to WAV (16‑bit) or MP3 (128–320 kbps)
- Large‑file friendly: progress for reading/decoding and encoding
- All processing local to your device

## Tech

- Vanilla JavaScript + ES modules
- Web Audio API and HTML5 Canvas
- MP3 encoding in a Web Worker (lamejs via CDN)
- No build tools or external dependencies

## Notes

- Use a modern browser; open via HTTP/HTTPS (not `file://`).
- MP3 export loads the encoder in a worker from a CDN.
