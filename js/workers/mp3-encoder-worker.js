/**
 * MP3 Encoder Web Worker
 * Handles MP3 encoding off the main thread to prevent UI blocking
 */

// Import the MP3 encoder (note: we'll need to handle ES modules in worker)
let Mp3Encoder;

// Track encoder instance
let encoder = null;

// Message handler
self.onmessage = async function(e) {
    const { type, id, ...data } = e.data;

    try {
        switch (type) {
            case 'init':
                await initEncoder();
                postMessage({ type: 'init-complete', id, success: true });
                break;

            case 'encode':
                const result = await encodeAudio(data);
                postMessage({ 
                    type: 'encode-complete', 
                    id, 
                    success: true, 
                    data: result,
                    transferable: [result.buffer]
                }, [result.buffer]);
                break;

            case 'get-bitrates':
                const bitrates = encoder ? encoder.getSupportedBitrates() : [128, 192, 256, 320];
                postMessage({ type: 'bitrates', id, bitrates });
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
 * Initialize the MP3 encoder
 */
async function initEncoder() {
    if (encoder) return;

    // Load lamejs library in worker
    try {
        // Import lamejs via script tag in worker
        self.importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
        
        if (!self.lamejs) {
            throw new Error('lamejs not available after import');
        }
        
        // Create a simple encoder wrapper for the worker
        encoder = {
            encode: async function(channels, sampleRate, bitrate = 192) {
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

                // Encode in chunks
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

                    // Report progress every 10 chunks
                    if (offset % (chunkSize * 10) === 0) {
                        const progress = Math.min(100, (offset / numSamples) * 100);
                        postMessage({ 
                            type: 'progress', 
                            progress: Math.round(progress)
                        });
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
            },
            
            getSupportedBitrates: function() {
                return [128, 192, 256, 320];
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to load MP3 encoder: ${error.message}`);
    }
}

/**
 * Encode audio data to MP3
 */
async function encodeAudio({ channels, sampleRate, bitrate }) {
    if (!encoder) {
        throw new Error('Encoder not initialized');
    }

    // Post initial progress
    postMessage({ type: 'progress', progress: 0 });

    const result = await encoder.encode(channels, sampleRate, bitrate);
    
    // Post completion progress
    postMessage({ type: 'progress', progress: 100 });
    
    return result;
}