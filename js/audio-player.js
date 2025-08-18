/**
 * Handles audio playback, including chunk-based and selection-based playback
 */

export class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.source = null;
        this.isPlaying = false;
        this.playStartTime = 0;
        this.pausedAtTime = 0;
        this.currentlyPlayingChunk = null;
        this.playingChunks = null;
        this.playingStartOffset = 0;
        this.isPlayingSelection = false;
        this.selectionStartTime = 0;
        this.selectionEndTime = 0;
        this.isLooping = false;
        this.loopAudioBuffer = null;
        this.loopSelection = null;
    }

    /**
     * Gets current playback time
     * @returns {number} Current playback time in seconds
     */
    getCurrentPlaybackTime() {
        if (!this.isPlaying) return this.pausedAtTime;
        return this.pausedAtTime + (this.audioContext.currentTime - this.playStartTime);
    }

    /**
     * Toggles loop mode
     * @returns {boolean} New loop state
     */
    toggleLoop() {
        this.isLooping = !this.isLooping;
        return this.isLooping;
    }

    /**
     * Sets loop mode
     * @param {boolean} enabled - Whether to enable loop mode
     */
    setLoop(enabled) {
        this.isLooping = enabled;
    }

    /**
     * Plays audio selection
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {object} selection - Selection object with start and end times
     */
    async playSelection(audioBuffer, selection) {
        const startTime = Math.min(selection.start, selection.end);
        const endTime = Math.max(selection.start, selection.end);
        
        this.source = this.audioContext.createBufferSource();
        
        // Create a buffer for just the selection
        const duration = endTime - startTime;
        const sampleRate = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        const startFrame = Math.floor(startTime * sampleRate);
        const endFrame = Math.floor(endTime * sampleRate);
        const frameCount = endFrame - startFrame;
        
        const selectionBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
        
        // Copy audio data for the selection
        for (let channel = 0; channel < channels; channel++) {
            const oldData = audioBuffer.getChannelData(channel);
            const newData = selectionBuffer.getChannelData(channel);
            
            for (let i = 0; i < frameCount; i++) {
                newData[i] = oldData[startFrame + i] || 0;
            }
        }
        
        this.source.buffer = selectionBuffer;
        this.source.connect(this.audioContext.destination);
        
        // Calculate start offset if we're resuming within the selection
        let startOffset = 0;
        if (this.pausedAtTime >= startTime && this.pausedAtTime <= endTime) {
            startOffset = this.pausedAtTime - startTime;
        } else {
            this.pausedAtTime = startTime;
        }
        
        this.source.start(0, startOffset);
        this.playStartTime = this.audioContext.currentTime - startOffset;
        this.isPlaying = true;
        this.isPlayingSelection = true;
        this.selectionStartTime = startTime;
        this.selectionEndTime = endTime;
        
        // Store for looping
        this.loopAudioBuffer = audioBuffer;
        this.loopSelection = selection;
        
        // Auto-stop or loop when selection ends
        this.source.onended = () => {
            if (this.isPlaying) {
                if (this.isLooping) {
                    // Reset position to start of selection and play again
                    this.pausedAtTime = startTime;
                    this.playSelection(this.loopAudioBuffer, this.loopSelection);
                } else {
                    this.stop();
                }
            }
        };
    }

    /**
     * Plays a specific chunk
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {object} chunk - Chunk object with start and end times
     */
    async playChunk(audioBuffer, chunk) {
        this.source = this.audioContext.createBufferSource();
        const chunkBuffer = this.createChunkBuffer(audioBuffer, chunk);
        this.source.buffer = chunkBuffer;
        this.source.connect(this.audioContext.destination);
        
        // Calculate start position within the chunk
        let startOffset = 0;
        if (this.pausedAtTime >= chunk.start && this.pausedAtTime <= chunk.end) {
            startOffset = this.pausedAtTime - chunk.start;
        }
        
        this.source.start(0, startOffset);
        this.playStartTime = this.audioContext.currentTime;
        this.pausedAtTime = chunk.start + startOffset;
        this.isPlaying = true;
        this.currentlyPlayingChunk = chunk;
        
        // Store for looping
        this.loopAudioBuffer = audioBuffer;
        this.loopSelection = null; // Not playing a selection
        
        // Auto-stop or loop when chunk ends
        this.source.onended = () => {
            if (this.isPlaying) {
                if (this.isLooping) {
                    // Reset position to start of chunk and play again
                    this.pausedAtTime = chunk.start;
                    this.playChunk(this.loopAudioBuffer, chunk);
                } else {
                    this.stop();
                }
            }
        };
    }

    /**
     * Plays all chunks in sequence
     * @param {AudioBuffer} audioBuffer - The audio buffer
     * @param {Array} chunks - Array of chunk objects
     */
    async playAllChunks(audioBuffer, chunks) {
        if (chunks.length === 0) {
            this.stop();
            return;
        }
        
        // Sort chunks by start time
        const sortedChunks = [...chunks].sort((a, b) => a.start - b.start);
        
        // Find which chunk to start from based on pausedAtTime
        let startChunkIndex = 0;
        let startOffset = 0;
        
        for (let i = 0; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            if (this.pausedAtTime >= chunk.start && this.pausedAtTime <= chunk.end) {
                startChunkIndex = i;
                startOffset = this.pausedAtTime - chunk.start;
                break;
            } else if (this.pausedAtTime < chunk.start) {
                startChunkIndex = i;
                startOffset = 0;
                this.pausedAtTime = chunk.start;
                break;
            }
        }
        
        // Create a combined buffer from all remaining chunks
        const combinedBuffer = this.createCombinedChunksBuffer(audioBuffer, sortedChunks, startChunkIndex, startOffset);
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = combinedBuffer;
        this.source.connect(this.audioContext.destination);
        this.source.start(0);
        
        this.playStartTime = this.audioContext.currentTime;
        this.isPlaying = true;
        this.currentlyPlayingChunk = null;
        this.playingChunks = sortedChunks.slice(startChunkIndex);
        this.playingStartOffset = startOffset;
        
        // Store for looping
        this.loopAudioBuffer = audioBuffer;
        this.loopSelection = null; // Not playing a selection
        
        // Auto-stop or loop when audio ends
        this.source.onended = () => {
            if (this.isPlaying) {
                if (this.isLooping) {
                    // Reset position to start of first chunk and play again
                    const firstChunk = sortedChunks[0];
                    this.pausedAtTime = firstChunk.start;
                    this.playAllChunks(this.loopAudioBuffer, chunks);
                } else {
                    this.stop();
                }
            }
        };
    }

    /**
     * Pauses playback
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.source.stop();
        this.pausedAtTime = this.getCurrentPlaybackTime();
        this.isPlaying = false;
        this.currentlyPlayingChunk = null;
        this.playingChunks = null;
        this.isPlayingSelection = false;
        // Keep loop state and stored audio for resume
    }

    /**
     * Stops playback and resets position
     * @param {Array} chunks - Array of chunks to determine reset position
     */
    stop(chunks = []) {
        if (this.source) {
            this.source.stop();
        }
        this.isPlaying = false;
        this.currentlyPlayingChunk = null;
        this.playingChunks = null;
        this.isPlayingSelection = false;
        
        // Clear loop storage when stopping completely
        this.loopAudioBuffer = null;
        this.loopSelection = null;
        
        // Reset to beginning of first chunk
        if (chunks.length > 0) {
            const firstChunk = [...chunks].sort((a, b) => a.start - b.start)[0];
            this.pausedAtTime = firstChunk.start;
        } else {
            this.pausedAtTime = 0;
        }
    }

    /**
     * Seeks to a specific time
     * @param {number} time - Time to seek to
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    async seekToTime(time, audioBuffer) {
        time = Math.max(0, Math.min(time, audioBuffer.duration));
        
        const wasPlaying = this.isPlaying;
        
        if (this.isPlaying) {
            this.source.stop();
            this.isPlaying = false;
        }
        
        this.pausedAtTime = time;
        
        // If audio was playing, we would resume from new position
        // This is handled by the calling code
        return wasPlaying;
    }

    /**
     * Creates a buffer for a single chunk
     * @param {AudioBuffer} audioBuffer - Original audio buffer
     * @param {object} chunk - Chunk object
     * @returns {AudioBuffer} Chunk buffer
     */
    createChunkBuffer(audioBuffer, chunk) {
        const sampleRate = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        const startFrame = Math.floor(chunk.start * sampleRate);
        const endFrame = Math.floor(chunk.end * sampleRate);
        const frameCount = endFrame - startFrame;
        
        const chunkBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const oldData = audioBuffer.getChannelData(channel);
            const newData = chunkBuffer.getChannelData(channel);
            
            for (let i = 0; i < frameCount; i++) {
                newData[i] = oldData[startFrame + i] || 0;
            }
        }
        
        return chunkBuffer;
    }

    /**
     * Creates a combined buffer from multiple chunks
     * @param {AudioBuffer} audioBuffer - Original audio buffer
     * @param {Array} sortedChunks - Sorted array of chunks
     * @param {number} startChunkIndex - Index to start from
     * @param {number} startOffset - Offset within the first chunk
     * @returns {AudioBuffer} Combined buffer
     */
    createCombinedChunksBuffer(audioBuffer, sortedChunks, startChunkIndex = 0, startOffset = 0) {
        if (sortedChunks.length === 0) return null;
        
        const sampleRate = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        
        // Calculate total duration from startChunkIndex onwards
        let totalDuration = 0;
        for (let i = startChunkIndex; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            const chunkDuration = chunk.end - chunk.start;
            if (i === startChunkIndex) {
                totalDuration += chunkDuration - startOffset;
            } else {
                totalDuration += chunkDuration;
            }
        }
        
        const totalFrames = Math.floor(totalDuration * sampleRate);
        const combinedBuffer = this.audioContext.createBuffer(channels, totalFrames, sampleRate);
        
        let currentFrame = 0;
        
        for (let i = startChunkIndex; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            const chunkStartTime = i === startChunkIndex ? chunk.start + startOffset : chunk.start;
            const chunkEndTime = chunk.end;
            
            const startFrame = Math.floor(chunkStartTime * sampleRate);
            const endFrame = Math.floor(chunkEndTime * sampleRate);
            const chunkFrames = endFrame - startFrame;
            
            for (let channel = 0; channel < channels; channel++) {
                const oldData = audioBuffer.getChannelData(channel);
                const newData = combinedBuffer.getChannelData(channel);
                
                for (let j = 0; j < chunkFrames; j++) {
                    if (currentFrame + j < totalFrames) {
                        newData[currentFrame + j] = oldData[startFrame + j] || 0;
                    }
                }
            }
            currentFrame += chunkFrames;
        }
        
        return combinedBuffer;
    }
}