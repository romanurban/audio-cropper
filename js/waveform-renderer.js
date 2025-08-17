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
     * @param {object} selection - Selection object with start and end times
     */
    drawWaveform(audioBuffer, seekPosition = 0, playbackTime = 0, selection = null) {
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
                    const waveformAreaHeight = height - 25; // Leave space for time scale at top
                    const y = 25 + (waveformAreaHeight - barHeight) / 2;
                    
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
                            const waveformAreaHeight = height - 25; // Leave space for time scale at top
                            const y = 25 + (waveformAreaHeight - barHeight) / 2;
                            
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
        
        // Draw time scale at bottom
        this.drawTimeScale(audioBuffer);
        
        // Draw selection labels if there's a selection
        if (selection && selection.start !== selection.end) {
            this.drawSelectionLabels(selection.start, selection.end);
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
            this.ctx.moveTo(x, 25); // Start below time scale
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
            
            // Draw time label for progress line
            this.drawTimeLabel(x, currentTime, '#FFD700', 'Progress');
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
            this.ctx.moveTo(x, 25); // Start below time scale
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset line dash
            
            // Draw time label for seek line
            this.drawTimeLabel(x, seekPosition, '#FF6B6B', 'Seek');
        }
    }

    /**
     * Draws a time indicator triangle in the time bar area
     * @param {number} x - X position on canvas
     * @param {number} time - Time in seconds
     * @param {string} color - Color for the triangle
     * @param {string} label - Label type (Progress, Seek, etc.)
     */
    drawTimeLabel(x, time, color, label) {
        const timeText = this.formatTimeLabel(time);
        
        // Draw small triangle in the time bar area (top 20px)
        const triangleSize = 4;
        const triangleY = 19; // Just below the time scale baseline
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x, triangleY); // Bottom point (pointing down)
        this.ctx.lineTo(x - triangleSize, triangleY - triangleSize); // Top left
        this.ctx.lineTo(x + triangleSize, triangleY - triangleSize); // Top right
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw small time text next to triangle
        this.ctx.font = '9px Arial';
        this.ctx.fillStyle = color;
        
        const textWidth = this.ctx.measureText(timeText).width;
        let textX = x - textWidth/2;
        
        // Keep text within canvas bounds
        if (textX < 2) textX = 2;
        if (textX + textWidth > this.canvas.width - 2) {
            textX = this.canvas.width - textWidth - 2;
        }
        
        // Draw text with background for better visibility
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(textX - 2, 2, textWidth + 4, 10);
        
        this.ctx.fillStyle = color;
        this.ctx.fillText(timeText, textX, 10);
    }

    /**
     * Draws selection time indicators
     * @param {number} startTime - Selection start time
     * @param {number} endTime - Selection end time
     */
    drawSelectionLabels(startTime, endTime) {
        if (!this.audioBuffer || startTime === endTime) return;
        
        const startX = this.getPixelPositionForTimeZoomed(startTime);
        const endX = this.getPixelPositionForTimeZoomed(endTime);
        
        // Draw start time triangle
        if (startX >= 0 && startX <= this.canvas.width) {
            this.drawSelectionTriangle(startX, '#4CAF50', false); // Green triangle pointing up
        }
        
        // Draw end time triangle
        if (endX >= 0 && endX <= this.canvas.width) {
            this.drawSelectionTriangle(endX, '#4CAF50', false); // Green triangle pointing up
        }
        
        // Draw compact duration info in corner if both points are visible
        if (startX >= 0 && endX >= 0 && startX <= this.canvas.width && endX <= this.canvas.width) {
            const duration = Math.abs(endTime - startTime);
            const durationText = this.formatTimeLabel(duration);
            
            this.ctx.font = 'bold 10px Arial';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(this.canvas.width - 60, 2, 56, 12);
            
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillText(durationText, this.canvas.width - 58, 11);
        }
    }

    /**
     * Draws a small triangle for selection indicators
     * @param {number} x - X position
     * @param {string} color - Triangle color
     * @param {boolean} pointDown - Whether triangle points down
     */
    drawSelectionTriangle(x, color, pointDown = true) {
        const triangleSize = 3;
        const y = pointDown ? 22 : 15; // Position in time bar area
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        
        if (pointDown) {
            this.ctx.moveTo(x, y); // Bottom point
            this.ctx.lineTo(x - triangleSize, y - triangleSize); // Top left
            this.ctx.lineTo(x + triangleSize, y - triangleSize); // Top right
        } else {
            this.ctx.moveTo(x, y); // Bottom point (pointing up)
            this.ctx.lineTo(x - triangleSize, y + triangleSize); // Top left
            this.ctx.lineTo(x + triangleSize, y + triangleSize); // Top right
        }
        
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Draws time scale at the bottom of the canvas
     * @param {AudioBuffer} audioBuffer - Audio buffer for duration reference
     */
    drawTimeScale(audioBuffer) {
        if (!audioBuffer) return;
        
        const height = this.canvas.height;
        const width = this.canvas.width;
        const timeScaleHeight = 20; // Height reserved for time scale
        const timeScaleTop = 0; // Position at canvas top
        const tickHeight = 6;
        
        // Set font and style for time labels
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#666';
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        
        if (this.zoomLevel > 1.0) {
            // When zoomed, show time markers across the entire audio duration
            const totalDuration = audioBuffer.duration;
            
            // Calculate appropriate interval based on zoom level and canvas width
            let interval = this.calculateTimeInterval(totalDuration, width);
            
            // Draw time markers
            for (let time = 0; time <= totalDuration; time += interval) {
                const x = this.getPixelPositionForTimeZoomed(time);
                
                if (x >= 0 && x <= width) {
                    // Draw tick mark
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, timeScaleTop + timeScaleHeight);
                    this.ctx.lineTo(x, timeScaleTop + timeScaleHeight - tickHeight);
                    this.ctx.stroke();
                    
                    // Draw time label
                    const timeLabel = this.formatTimeLabel(time);
                    const textWidth = this.ctx.measureText(timeLabel).width;
                    this.ctx.fillText(timeLabel, x - textWidth/2, timeScaleTop + 16);
                }
            }
            
            // Draw baseline
            this.ctx.beginPath();
            this.ctx.moveTo(0, timeScaleTop + timeScaleHeight);
            this.ctx.lineTo(width, timeScaleTop + timeScaleHeight);
            this.ctx.stroke();
            
        } else {
            // When not zoomed, show time markers based on visible chunks
            const visibleRange = this.getVisibleTimeRange();
            const visibleChunks = this.chunks.filter(chunk => 
                chunk.end > visibleRange.start && chunk.start < visibleRange.end
            );
            
            if (visibleChunks.length === 0) return;
            
            let totalVisibleDuration = 0;
            visibleChunks.forEach(chunk => {
                const chunkStart = Math.max(chunk.start, visibleRange.start);
                const chunkEnd = Math.min(chunk.end, visibleRange.end);
                totalVisibleDuration += (chunkEnd - chunkStart);
            });
            
            const gapWidth = 4;
            const totalGaps = Math.max(0, visibleChunks.length - 1) * gapWidth;
            const availableWidth = width - totalGaps;
            
            let currentX = 0;
            
            // Draw time markers for each chunk
            visibleChunks.forEach((chunk) => {
                const chunkStart = Math.max(chunk.start, visibleRange.start);
                const chunkEnd = Math.min(chunk.end, visibleRange.end);
                const visibleChunkDuration = chunkEnd - chunkStart;
                
                if (visibleChunkDuration <= 0) return;
                
                const chunkWidthRatio = visibleChunkDuration / totalVisibleDuration;
                const chunkWidth = availableWidth * chunkWidthRatio;
                
                // Calculate appropriate interval for this chunk
                const interval = this.calculateTimeInterval(visibleChunkDuration, chunkWidth);
                
                // Draw time markers within this chunk
                for (let time = chunkStart; time <= chunkEnd; time += interval) {
                    if (time > chunkEnd) break;
                    
                    const timeInChunk = time - chunkStart;
                    const progressInChunk = timeInChunk / visibleChunkDuration;
                    const x = currentX + (progressInChunk * chunkWidth);
                    
                    // Draw tick mark
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, timeScaleTop + timeScaleHeight);
                    this.ctx.lineTo(x, timeScaleTop + timeScaleHeight - tickHeight);
                    this.ctx.stroke();
                    
                    // Draw time label
                    const timeLabel = this.formatTimeLabel(time);
                    const textWidth = this.ctx.measureText(timeLabel).width;
                    if (x - textWidth/2 >= currentX && x + textWidth/2 <= currentX + chunkWidth) {
                        this.ctx.fillText(timeLabel, x - textWidth/2, timeScaleTop + 16);
                    }
                }
                
                // Draw chunk baseline
                this.ctx.beginPath();
                this.ctx.moveTo(currentX, timeScaleTop + timeScaleHeight);
                this.ctx.lineTo(currentX + chunkWidth, timeScaleTop + timeScaleHeight);
                this.ctx.stroke();
                
                currentX += chunkWidth + gapWidth;
            });
        }
    }

    /**
     * Calculates appropriate time interval for markers based on duration and width
     * @param {number} duration - Time duration to display
     * @param {number} width - Pixel width available
     * @returns {number} Time interval in seconds
     */
    calculateTimeInterval(duration, width) {
        const minPixelsBetweenMarkers = 50; // Minimum pixels between time markers
        const maxMarkers = Math.floor(width / minPixelsBetweenMarkers);
        
        if (maxMarkers <= 0) return duration;
        
        const roughInterval = duration / maxMarkers;
        
        // Round to nice intervals (1, 2, 5, 10, 15, 30 seconds, 1, 2, 5 minutes, etc.)
        const niceIntervals = [
            0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 
            60, 120, 300, 600, 900, 1800, 3600
        ];
        
        for (let interval of niceIntervals) {
            if (interval >= roughInterval) {
                return interval;
            }
        }
        
        // For very long durations, use hour-based intervals
        return Math.ceil(roughInterval / 3600) * 3600;
    }

    /**
     * Formats time for display on time scale
     * @param {number} time - Time in seconds
     * @returns {string} Formatted time string
     */
    formatTimeLabel(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const decimals = Math.floor((time % 1) * 10);
        
        if (minutes === 0) {
            if (time < 10) {
                return `${seconds}.${decimals}s`;
            } else {
                return `${seconds}s`;
            }
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        
        console.log('Setting up scroll container, canvas parent:', this.canvas.parentElement.className);
        
        // Use the existing waveform container directly as scroll container
        this.scrollContainer = this.canvas.parentElement;
        this.scrollContainer.style.overflowX = 'auto';
        this.scrollContainer.style.overflowY = 'hidden';
        
        // Force the scrollbar styles to be applied
        this.scrollContainer.style.setProperty('--webkit-scrollbar-height', '14px');
        
        // Add a CSS class to ensure scrollbar styling is applied
        this.scrollContainer.classList.add('styled-scrollbar');
        
        // Inject scrollbar styles dynamically as a fallback
        this.injectScrollbarStyles();
        
        console.log('Scroll container setup complete:', this.scrollContainer.className);
        console.log('Computed overflow-x:', window.getComputedStyle(this.scrollContainer).overflowX);
        
        // Set up scroll event listener with bound handler for removal
        this.boundScrollHandler = (e) => this.handleHorizontalScroll(e);
        this.scrollContainer.addEventListener('scroll', this.boundScrollHandler);
        
        // Update scroll width initially
        this.updateScrollWidth();
    }

    /**
     * Injects scrollbar styles dynamically to ensure they're applied
     */
    injectScrollbarStyles() {
        // Check if styles are already injected
        if (document.getElementById('dynamic-scrollbar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'dynamic-scrollbar-styles';
        style.textContent = `
            .waveform::-webkit-scrollbar,
            .styled-scrollbar::-webkit-scrollbar {
                height: 14px !important;
            }
            
            .waveform::-webkit-scrollbar-track,
            .styled-scrollbar::-webkit-scrollbar-track {
                background: #1a1a1a !important;
                border-radius: 7px !important;
                border: 1px solid #333 !important;
                margin: 0 4px !important;
            }
            
            .waveform::-webkit-scrollbar-thumb,
            .styled-scrollbar::-webkit-scrollbar-thumb {
                background: linear-gradient(45deg, #4CAF50, #45a049) !important;
                border-radius: 7px !important;
                border: 1px solid #2d2d2d !important;
                box-shadow: inset 0 1px 2px rgba(76, 175, 80, 0.3) !important;
            }
            
            .waveform::-webkit-scrollbar-thumb:hover,
            .styled-scrollbar::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(45deg, #45a049, #66BB6A) !important;
                box-shadow: inset 0 1px 2px rgba(76, 175, 80, 0.5) !important;
            }
            
            .waveform::-webkit-scrollbar-thumb:active,
            .styled-scrollbar::-webkit-scrollbar-thumb:active {
                background: linear-gradient(45deg, #388E3C, #4CAF50) !important;
                box-shadow: inset 0 1px 2px rgba(76, 175, 80, 0.7) !important;
            }
        `;
        
        document.head.appendChild(style);
        console.log('Dynamic scrollbar styles injected');
    }

    /**
     * Sets up zoom control overlays
     */
    setupZoomControls() {
        // Find the zoom controls in the instructions strip
        this.zoomControls = document.querySelector('.zoom-controls-strip');
        if (!this.zoomControls) {
            console.warn('Zoom controls strip not found');
            return;
        }
        
        console.log('Zoom controls found in strip');
        
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
        
        console.log('handleZoom called: direction=', direction, 'oldZoom=', oldZoom, 'newZoom=', newZoom);
        
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
        console.log('updateScrollWidth called: scrollContainer=', !!this.scrollContainer, 'audioBuffer=', !!this.audioBuffer, 'zoomLevel=', this.zoomLevel);
        if (!this.scrollContainer || !this.audioBuffer) return;
        
        if (this.zoomLevel > 1.0) {
            // Simple approach: make canvas wider than its container
            const containerWidth = this.scrollContainer.clientWidth;
            const canvasWidth = Math.floor(containerWidth * this.zoomLevel);
            
            // Set canvas to be wider than container to trigger horizontal scrollbar
            this.canvas.style.width = canvasWidth + 'px';
            this.canvas.width = canvasWidth;
            
            console.log('Zoom update: containerWidth=', containerWidth, 'canvasWidth=', canvasWidth, 'zoomLevel=', this.zoomLevel);
            console.log('After update - ScrollContainer scrollWidth:', this.scrollContainer.scrollWidth, 'clientWidth:', this.scrollContainer.clientWidth);
        } else {
            // Reset to normal size when not zoomed
            const containerWidth = this.scrollContainer.clientWidth;
            
            // Reset canvas to container width
            this.canvas.style.width = '100%';
            this.canvas.width = containerWidth;
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