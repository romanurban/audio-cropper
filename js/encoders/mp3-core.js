/**
 * Core MP3 encoding logic shared between Web Worker and main-thread fallback.
 *
 * This is a plain script (not an ES module) so it can be loaded via
 * importScripts() inside a Web Worker AND via a <script> tag on the main
 * thread.  It attaches a single helper – encodeMp3 – to the global scope
 * (self / window).
 *
 * Prerequisites: lamejs must already be loaded on `self.lamejs` before
 * calling encodeMp3().
 */

(function (global) {
    /**
     * Encode Float32 audio channels to MP3 using lamejs.
     *
     * @param {Float32Array[]} channels  – array of channel data (1 = mono, 2 = stereo)
     * @param {number}         sampleRate
     * @param {number}         bitrate   – kbps (128 | 192 | 256 | 320)
     * @param {function}       [onProgress] – optional (progress: 0‑100) => void
     * @returns {Uint8Array} MP3 encoded data
     */
    global.encodeMp3 = function encodeMp3(channels, sampleRate, bitrate, onProgress) {
        if (!global.lamejs) {
            throw new Error('lamejs is not loaded');
        }

        var numChannels = channels.length;
        var numSamples  = channels[0].length;

        var mp3encoder = new global.lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        var mp3Data    = [];

        // Convert Float32 [-1,1] → Int16 [-32768,32767]
        var left  = new Int16Array(numSamples);
        var right = numChannels > 1 ? new Int16Array(numSamples) : null;

        for (var i = 0; i < numSamples; i++) {
            left[i] = Math.max(-32768, Math.min(32767, channels[0][i] * 32767));
            if (right) {
                right[i] = Math.max(-32768, Math.min(32767, channels[1][i] * 32767));
            }
        }

        // Encode in LAME-standard 1152-sample frames
        var chunkSize = 1152;
        var offset    = 0;

        while (offset < numSamples) {
            var end        = Math.min(offset + chunkSize, numSamples);
            var chunkLeft  = left.subarray(offset, end);
            var chunkRight = right ? right.subarray(offset, end) : null;

            var mp3buf;
            if (numChannels === 1) {
                mp3buf = mp3encoder.encodeBuffer(chunkLeft);
            } else {
                mp3buf = mp3encoder.encodeBuffer(chunkLeft, chunkRight);
            }

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            offset += chunkSize;

            if (onProgress && offset % (chunkSize * 10) === 0) {
                onProgress(Math.min(100, Math.round((offset / numSamples) * 100)));
            }
        }

        // Flush remaining data
        var flush = mp3encoder.flush();
        if (flush.length > 0) {
            mp3Data.push(flush);
        }

        // Combine all chunks into a single Uint8Array
        var totalLength  = mp3Data.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
        var result       = new Uint8Array(totalLength);
        var writeOffset  = 0;

        for (var j = 0; j < mp3Data.length; j++) {
            result.set(mp3Data[j], writeOffset);
            writeOffset += mp3Data[j].length;
        }

        return result;
    };
})(typeof self !== 'undefined' ? self : this);
