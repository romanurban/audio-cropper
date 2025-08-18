# Audio Cropper (Browser)

A minimal, client‑side audio editor that runs entirely in the browser. It lets you load a file, visualize the waveform, select or split regions into chunks, apply simple effects, and export WAV—no server required.

## Quick Start

- Serve the folder over HTTP (ES modules require it):
  - `python -m http.server 8000` then open `http://localhost:8000`
- Drag & drop an audio file (WAV/MP3/OGG) or use the picker.
- Select a region, split into chunks, preview playback, and export.

## Features

- Waveform visualization with Canvas
- Region selection and chunk splitting
- Playback controls with seek and loop
- Simple effects: fade in/out, silence, normalize
- Export selection, chunk, or full audio as 16‑bit WAV
- All processing local to your device

## Tech

- Vanilla JavaScript + ES modules
- Web Audio API and HTML5 Canvas
- No build tools or external dependencies

## Notes

- Use a modern browser; open via HTTP/HTTPS (not `file://`).
