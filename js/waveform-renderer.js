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
        
        // Zoom functionality
        this.zoomLevel = 1.0;
        this.zoomOffset = 0; // Start position of visible area (in seconds)
        this.minZoom = 0.1;
        this.maxZoom = 50.0;
        this.zoomStep = 1.2;
        
        // Scroll functionality
        this.scrollContainer = null;
        this.virtualCanvas = null;
        
        // Zoom controls
        this.zoomControls = null;
        this.isCanvasActive = false;
        
        this.setupEventListeners();
        
        // Delay setup until DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupScrollContainer();
                this.setupZoomControls();
            });
        } else {
            this.setupScrollContainer();
            this.setupZoomControls();
        }
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
            this.updateScrollWidth();
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
        
        // Get visible time range based on zoom
        const visibleRange = this.getVisibleTimeRange();
        const visibleDuration = visibleRange.end - visibleRange.start;
        
        if (this.zoomLevel > 1.0) {
            // When zoomed, draw the entire audio across the zoomed canvas width
            const totalSamples = this.waveformData.length;
            const barWidth = width / totalSamples;
            
            // Draw all waveform data across the wider canvas
            for (let i = 0; i < totalSamples; i++) {
                if (i < this.waveformData.length) {
                    this.ctx.fillStyle = '#4CAF50';
                    
                    const barHeight = this.waveformData[i] * height * 0.8;
                    const x = i * barWidth;
                    const y = (height - barHeight) / 2;
                    
                    // Ensure minimum bar height for visibility
                    const minHeight = Math.max(1, barHeight);
                    const actualBarWidth = Math.max(0.5, barWidth - 0.5);
                    
                    this.ctx.fillRect(x, y, actualBarWidth, minHeight);
                }
            }
        } else {
            // When not zoomed, use the original chunk-based rendering
            const visibleChunks = this.chunks.filter(chunk => 
                chunk.end > visibleRange.start && chunk.start < visibleRange.end
            );
            
            if (visibleChunks.length === 0) {
                console.log('No visible chunks in current zoom range');
                return;
            }
            
            // Calculate total duration of visible chunks for proportional rendering
            let totalVisibleDuration = 0;
            visibleChunks.forEach(chunk => {
                const chunkStart = Math.max(chunk.start, visibleRange.start);
                const chunkEnd = Math.min(chunk.end, visibleRange.end);
                totalVisibleDuration += (chunkEnd - chunkStart);
            });
            
            const gapWidth = 4; // pixels between chunks
            const totalGaps = Math.max(0, visibleChunks.length - 1) * gapWidth;
            const availableWidth = width - totalGaps;
            
            let currentX = 0;
            
            // Draw each visible chunk
            visibleChunks.forEach((chunk) => {
                const chunkStart = Math.max(chunk.start, visibleRange.start);
                const chunkEnd = Math.min(chunk.end, visibleRange.end);
                const visibleChunkDuration = chunkEnd - chunkStart;
                
                if (visibleChunkDuration <= 0) return;
                
                const chunkWidthRatio = visibleChunkDuration / totalVisibleDuration;
                const chunkWidth = availableWidth * chunkWidthRatio;
                
                // Calculate which part of the original waveform this visible chunk represents
                const chunkStartRatio = chunkStart / audioBuffer.duration;
                const chunkEndRatio = chunkEnd / audioBuffer.duration;
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
                            const minHeight = Math.max(1, barHeight);
                            const actualBarWidth = Math.max(0.5, barWidth - 0.5);
                            
                            this.ctx.fillRect(x, y, actualBarWidth, minHeight);
                        }
                    }
                }
                
                // Move to next chunk position (add gap)
                currentX += chunkWidth + gapWidth;
            });
        }
        
        // Draw playback progress line
        this.drawProgressLine(playbackTime, audioBuffer);
        
        // Draw seek position line
        this.drawSeekLine(seekPosition, audioBuffer);
        
        console.log('Waveform drawn successfully with zoom level:', this.zoomLevel);
    }

    /**
     * Draws the playback progress line
     * @param {number} currentTime - Current playback time
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    drawProgressLine(currentTime, audioBuffer) {
        if (!audioBuffer) return;
        
        const x = this.getPixelPositionForTimeZoomed(currentTime);
        if (x >= 0 && x <= this.canvas.width) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
    }

    /**
     * Draws the seek position line
     * @param {number} seekPosition - Seek position time
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    drawSeekLine(seekPosition, audioBuffer) {
        if (!audioBuffer) return;
        
        const x = this.getPixelPositionForTimeZoomed(seekPosition);
        if (x >= 0 && x <= this.canvas.width) {
            this.ctx.strokeStyle = '#FF6B6B';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset line dash
        }
    }

    /**
     * Converts time to pixel position within the chunk layout
     * @param {number} time - Time in seconds
     * @returns {number} Pixel position
     */
    getPixelPositionForTime(time) {
        const visibleRange = this.getVisibleTimeRange();
        
        // Check if time is within visible range
        if (time < visibleRange.start || time > visibleRange.end) {
            return -1; // Not visible
        }
        
        const visibleChunks = this.chunks.filter(chunk => 
            chunk.end > visibleRange.start && chunk.start < visibleRange.end
        );
        
        if (visibleChunks.length === 0) return -1;
        
        let totalVisibleDuration = 0;
        visibleChunks.forEach(chunk => {
            const chunkStart = Math.max(chunk.start, visibleRange.start);
            const chunkEnd = Math.min(chunk.end, visibleRange.end);
            totalVisibleDuration += (chunkEnd - chunkStart);
        });
        
        const gapWidth = 4;
        const totalGaps = Math.max(0, visibleChunks.length - 1) * gapWidth;
        const availableWidth = this.canvas.width - totalGaps;
        
        let currentX = 0;
        
        for (const chunk of visibleChunks) {
            const chunkStart = Math.max(chunk.start, visibleRange.start);
            const chunkEnd = Math.min(chunk.end, visibleRange.end);
            const visibleChunkDuration = chunkEnd - chunkStart;
            
            if (time >= chunkStart && time <= chunkEnd) {
                const timeInChunk = time - chunkStart;
                const progressInChunk = timeInChunk / visibleChunkDuration;
                const chunkWidthRatio = visibleChunkDuration / totalVisibleDuration;
                const chunkWidth = availableWidth * chunkWidthRatio;
                return currentX + (progressInChunk * chunkWidth);
            }
            
            const chunkWidthRatio = visibleChunkDuration / totalVisibleDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
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
        const visibleRange = this.getVisibleTimeRange();
        const visibleChunks = this.chunks.filter(chunk => 
            chunk.end > visibleRange.start && chunk.start < visibleRange.end
        );
        
        if (visibleChunks.length === 0) {
            return visibleRange.start;
        }
        
        let totalVisibleDuration = 0;
        visibleChunks.forEach(chunk => {
            const chunkStart = Math.max(chunk.start, visibleRange.start);
            const chunkEnd = Math.min(chunk.end, visibleRange.end);
            totalVisibleDuration += (chunkEnd - chunkStart);
        });
        
        const gapWidth = 4;
        const totalGaps = Math.max(0, visibleChunks.length - 1) * gapWidth;
        const availableWidth = this.canvas.width - totalGaps;
        
        let currentX = 0;
        
        // Find which chunk the pixel position is in
        for (const chunk of visibleChunks) {
            const chunkStart = Math.max(chunk.start, visibleRange.start);
            const chunkEnd = Math.min(chunk.end, visibleRange.end);
            const visibleChunkDuration = chunkEnd - chunkStart;
            const chunkWidthRatio = visibleChunkDuration / totalVisibleDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            if (pixelX >= currentX && pixelX <= currentX + chunkWidth) {
                // Calculate time within this chunk
                const pixelInChunk = pixelX - currentX;
                const progressInChunk = pixelInChunk / chunkWidth;
                return chunkStart + (progressInChunk * visibleChunkDuration);
            }
            
            currentX += chunkWidth + gapWidth;
        }
        
        // If not in any chunk, return the start of visible range
        return visibleRange.start;
    }

    /**
     * Sets up scroll container for horizontal scrolling when zoomed
     */
    setupScrollContainer() {
        if (!this.canvas.parentElement) return;
        
        // Create scroll container wrapper
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'waveform-scroll-container';
        
        // Set up container styles
        this.scrollContainer.style.width = '100%';
        this.scrollContainer.style.height = '100%';
        this.scrollContainer.style.overflowX = 'auto';
        this.scrollContainer.style.overflowY = 'hidden';
        this.scrollContainer.style.position = 'relative';
        
        // Create virtual canvas for scroll width
        this.virtualCanvas = document.createElement('div');
        this.virtualCanvas.className = 'virtual-canvas';
        this.virtualCanvas.style.height = '1px';
        this.virtualCanvas.style.width = '100%';
        this.virtualCanvas.style.position = 'absolute';
        this.virtualCanvas.style.top = '0';
        this.virtualCanvas.style.pointerEvents = 'none';
        
        // Insert scroll container between parent and canvas
        const parent = this.canvas.parentElement;
        parent.insertBefore(this.scrollContainer, this.canvas);
        this.scrollContainer.appendChild(this.canvas);
        this.scrollContainer.appendChild(this.virtualCanvas);
        
        // Set up scroll event listener with bound handler for removal
        this.boundScrollHandler = (e) => this.handleHorizontalScroll(e);
        this.scrollContainer.addEventListener('scroll', this.boundScrollHandler);
        
        // Update scroll width initially
        this.updateScrollWidth();
    }

    /**
     * Sets up zoom control overlays
     */
    setupZoomControls() {
        // Find the waveform container (not the scroll container)
        const waveformContainer = this.canvas.closest('.waveform');
        if (!waveformContainer) return;
        
        // Create zoom controls container
        this.zoomControls = document.createElement('div');
        this.zoomControls.className = 'zoom-controls';
        this.zoomControls.innerHTML = `
            <button class="zoom-btn zoom-in" title="Zoom In">+</button>
            <button class="zoom-btn zoom-out" title="Zoom Out">−</button>
            <button class="zoom-btn zoom-reset" title="Reset Zoom">⌂</button>
        `;
        
        // Set higher z-index and pointer events
        this.zoomControls.style.pointerEvents = 'auto';
        this.zoomControls.style.zIndex = '1000';
        this.zoomControls.style.position = 'absolute';
        this.zoomControls.style.top = '10px';
        this.zoomControls.style.right = '10px';
        
        // Append to waveform container so it stays fixed
        waveformContainer.appendChild(this.zoomControls);
        
        // Add event listeners for zoom buttons
        this.setupZoomButtonListeners();
    }

    /**
     * Sets up event listeners for zoom functionality
     */
    setupEventListeners() {
        // Canvas focus/blur for scroll wheel zoom
        this.canvas.addEventListener('mouseenter', () => {
            this.isCanvasActive = true;
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isCanvasActive = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        // Scroll wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            if (this.isCanvasActive) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -1 : 1;
                this.handleZoom(delta, e.clientX - this.canvas.getBoundingClientRect().left);
            }
        });
        
        // Zoom control buttons - will be set up when controls are created
    }

    /**
     * Sets up event listeners for zoom button clicks
     */
    setupZoomButtonListeners() {
        if (!this.zoomControls) return;
        
        // Add event listeners to each button individually
        const zoomInBtn = this.zoomControls.querySelector('.zoom-in');
        const zoomOutBtn = this.zoomControls.querySelector('.zoom-out');
        const zoomResetBtn = this.zoomControls.querySelector('.zoom-reset');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.zoomIn();
            });
            
            zoomInBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.zoomOut();
            });
            
            zoomOutBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
        
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.resetZoom();
            });
            
            zoomResetBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
    }

    /**
     * Handles zoom operation
     * @param {number} direction - 1 for zoom in, -1 for zoom out
     * @param {number} centerX - X coordinate to zoom towards
     */
    handleZoom(direction, centerX = null) {
        if (!this.audioBuffer) return;
        
        const oldZoom = this.zoomLevel;
        const newZoom = direction > 0 ? 
            Math.min(this.maxZoom, this.zoomLevel * this.zoomStep) :
            Math.max(this.minZoom, this.zoomLevel / this.zoomStep);
        
        if (newZoom === oldZoom) return;
        
        // Calculate zoom center point
        if (centerX === null) {
            centerX = this.canvas.width / 2;
        }
        
        // Convert center X to time position
        const centerTimeOld = this.getTimeFromPixelPosition(centerX);
        
        this.zoomLevel = newZoom;
        
        // Adjust offset to keep the center point stable
        const centerTimeNew = this.getTimeFromPixelPosition(centerX);
        this.zoomOffset += (centerTimeOld - centerTimeNew);
        
        // Clamp zoom offset to valid range
        this.clampZoomOffset();
        
        // Update scroll width and position
        this.updateScrollWidth();
        this.updateScrollPosition();
        
        // Redraw waveform
        if (this.audioBuffer) {
            this.drawWaveform(this.audioBuffer);
        }
    }

    /**
     * Zoom in at center
     */
    zoomIn() {
        this.handleZoom(1);
    }

    /**
     * Zoom out at center
     */
    zoomOut() {
        this.handleZoom(-1);
    }

    /**
     * Reset zoom to fit all audio
     */
    resetZoom() {
        this.zoomLevel = 1.0;
        this.zoomOffset = 0;
        
        // Update scroll width and position
        this.updateScrollWidth();
        this.updateScrollPosition();
        
        if (this.audioBuffer) {
            this.drawWaveform(this.audioBuffer);
        }
    }

    /**
     * Clamps zoom offset to valid range
     */
    clampZoomOffset() {
        if (!this.audioBuffer) return;
        
        const visibleDuration = this.audioBuffer.duration / this.zoomLevel;
        const maxOffset = Math.max(0, this.audioBuffer.duration - visibleDuration);
        
        this.zoomOffset = Math.max(0, Math.min(maxOffset, this.zoomOffset));
    }

    /**
     * Gets the visible time range based on zoom
     * @returns {object} Object with start and end times
     */
    getVisibleTimeRange() {
        if (!this.audioBuffer) return { start: 0, end: 0 };
        
        const visibleDuration = this.audioBuffer.duration / this.zoomLevel;
        return {
            start: this.zoomOffset,
            end: Math.min(this.audioBuffer.duration, this.zoomOffset + visibleDuration)
        };
    }

    /**
     * Handles horizontal scroll events
     * @param {Event} e - Scroll event
     */
    handleHorizontalScroll(e) {
        if (!this.audioBuffer || this.zoomLevel <= 1.0) return;
        
        const scrollLeft = e.target.scrollLeft;
        const containerWidth = e.target.clientWidth;
        const canvasWidth = containerWidth * this.zoomLevel;
        const maxScroll = canvasWidth - containerWidth;
        
        if (maxScroll > 0) {
            // Calculate scroll ratio based on canvas position
            const scrollRatio = scrollLeft / maxScroll;
            
            // Map scroll ratio to audio time offset
            const visibleDuration = this.audioBuffer.duration / this.zoomLevel;
            const maxOffset = Math.max(0, this.audioBuffer.duration - visibleDuration);
            
            this.zoomOffset = scrollRatio * maxOffset;
            this.clampZoomOffset();
            
            // No need to redraw - the canvas content doesn't change, just the view position
        }
    }

    /**
     * Updates the scroll container width based on zoom level
     */
    updateScrollWidth() {
        if (!this.scrollContainer || !this.audioBuffer) return;
        
        if (this.zoomLevel > 1.0) {
            // Make the canvas itself wider when zoomed
            const containerWidth = this.scrollContainer.clientWidth;
            const canvasWidth = containerWidth * this.zoomLevel;
            
            // Set canvas size to zoomed width
            this.canvas.style.width = canvasWidth + 'px';
            this.canvas.style.minWidth = canvasWidth + 'px';
            this.canvas.width = canvasWidth;
            
            // Ensure the virtual canvas creates the scroll area
            if (this.virtualCanvas) {
                this.virtualCanvas.style.width = canvasWidth + 'px';
                this.virtualCanvas.style.minWidth = canvasWidth + 'px';
            }
            
            // Show scrollbar
            this.scrollContainer.style.overflowX = 'auto';
        } else {
            // Reset to normal size when not zoomed
            const containerWidth = this.scrollContainer.clientWidth;
            this.canvas.style.width = '100%';
            this.canvas.style.minWidth = 'auto';
            this.canvas.width = containerWidth;
            
            if (this.virtualCanvas) {
                this.virtualCanvas.style.width = '100%';
                this.virtualCanvas.style.minWidth = 'auto';
            }
            
            this.scrollContainer.style.overflowX = 'hidden';
        }
    }

    /**
     * Updates scroll position to match current zoom offset
     */
    updateScrollPosition() {
        if (!this.scrollContainer || !this.audioBuffer || this.zoomLevel <= 1.0) return;
        
        const visibleDuration = this.audioBuffer.duration / this.zoomLevel;
        const maxOffset = Math.max(0, this.audioBuffer.duration - visibleDuration);
        
        if (maxOffset > 0) {
            const scrollRatio = Math.min(1, this.zoomOffset / maxOffset);
            const containerWidth = this.scrollContainer.clientWidth;
            const canvasWidth = containerWidth * this.zoomLevel;
            const maxScroll = canvasWidth - containerWidth;
            
            // Temporarily remove scroll listener to prevent feedback loop
            this.scrollContainer.removeEventListener('scroll', this.boundScrollHandler);
            this.scrollContainer.scrollLeft = scrollRatio * maxScroll;
            
            // Re-add scroll listener after a brief delay
            setTimeout(() => {
                this.scrollContainer.addEventListener('scroll', this.boundScrollHandler);
            }, 10);
        }
    }

    /**
     * Converts mouse pixel position to time, accounting for zoom and scroll
     * @param {number} mouseX - Mouse X coordinate relative to canvas element
     * @returns {number} Time in seconds
     */
    getTimeFromMousePosition(mouseX) {
        if (!this.audioBuffer) return 0;
        
        // If not zoomed, use regular conversion
        if (this.zoomLevel <= 1.0) {
            return this.getTimeFromPixelPosition(mouseX);
        }
        
        // When zoomed, mouseX is relative to the canvas (its rect already includes scroll)
        const totalWidth = this.canvas.width;
        const clampedX = Math.max(0, Math.min(totalWidth, mouseX));
        const timeRatio = clampedX / totalWidth;
        return timeRatio * this.audioBuffer.duration;
    }


    /**
     * Converts time to pixel position, accounting for zoom and scroll
     * @param {number} time - Time in seconds
     * @returns {number} Pixel position, or -1 if not visible
     */
    getPixelPositionForTimeZoomed(time) {
        if (!this.audioBuffer) return -1;
        
        // If not zoomed, use regular conversion
        if (this.zoomLevel <= 1.0) {
            return this.getPixelPositionForTime(time);
        }
        
        // When zoomed, return absolute canvas X position
        const totalWidth = this.canvas.width;
        return (Math.max(0, Math.min(1, time / this.audioBuffer.duration))) * totalWidth;
    }
}