/**
 * MP3 Encoder – main-thread fallback
 *
 * Used only when the Web Worker path is unavailable (e.g. iOS Safari
 * blocking importScripts from a CDN).  The actual encoding algorithm
 * lives in mp3-core.js to avoid duplication with the worker.
 */

export class Mp3Encoder {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize: load lamejs + shared encoding core onto the page.
     */
    async init() {
        if (this.initialized) return;

        await this._loadScript(
            'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
            () => !!window.lamejs,
            'lamejs'
        );

        await this._loadScript(
            // Resolve relative to the current module location
            new URL('./mp3-core.js', import.meta.url).href,
            () => typeof window.encodeMp3 === 'function',
            'mp3-core'
        );

        this.initialized = true;
    }

    /**
     * Encode Float32 audio data to MP3.
     *
     * @param {Float32Array[]} channels
     * @param {number} sampleRate
     * @param {number} bitrate – kbps (128 | 192 | 256 | 320)
     * @returns {Promise<Uint8Array>}
     */
    async encode(channels, sampleRate, bitrate = 192) {
        if (!this.initialized) {
            await this.init();
        }

        // Delegate to the shared encoding function.
        // Wrap in a micro-task so the caller can treat it as async.
        return window.encodeMp3(channels, sampleRate, bitrate);
    }

    /** Supported bitrates. */
    getSupportedBitrates() {
        return [128, 192, 256, 320];
    }

    isInitialized() {
        return this.initialized;
    }

    // ---- internal helpers ------------------------------------------------

    /**
     * Dynamically load a <script> tag and wait for the expected global.
     */
    _loadScript(src, checkFn, label) {
        return new Promise((resolve, reject) => {
            if (checkFn()) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                if (checkFn()) {
                    resolve();
                } else {
                    reject(new Error(`${label} library not available after load`));
                }
            };
            script.onerror = () => reject(new Error(`Failed to load ${label} library`));
            document.head.appendChild(script);
        });
    }
}
