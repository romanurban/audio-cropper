/**
 * Manages audio chunks - creation, selection, deletion, and overlays
 */

export class ChunkManager {
    constructor(waveformElement) {
        this.waveform = waveformElement;
        this.chunks = [{ start: 0, end: 0, id: 0 }];
        this.selectedChunk = null;
        this.chunkOverlays = [];
        this.nextChunkId = 1;
    }

    /**
     * Initializes chunks for a new audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer
     */
    initializeChunks(audioBuffer) {
        this.chunks = [{ start: 0, end: audioBuffer.duration, id: 0 }];
        this.selectedChunk = null;
        this.nextChunkId = 1;
        this.updateChunkOverlays();
    }

    /**
     * Splits a chunk at the specified position
     * @param {number} splitTime - Time position to split at
     * @returns {boolean} True if split was successful
     */
    splitAtPosition(splitTime) {
        // Find the chunk that contains the split position
        const chunkIndex = this.chunks.findIndex(chunk => 
            splitTime > chunk.start && splitTime < chunk.end
        );
        
        if (chunkIndex === -1) {
            return false;
        }
        
        const originalChunk = this.chunks[chunkIndex];
        
        // Create two new chunks
        const leftChunk = {
            start: originalChunk.start,
            end: splitTime,
            id: this.nextChunkId++
        };
        
        const rightChunk = {
            start: splitTime,
            end: originalChunk.end,
            id: this.nextChunkId++
        };
        
        // Replace the original chunk with the two new chunks
        this.chunks.splice(chunkIndex, 1, leftChunk, rightChunk);
        
        // Deselect any selected chunk
        this.selectedChunk = null;
        this.updateChunkOverlays();
        
        return true;
    }

    /**
     * Selects a chunk at the given pixel position
     * @param {number} pixelX - X pixel position
     * @param {number} containerWidth - Width of the waveform container
     * @returns {object|null} Selected chunk or null
     */
    selectChunkAtPosition(pixelX, containerWidth) {
        if (this.chunks.length <= 1) {
            return null;
        }
        
        const totalChunkDuration = this.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4;
        const totalGaps = Math.max(0, this.chunks.length - 1) * gapWidth;
        const availableWidth = containerWidth - totalGaps;
        
        let currentX = 0;
        
        for (const chunk of this.chunks) {
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            if (pixelX >= currentX && pixelX <= currentX + chunkWidth) {
                this.selectedChunk = chunk;
                this.updateChunkOverlays();
                return chunk;
            }
            
            currentX += chunkWidth + gapWidth;
        }
        
        return null;
    }

    /**
     * Updates visual overlays for chunks
     */
    updateChunkOverlays() {
        // Clear existing overlays
        this.chunkOverlays.forEach(overlay => overlay.remove());
        this.chunkOverlays = [];
        
        // Only create overlays if there's more than one chunk
        if (this.chunks.length <= 1) {
            return;
        }
        
        const totalChunkDuration = this.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4;
        const totalGaps = Math.max(0, this.chunks.length - 1) * gapWidth;
        const waveformWidth = this.waveform.getBoundingClientRect().width;
        const availableWidth = waveformWidth - totalGaps;
        
        let currentX = 0;
        
        this.chunks.forEach(chunk => {
            const overlay = document.createElement('div');
            overlay.className = 'chunk-overlay';
            
            if (this.selectedChunk && chunk.id === this.selectedChunk.id) {
                overlay.classList.add('selected');
            }
            
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidthPixels = availableWidth * chunkWidthRatio;
            
            overlay.style.left = (currentX / waveformWidth * 100) + '%';
            overlay.style.width = (chunkWidthPixels / waveformWidth * 100) + '%';
            
            // Add hover effect
            overlay.addEventListener('mouseenter', () => {
                if (!overlay.classList.contains('selected')) {
                    overlay.classList.add('hovered');
                }
            });
            
            overlay.addEventListener('mouseleave', () => {
                overlay.classList.remove('hovered');
            });
            
            this.waveform.appendChild(overlay);
            this.chunkOverlays.push(overlay);
            
            currentX += chunkWidthPixels + gapWidth;
        });
    }

