/**
 * Handles waveform visualization and canvas rendering
 */

export class WaveformRenderer {
    constructor(canvas, chunks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.chunks = chunks;
        this.waveformData = null;
        this.audioBuffer = null;
    }

    /**
     * Generates waveform data from audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to analyze
     */
    generateWaveform(audioBuffer) {
        this.audioBuffer = audioBuffer;
        const channelData = audioBuffer.getChannelData(0);
        const samples = Math.floor(channelData.length / 1000);
        this.waveformData = [];
        
        for (let i = 0; i < 1000; i++) {
            const start = Math.floor(i * samples);
            const end = Math.floor((i + 1) * samples);
            let max = 0;
            
            for (let j = start; j < end; j++) {
                const sample = Math.abs(channelData[j]);
                if (sample > max) max = sample;
            }
            
            this.waveformData.push(max);
        }
        
        // Force canvas resize and redraw
        this.resizeCanvas();
        
        // Use another requestAnimationFrame to ensure canvas is properly sized
        requestAnimationFrame(() => {
            this.drawWaveform(this.audioBuffer);
        });
    }

    /**
     * Resizes canvas to match container
     */
    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        if (rect.width <= 0 || rect.height <= 0) {
            setTimeout(() => this.resizeCanvas(), 10);
            return;
        }
        
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        console.log('Canvas resized to:', rect.width, 'x', rect.height);
        
        if (this.waveformData && this.audioBuffer) {
            this.drawWaveform(this.audioBuffer);
        }
    }

    /**
     * Draws the complete waveform with chunks
     * @param {AudioBuffer} audioBuffer - The audio buffer for duration reference
     * @param {number} seekPosition - Current seek position
     * @param {number} playbackTime - Current playback time
     */
    drawWaveform(audioBuffer, seekPosition = 0, playbackTime = 0) {
        if (!this.waveformData || !this.canvas || this.canvas.width <= 0 || this.canvas.height <= 0) {
            console.warn('Cannot draw waveform - invalid state');
            return;
        }
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Calculate total duration of all chunks for proportional rendering
        const totalChunkDuration = this.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4; // pixels between chunks
        const totalGaps = Math.max(0, this.chunks.length - 1) * gapWidth;
        const availableWidth = width - totalGaps;
        
        let currentX = 0;
        
        // Draw each chunk separately with gaps
        this.chunks.forEach((chunk, chunkIndex) => {
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            // Calculate which part of the original waveform this chunk represents
            const chunkStartRatio = chunk.start / audioBuffer.duration;
            const chunkEndRatio = chunk.end / audioBuffer.duration;
            const startSample = Math.floor(chunkStartRatio * this.waveformData.length);
            const endSample = Math.ceil(chunkEndRatio * this.waveformData.length);
            const chunkSamples = endSample - startSample;
            
            if (chunkSamples > 0) {
                const barWidth = chunkWidth / chunkSamples;
                
                // Draw this chunk's waveform
                for (let i = 0; i < chunkSamples; i++) {
                    const sampleIndex = startSample + i;
                    if (sampleIndex < this.waveformData.length) {
                        this.ctx.fillStyle = '#4CAF50';
                        
                        const barHeight = this.waveformData[sampleIndex] * height * 0.8;
                        const x = currentX + (i * barWidth);
                        const y = (height - barHeight) / 2;
                        
                        // Ensure minimum bar height for visibility
                        const minHeight = Math.max(2, barHeight);
                        const actualBarWidth = Math.max(1, barWidth - 0.5);
                        
                        this.ctx.fillRect(x, y, actualBarWidth, minHeight);
                    }
                }
            }
            
            // Move to next chunk position (add gap)
            currentX += chunkWidth + gapWidth;
        });
        
        // Draw playback progress line
        this.drawProgressLine(playbackTime, audioBuffer);
        
        // Draw seek position line
        this.drawSeekLine(seekPosition, audioBuffer);
        
        console.log('Waveform drawn successfully');
    }

    /**
     * Draws the playback progress line
     * @param {number} currentTime - Current playback time
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    drawProgressLine(currentTime, audioBuffer) {
        if (!audioBuffer) return;
        
        // Find which chunk contains the current time
        const currentChunk = this.chunks.find(chunk => 
            currentTime >= chunk.start && currentTime <= chunk.end
        );
        
        if (!currentChunk) return;
        
        const progressX = this.getPixelPositionForTime(currentTime);
        
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(progressX, 0);
        this.ctx.lineTo(progressX, this.canvas.height);
        this.ctx.stroke();
    }

    /**
     * Draws the seek position line
     * @param {number} seekPosition - Seek position time
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    drawSeekLine(seekPosition, audioBuffer) {
        if (!audioBuffer) return;
        
        // Find which chunk contains the seek position
        const seekChunk = this.chunks.find(chunk => 
            seekPosition >= chunk.start && seekPosition <= chunk.end
        );
        
        if (!seekChunk) return;
        
        const seekX = this.getPixelPositionForTime(seekPosition);
        
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(seekX, 0);
        this.ctx.lineTo(seekX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset line dash
    }

    /**
     * Converts time to pixel position within the chunk layout
     * @param {number} time - Time in seconds
     * @returns {number} Pixel position
     */
    getPixelPositionForTime(time) {
        const totalChunkDuration = this.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4;
        const totalGaps = Math.max(0, this.chunks.length - 1) * gapWidth;
        const availableWidth = this.canvas.width - totalGaps;
        
        let currentX = 0;
        
        for (const chunk of this.chunks) {
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            if (time >= chunk.start && time <= chunk.end) {
                const timeInChunk = time - chunk.start;
                const progressInChunk = timeInChunk / chunkDuration;
                return currentX + (progressInChunk * chunkWidth);
            }
            
            currentX += chunkWidth + gapWidth;
        }
        
        return 0;
    }

    /**
     * Converts pixel position to time within the chunk layout
     * @param {number} pixelX - Pixel position
     * @returns {number} Time in seconds
     */
    getTimeFromPixelPosition(pixelX) {
        const totalChunkDuration = this.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4;
        const totalGaps = Math.max(0, this.chunks.length - 1) * gapWidth;
        const availableWidth = this.canvas.width - totalGaps;
        
        let currentX = 0;
        
        for (const chunk of this.chunks) {
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            if (pixelX >= currentX && pixelX <= currentX + chunkWidth) {
                const pixelInChunk = pixelX - currentX;
                const progressInChunk = pixelInChunk / chunkWidth;
                return chunk.start + (progressInChunk * chunkDuration);
            }
            
            currentX += chunkWidth + gapWidth;
        }
        
        return this.chunks.length > 0 ? this.chunks[0].start : 0;
    }
}