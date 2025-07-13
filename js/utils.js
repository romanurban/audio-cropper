/**
 * Utility functions for audio processing and time formatting
 */

export class AudioUtils {
    /**
     * Formats time in seconds to MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Converts an AudioBuffer to WAV format
     * @param {AudioBuffer} buffer - The audio buffer to convert
     * @returns {ArrayBuffer} WAV file data
     */
    static audioBufferToWav(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numberOfChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const fileSize = 44 + dataSize;
        
        const arrayBuffer = new ArrayBuffer(fileSize);
        const view = new DataView(arrayBuffer);
        
        // Helper function to write string to DataView
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // Write WAV header
        writeString(0, 'RIFF');                          // ChunkID
        view.setUint32(4, fileSize - 8, true);          // ChunkSize
        writeString(8, 'WAVE');                          // Format
        writeString(12, 'fmt ');                         // Subchunk1ID
        view.setUint32(16, 16, true);                   // Subchunk1Size (PCM)
        view.setUint16(20, 1, true);                    // AudioFormat (PCM)
        view.setUint16(22, numberOfChannels, true);     // NumChannels
        view.setUint32(24, sampleRate, true);           // SampleRate
        view.setUint32(28, byteRate, true);             // ByteRate
        view.setUint16(32, blockAlign, true);           // BlockAlign
        view.setUint16(34, bitsPerSample, true);        // BitsPerSample
        writeString(36, 'data');                         // Subchunk2ID
        view.setUint32(40, dataSize, true);             // Subchunk2Size
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                const int16Sample = Math.round(sample * 32767);
                view.setInt16(offset, int16Sample, true);
                offset += 2;
            }
        }
        
        return arrayBuffer;
    }

    /**
     * Downloads a blob as a file
     * @param {Blob} blob - The blob to download
     * @param {string} filename - The filename for the download
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}