    /**
     * Removes chunks within a time range and adjusts remaining chunks
     * @param {number} startTime - Start of deletion range
     * @param {number} endTime - End of deletion range
     */
    deleteTimeRange(startTime, endTime) {
        const deleteDuration = endTime - startTime;
        
        this.chunks = this.chunks.map(chunk => {
            if (chunk.start >= endTime) {
                // Chunk is entirely after deleted range
                return {
                    ...chunk,
                    start: chunk.start - deleteDuration,
                    end: chunk.end - deleteDuration
                };
            } else if (chunk.end <= startTime) {
                // Chunk is entirely before deleted range
                return chunk;
            } else if (chunk.start >= startTime && chunk.end <= endTime) {
                // Chunk is entirely within deleted range - mark for removal
                return null;
            } else if (chunk.start < startTime && chunk.end > endTime) {
                // Deletion is within this chunk
                return {
                    ...chunk,
                    end: chunk.end - deleteDuration
                };
            } else if (chunk.start < startTime && chunk.end > startTime) {
                // Chunk partially overlaps start of deletion
                return {
                    ...chunk,
                    end: startTime
                };
            } else if (chunk.start < endTime && chunk.end > endTime) {
                // Chunk partially overlaps end of deletion
                return {
                    ...chunk,
                    start: startTime,
                    end: chunk.end - deleteDuration
                };
            }
            return chunk;
        }).filter(chunk => chunk !== null);

        // Clear selection if selected chunk was deleted
        if (this.selectedChunk && !this.chunks.find(c => c.id === this.selectedChunk.id)) {
            this.selectedChunk = null;
        }

        this.updateChunkOverlays();
    }

    /**
     * Gets chunk information for display
     * @returns {object} Chunk information
     */
    getChunkInfo() {
        return {
            count: this.chunks.length,
            selected: this.selectedChunk,
            chunks: [...this.chunks]
        };
    }

    /**
     * Creates a combined audio buffer from multiple chunks
     * @param {AudioContext} audioContext - Web Audio context
     * @param {AudioBuffer} originalBuffer - Original audio buffer
     * @param {Array} chunksToInclude - Chunks to include (default: all chunks)
     * @returns {AudioBuffer} Combined audio buffer
     */
    createCombinedBuffer(audioContext, originalBuffer, chunksToInclude = null) {
        const chunks = chunksToInclude || this.chunks;
        if (chunks.length === 0) return null;
        
        const sampleRate = originalBuffer.sampleRate;
        const channels = originalBuffer.numberOfChannels;
        
        // Calculate total duration
        let totalDuration = 0;
        chunks.forEach(chunk => {
            totalDuration += (chunk.end - chunk.start);
        });
        
        const totalFrames = Math.floor(totalDuration * sampleRate);
        const combinedBuffer = audioContext.createBuffer(channels, totalFrames, sampleRate);
        
        let currentFrame = 0;
        
        // Copy audio data from chunks
        chunks.forEach(chunk => {
            const startFrame = Math.floor(chunk.start * sampleRate);
            const endFrame = Math.floor(chunk.end * sampleRate);
            const chunkFrames = endFrame - startFrame;
            
            for (let channel = 0; channel < channels; channel++) {
                const oldData = originalBuffer.getChannelData(channel);
                const newData = combinedBuffer.getChannelData(channel);
                
                for (let i = 0; i < chunkFrames; i++) {
                    if (currentFrame + i < totalFrames) {
                        newData[currentFrame + i] = oldData[startFrame + i] || 0;
                    }
                }
            }
            currentFrame += chunkFrames;
        });
        
        return combinedBuffer;
    }
}