/**
 * MP3 Encoder Web Worker
 * Handles MP3 encoding off the main thread to prevent UI blocking.
 *
 * Encoding logic lives in ../encoders/mp3-core.js (shared with the
 * main-thread fallback) – this worker just loads the dependencies and
 * wires up the message protocol.
 */

let ready = false;

// Global error handler
self.onerror = function(error) {
    postMessage({
        type: 'error',
        error: `Worker error: ${error.message || 'Unknown error'}`,
        success: false
    });
};

// Message handler
self.onmessage = async function(e) {
    const { type, id, ...data } = e.data;

    try {
        switch (type) {
            case 'init':
                await initEncoder();
                postMessage({ type: 'init-complete', id, success: true });
                break;

            case 'encode': {
                const result = await encodeAudio(data);
                postMessage({
                    type: 'encode-complete',
                    id,
                    success: true,
                    data: result,
                    transferable: [result.buffer]
                }, [result.buffer]);
                break;
            }

            case 'get-bitrates':
                postMessage({ type: 'bitrates', id, bitrates: [128, 192, 256, 320] });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        postMessage({
            type: 'error',
            id,
            error: error.message,
            success: false
        });
    }
};

/**
 * Load lamejs + shared encoding core via importScripts.
 */
async function initEncoder() {
    if (ready) return;

    try {
        self.importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
        if (!self.lamejs) {
            throw new Error('lamejs not available after import');
        }

        self.importScripts('../encoders/mp3-core.js');
        if (typeof self.encodeMp3 !== 'function') {
            throw new Error('mp3-core not available after import');
        }

        ready = true;
    } catch (error) {
        throw new Error(`Failed to load MP3 encoder: ${error.message}`);
    }
}

/**
 * Encode audio data to MP3 using the shared core.
 */
async function encodeAudio({ channels, sampleRate, bitrate }) {
    if (!ready) {
        throw new Error('Encoder not initialized');
    }

    postMessage({ type: 'progress', progress: 0 });

    const result = self.encodeMp3(channels, sampleRate, bitrate, (progress) => {
        postMessage({ type: 'progress', progress });
    });

    postMessage({ type: 'progress', progress: 100 });

    return result;
}
