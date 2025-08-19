/**
 * MP3 Encoder using lamejs library
 * Provides MP3 encoding functionality for the audio editor
 */

export class Mp3Encoder {
    constructor() {
        this.lame = null;
        this.initialized = false;
    }

    /**
     * Initialize the MP3 encoder
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        try {
            // Load lamejs from CDN
            await this.loadLameJs();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize MP3 encoder:', error);
            throw new Error('MP3 encoder initialization failed');
        }
    }

    /**
     * Load lamejs library dynamically
     * @returns {Promise<void>}
     */
    async loadLameJs() {
        return new Promise((resolve, reject) => {
            if (window.lamejs) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
            script.onload = () => {
                if (window.lamejs) {
                    resolve();
                } else {
                    reject(new Error('lamejs library not loaded'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load lamejs library'));
            document.head.appendChild(script);
        });
    }

    /**
     * Encode Float32 audio data to MP3
     * @param {Float32Array[]} channels - Array of channel data (mono: 1 channel, stereo: 2 channels)
     * @param {number} sampleRate - Sample rate of the audio
     * @param {number} bitrate - MP3 bitrate in kbps (128, 192, 256, 320)
     * @returns {Promise<Uint8Array>} MP3 encoded data
     */
    async encode(channels, sampleRate, bitrate = 192) {
        if (!this.initialized) {
            await this.init();
        }

        const numChannels = channels.length;
        const numSamples = channels[0].length;
        
        // Create LAME encoder
        const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        const mp3Data = [];

        // Convert Float32 to Int16 for LAME
        const left = new Int16Array(numSamples);
        const right = numChannels > 1 ? new Int16Array(numSamples) : null;

        // Convert and scale from float32 [-1,1] to int16 [-32768,32767]
        for (let i = 0; i < numSamples; i++) {
            left[i] = Math.max(-32768, Math.min(32767, channels[0][i] * 32767));
            if (right) {
                right[i] = Math.max(-32768, Math.min(32767, channels[1][i] * 32767));
            }
        }

        // Encode in chunks to avoid blocking
        const chunkSize = 1152; // LAME frame size
        let offset = 0;

        while (offset < numSamples) {
            const chunkLeft = left.subarray(offset, Math.min(offset + chunkSize, numSamples));
            const chunkRight = right ? right.subarray(offset, Math.min(offset + chunkSize, numSamples)) : null;
            
            let mp3buf;
            if (numChannels === 1) {
                mp3buf = mp3encoder.encodeBuffer(chunkLeft);
            } else {
                mp3buf = mp3encoder.encodeBuffer(chunkLeft, chunkRight);
            }
            
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
            
            offset += chunkSize;
            
            // Yield control to prevent blocking
            if (offset % (chunkSize * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Flush remaining data
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        // Combine all chunks
        const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset_write = 0;
        
        for (const chunk of mp3Data) {
            result.set(chunk, offset_write);
            offset_write += chunk.length;
        }

        return result;
    }

    /**
     * Get supported bitrates
     * @returns {number[]} Array of supported bitrates in kbps
     */
    getSupportedBitrates() {
        return [128, 192, 256, 320];
    }

    /**
     * Check if the encoder is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }
}