/**
 * Main AudioChunkingEditor class - coordinates all components
 */

import { AudioUtils } from './utils.js';
import { WaveformRenderer } from './waveform-renderer.js';
import { ChunkManager } from './chunk-manager.js';
import { AudioPlayer } from './audio-player.js';

export class AudioChunkingEditor {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.originalFile = null;
        this.isInitialized = false;
        this.seekPosition = 0;
        
        // Selection state
        this.selection = { start: 0, end: 0 };
        this.isDragging = false;
        this.dragStarted = false;
        this.justFinishedDrag = false;
        this.initialClickTime = 0;

        this.initializeElements();
        this.initializeComponents();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.waveformContainer = document.getElementById('waveformContainer');
        this.waveform = document.getElementById('waveform');
        this.canvas = document.getElementById('waveformCanvas');
        this.selectionDiv = document.getElementById('selection');
        
        // Controls
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.splitBtn = document.getElementById('splitBtn');
        this.cropBtn = document.getElementById('cropBtn');
        this.fadeInBtn = document.getElementById('fadeInBtn');
        this.fadeOutBtn = document.getElementById('fadeOutBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        
        // Info displays
        this.durationSpan = document.getElementById('duration');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.selectionInfo = document.getElementById('selectionInfo');
        this.chunkCount = document.getElementById('chunkCount');
        this.chunkInfo = document.getElementById('chunkInfo');
        this.selectedChunkInfo = document.getElementById('selectedChunkInfo');
        this.progress = document.getElementById('progress');
        this.progressBar = document.getElementById('progressBar');
    }

    initializeComponents() {
        this.waveformRenderer = new WaveformRenderer(this.canvas, []);
        this.chunkManager = new ChunkManager(this.waveform);
        this.audioPlayer = null; // Will be initialized with audio context
    }
    
    setupEventListeners() {
        // File upload
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        // Waveform interaction
        this.waveform.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.waveform.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.waveform.addEventListener('mouseup', () => this.handleMouseUp());
        this.waveform.addEventListener('mouseleave', () => this.handleMouseUp());
        this.waveform.addEventListener('click', (e) => this.handleWaveformClick(e));
        
        // Controls
        this.playBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.splitBtn.addEventListener('click', () => this.splitAtPosition());
        this.cropBtn.addEventListener('click', () => this.cropAudio());
        this.fadeInBtn.addEventListener('click', () => this.applyFadeIn());
        this.fadeOutBtn.addEventListener('click', () => this.applyFadeOut());
        this.deleteBtn.addEventListener('click', () => this.delete());
        
        // Resize
        window.addEventListener('resize', () => this.waveformRenderer.resizeCanvas());
        
        // Click outside canvas to deselect chunks
        document.addEventListener('click', (e) => this.handleDocumentClick(e));
    }

    async initializeAudioContext() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.audioPlayer = new AudioPlayer(this.audioContext);
            this.isInitialized = true;
            console.log('AudioContext initialized:', this.audioContext.state);
        } catch (error) {
            console.error('Audio context not supported:', error);
            throw error;
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }
    
    async handleFile(file) {
        if (!file.type.startsWith('audio/')) {
            alert('Please select an audio file');
            return;
        }
        
        this.originalFile = file;
        this.progress.style.display = 'block';
        this.updateProgress(0);
        
        try {
            await this.initializeAudioContext();
            this.updateProgress(20);
            
            const arrayBuffer = await file.arrayBuffer();
            this.updateProgress(50);
            
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.updateProgress(75);
            
            // Reset states
            this.audioPlayer.pausedAtTime = 0;
            this.seekPosition = 0;
            this.audioPlayer.isPlaying = false;
            this.selection = { start: 0, end: 0 };
            
            // Initialize components with new audio
            this.chunkManager.initializeChunks(this.audioBuffer);
            this.waveformRenderer.chunks = this.chunkManager.chunks;
            
            // Update mouse event listeners to use scroll container after it's created
            this.updateMouseEventListeners();
            
            this.waveformContainer.style.display = 'block';
            
            requestAnimationFrame(() => {
                this.waveformRenderer.generateWaveform(this.audioBuffer);
                this.updateProgress(100);
                
                this.updateDuration();
                this.updateCurrentTime();
                this.updateChunkInfo();
                this.updateDeleteButton();
                this.enableControls();
                
                setTimeout(() => {
                    this.progress.style.display = 'none';
                }, 500);
            });
            
        } catch (error) {
            console.error('Error processing audio file:', error);
            alert('Error processing audio file. Please try another file.');
            this.progress.style.display = 'none';
        }
    }

    updateProgress(percent) {
        this.progressBar.style.width = percent + '%';
    }

    updateMouseEventListeners() {
        // Remove old listeners from waveform
        this.waveform.removeEventListener('mousedown', this.boundMouseDown);
        this.waveform.removeEventListener('mousemove', this.boundMouseMove);
        this.waveform.removeEventListener('mouseup', this.boundMouseUp);
        this.waveform.removeEventListener('mouseleave', this.boundMouseUp);
        this.waveform.removeEventListener('click', this.boundWaveformClick);
        
        // Remove old listeners from canvas
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('mouseup', this.boundMouseUp);
        this.canvas.removeEventListener('mouseleave', this.boundMouseUp);
        this.canvas.removeEventListener('click', this.boundWaveformClick);
        
        // Create bound handlers if they don't exist
        if (!this.boundMouseDown) {
            this.boundMouseDown = (e) => this.handleMouseDown(e);
            this.boundMouseMove = (e) => this.handleMouseMove(e);
            this.boundMouseUp = () => this.handleMouseUp();
            this.boundWaveformClick = (e) => this.handleWaveformClick(e);
        }
        
        // Always add listeners to the canvas directly for better coordinate handling
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseup', this.boundMouseUp);
        this.canvas.addEventListener('mouseleave', this.boundMouseUp);
        this.canvas.addEventListener('click', this.boundWaveformClick);
    }

    handleWaveformClick(event) {
        // Don't select chunks if we just finished a drag operation
        if (this.justFinishedDrag) {
            return;
        }
        
        if (this.chunkManager.chunks.length <= 1) {
            return;
        }
        
        // Get coordinates relative to the canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const clickTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Find which chunk was clicked based on time
        const selectedChunk = this.chunkManager.chunks.find(chunk => 
            clickTime >= chunk.start && clickTime <= chunk.end
        );
        
        if (selectedChunk) {
            // Clear drag selection when selecting a chunk
            this.selection.start = 0;
            this.selection.end = 0;
            this.selectionDiv.style.display = 'none';
            
            this.chunkManager.selectedChunk = selectedChunk;
            this.chunkManager.updateChunkOverlays();
            this.updateChunkInfo();
            this.updateDeleteButton();
            this.updateSelectionInfo();
        }
    }

    handleMouseDown(event) {
        this.isDragging = true;
        this.dragStarted = false;
        
        // Get coordinates relative to the canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        
        const clickTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        this.selection.start = clickTime;
        this.selection.end = clickTime;
        this.seekPosition = clickTime;
        
        // Enable split button only if we have a valid seek position in a chunk
        const seekChunk = this.chunkManager.chunks.find(chunk => 
            clickTime >= chunk.start && clickTime <= chunk.end
        );
        this.splitBtn.disabled = !seekChunk;
        
        this.initialClickTime = clickTime;
    }

    handleMouseMove(event) {
        if (!this.isDragging) return;
        
        // Get coordinates relative to the canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const currentTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        if (!this.dragStarted && Math.abs(currentTime - this.initialClickTime) > 0.1) {
            this.dragStarted = true;
            // Clear chunk selection when starting drag selection
            this.chunkManager.selectedChunk = null;
            this.chunkManager.updateChunkOverlays();
            this.updateChunkInfo();
        }
        
        if (this.dragStarted) {
            this.selection.end = currentTime;
            this.updateSelectionDisplay();
        } else {
            this.seekPosition = currentTime;
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        }
    }

    handleMouseUp() {
        if (!this.isDragging) return;
        
        if (!this.dragStarted) {
            this.seekToTime(this.initialClickTime);
            this.seekPosition = this.initialClickTime;
            this.selection.start = 0;
            this.selection.end = 0;
            this.selectionDiv.style.display = 'none';
            this.updateSelectionInfo();
            this.updateDeleteButton();
        } else {
            this.endSelection();
        }
        
        this.isDragging = false;
        
        // Set flag to prevent click event from selecting chunk after drag
        if (this.dragStarted) {
            this.justFinishedDrag = true;
            setTimeout(() => { this.justFinishedDrag = false; }, 10);
        }
        
        this.dragStarted = false;
    }

    async seekToTime(time) {
        time = Math.max(0, Math.min(time, this.audioBuffer.duration));
        const wasPlaying = await this.audioPlayer.seekToTime(time, this.audioBuffer);
        this.seekPosition = time;
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        
        if (wasPlaying) {
            await this.play();
        }
    }

    endSelection() {
        this.isDragging = false;
        if (this.selection.start > this.selection.end) {
            [this.selection.start, this.selection.end] = [this.selection.end, this.selection.start];
        }
        
        // Allow drag selection to span across any part of the waveform
        
        this.updateSelectionInfo();
        this.updateSelectionDisplay();
        this.updateDeleteButton();
    }

    handleDocumentClick(event) {
        // Check if click is outside the waveform canvas
        if (!this.waveform.contains(event.target)) {
            // Deselect chunk if one is selected
            if (this.chunkManager.selectedChunk) {
                this.chunkManager.selectedChunk = null;
                this.chunkManager.updateChunkOverlays();
                this.updateChunkInfo();
                this.updateDeleteButton();
                this.updateSelectionInfo();
            }
        }
    }

    updateSelectionDisplay() {
        if (!this.audioBuffer || this.chunkManager.chunks.length === 0) return;
        
        const totalChunkDuration = this.chunkManager.chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0);
        const gapWidth = 4;
        const totalGaps = Math.max(0, this.chunkManager.chunks.length - 1) * gapWidth;
        const rect = this.waveform.getBoundingClientRect();
        const availableWidth = rect.width - totalGaps;
        
        let selectionStartX = null;
        let selectionEndX = null;
        let currentX = 0;
        
        for (const chunk of this.chunkManager.chunks) {
            const chunkDuration = chunk.end - chunk.start;
            const chunkWidthRatio = chunkDuration / totalChunkDuration;
            const chunkWidth = availableWidth * chunkWidthRatio;
            
            if (selectionStartX === null && this.selection.start >= chunk.start && this.selection.start <= chunk.end) {
                const timeInChunk = this.selection.start - chunk.start;
                const progressInChunk = timeInChunk / chunkDuration;
                selectionStartX = currentX + (progressInChunk * chunkWidth);
            }
            
            if (selectionEndX === null && this.selection.end >= chunk.start && this.selection.end <= chunk.end) {
                const timeInChunk = this.selection.end - chunk.start;
                const progressInChunk = timeInChunk / chunkDuration;
                selectionEndX = currentX + (progressInChunk * chunkWidth);
            }
            
            currentX += chunkWidth + gapWidth;
        }
        
        if (selectionStartX !== null && selectionEndX !== null) {
            const leftX = Math.min(selectionStartX, selectionEndX);
            const rightX = Math.max(selectionStartX, selectionEndX);
            
            this.selectionDiv.style.left = (leftX / rect.width * 100) + '%';
            this.selectionDiv.style.width = ((rightX - leftX) / rect.width * 100) + '%';
            this.selectionDiv.style.display = 'block';
        } else {
            this.selectionDiv.style.display = 'none';
        }
    }

    splitAtPosition() {
        if (!this.audioBuffer) return;
        
        const success = this.chunkManager.splitAtPosition(this.seekPosition);
        if (!success) {
            alert('Split position must be within an existing chunk');
            return;
        }
        
        this.waveformRenderer.chunks = this.chunkManager.chunks;
        this.updateChunkInfo();
        this.updateDeleteButton();
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
    }

    delete() {
        if (this.selection.start !== this.selection.end) {
            // Delete selection
            const startTime = Math.min(this.selection.start, this.selection.end);
            const endTime = Math.max(this.selection.start, this.selection.end);
            
            this.deleteAudioRange(startTime, endTime);
            this.selection.start = 0;
            this.selection.end = 0;
            this.selectionDiv.style.display = 'none';
            
        } else if (this.chunkManager.selectedChunk) {
            // Delete selected chunk
            if (this.chunkManager.chunks.length <= 1) {
                alert('Cannot delete chunk - at least one chunk must remain');
                return;
            }
            
            this.deleteAudioRange(this.chunkManager.selectedChunk.start, this.chunkManager.selectedChunk.end);
            this.chunkManager.selectedChunk = null;
        }
        
        this.updateDeleteButton();
        this.updateSelectionInfo();
    }

    deleteAudioRange(startTime, endTime) {
        if (!this.audioBuffer) return;
        
        const sampleRate = this.audioBuffer.sampleRate;
        const channels = this.audioBuffer.numberOfChannels;
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const samplesToDelete = endSample - startSample;
        
        const newLength = this.audioBuffer.length - samplesToDelete;
        const newBuffer = this.audioContext.createBuffer(channels, newLength, sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const oldData = this.audioBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            
            // Copy before deleted range
            for (let i = 0; i < startSample; i++) {
                newData[i] = oldData[i];
            }
            
            // Copy after deleted range
            for (let i = endSample; i < oldData.length; i++) {
                newData[i - samplesToDelete] = oldData[i];
            }
        }
        
        this.audioBuffer = newBuffer;
        this.chunkManager.deleteTimeRange(startTime, endTime);
        this.waveformRenderer.chunks = this.chunkManager.chunks;
        
        this.waveformRenderer.generateWaveform(this.audioBuffer);
        this.updateDuration();
        this.updateChunkInfo();
        
        // Reset playback position if it's in deleted range
        const deleteDuration = endTime - startTime;
        if (this.audioPlayer.pausedAtTime >= startTime && this.audioPlayer.pausedAtTime <= endTime) {
            this.audioPlayer.pausedAtTime = startTime;
        } else if (this.audioPlayer.pausedAtTime > endTime) {
            this.audioPlayer.pausedAtTime -= deleteDuration;
        }
        
        this.seekPosition = this.audioPlayer.pausedAtTime;
    }

    async play() {
        if (this.audioPlayer.isPlaying) return;
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        if (this.selection.start !== this.selection.end) {
            await this.audioPlayer.playSelection(this.audioBuffer, this.selection);
        } else if (this.chunkManager.selectedChunk) {
            await this.audioPlayer.playChunk(this.audioBuffer, this.chunkManager.selectedChunk);
        } else {
            await this.audioPlayer.playAllChunks(this.audioBuffer, this.chunkManager.chunks);
        }
        
        this.playBtn.textContent = '⏸️ Pause';
        this.animateProgress();
    }

    togglePlayPause() {
        if (this.audioPlayer.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    pause() {
        if (!this.audioPlayer.isPlaying) return;
        
        this.audioPlayer.pause();
        this.playBtn.textContent = '▶️ Play';
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
    }

    stop() {
        this.audioPlayer.stop(this.chunkManager.chunks);
        this.playBtn.textContent = '▶️ Play';
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
    }

    animateProgress() {
        if (!this.audioPlayer.isPlaying) {
            // Reset play button when audio stops
            this.playBtn.textContent = '▶️ Play';
            return;
        }
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
        requestAnimationFrame(() => this.animateProgress());
    }

    async cropAudio() {
        let start, end;
        
        // Determine what to crop: region selection or selected chunk
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (hasRegionSelection) {
            start = Math.min(this.selection.start, this.selection.end);
            end = Math.max(this.selection.start, this.selection.end);
        } else if (hasChunkSelection) {
            start = this.chunkManager.selectedChunk.start;
            end = this.chunkManager.selectedChunk.end;
        } else {
            alert('Please select a portion of the audio to crop or select a chunk');
            return;
        }
        
        try {
            
            this.cropBtn.textContent = '🔄 Processing...';
            this.cropBtn.disabled = true;
            
            const sampleRate = this.audioBuffer.sampleRate;
            const channels = this.audioBuffer.numberOfChannels;
            const startFrame = Math.floor(start * sampleRate);
            const endFrame = Math.floor(end * sampleRate);
            const frameCount = endFrame - startFrame;
            
            const newBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
            
            for (let channel = 0; channel < channels; channel++) {
                const oldData = this.audioBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                
                for (let i = 0; i < frameCount; i++) {
                    newData[i] = oldData[startFrame + i] || 0;
                }
            }
            
            const wavArrayBuffer = AudioUtils.audioBufferToWav(newBuffer);
            const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
            const filename = `cropped_audio_${start.toFixed(1)}s-${end.toFixed(1)}s.wav`;
            
            AudioUtils.downloadBlob(blob, filename);
            
            this.cropBtn.textContent = '📏 Crop Selection';
            this.cropBtn.disabled = false;
            
            console.log(`Cropped audio: ${start.toFixed(2)}s to ${end.toFixed(2)}s`);
            
        } catch (error) {
            console.error('Error cropping audio:', error);
            alert('Error cropping audio. Please try again.');
            this.cropBtn.textContent = '📏 Crop Selection';
            this.cropBtn.disabled = false;
        }
    }

    updateSelectionInfo() {
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (!hasRegionSelection) {
            this.selectionInfo.textContent = 'No selection';
            this.cropBtn.disabled = !hasChunkSelection;
            this.updateFadeButtons();
            return;
        }
        
        // Drag selection (green) has priority - always allow it
        const start = AudioUtils.formatTime(this.selection.start);
        const end = AudioUtils.formatTime(this.selection.end);
        const duration = AudioUtils.formatTime(Math.abs(this.selection.end - this.selection.start));
        this.selectionInfo.textContent = `${start} - ${end} (${duration})`;
        this.cropBtn.disabled = false;
        this.updateFadeButtons();
    }

    updateDuration() {
        this.durationSpan.textContent = AudioUtils.formatTime(this.audioBuffer.duration);
    }

    updateCurrentTime() {
        if (!this.audioBuffer) return;
        const currentTime = this.audioPlayer.getCurrentPlaybackTime();
        this.currentTimeSpan.textContent = AudioUtils.formatTime(currentTime);
    }

    updateChunkInfo() {
        const chunkInfo = this.chunkManager.getChunkInfo();
        this.chunkCount.textContent = chunkInfo.count;
        
        if (chunkInfo.selected) {
            const duration = chunkInfo.selected.end - chunkInfo.selected.start;
            const info = `Chunk ${chunkInfo.selected.id + 1} | ${AudioUtils.formatTime(chunkInfo.selected.start)} - ${AudioUtils.formatTime(chunkInfo.selected.end)} | Duration: ${AudioUtils.formatTime(duration)}`;
            this.selectedChunkInfo.textContent = info;
            this.chunkInfo.style.display = 'block';
        } else {
            this.chunkInfo.style.display = 'none';
        }
    }

    updateDeleteButton() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        this.deleteBtn.disabled = !(hasSelection || hasChunkSelected);
    }

    enableControls() {
        this.playBtn.disabled = false;
        this.stopBtn.disabled = false;
        this.splitBtn.disabled = false;
        this.updateSelectionInfo();
        this.updateFadeButtons();
    }

    applyFadeIn() {
        if (this.selection.start === this.selection.end) {
            alert('Please select a region to apply fade in effect');
            return;
        }

        const startTime = Math.min(this.selection.start, this.selection.end);
        const endTime = Math.max(this.selection.start, this.selection.end);

        this.applyFadeEffect(startTime, endTime, 'in');
    }

    applyFadeOut() {
        if (this.selection.start === this.selection.end) {
            alert('Please select a region to apply fade out effect');
            return;
        }

        const startTime = Math.min(this.selection.start, this.selection.end);
        const endTime = Math.max(this.selection.start, this.selection.end);

        this.applyFadeEffect(startTime, endTime, 'out');
    }

    applyFadeEffect(startTime, endTime, type) {
        if (!this.audioBuffer) return;

        const sampleRate = this.audioBuffer.sampleRate;
        const channels = this.audioBuffer.numberOfChannels;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const fadeLength = endSample - startSample;

        // Create new buffer with same properties
        const newBuffer = this.audioContext.createBuffer(channels, this.audioBuffer.length, sampleRate);

        // Copy all audio data first
        for (let channel = 0; channel < channels; channel++) {
            const oldData = this.audioBuffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            
            // Copy all samples
            for (let i = 0; i < oldData.length; i++) {
                newData[i] = oldData[i];
            }

            // Apply fade effect to the selected region
            for (let i = startSample; i < endSample; i++) {
                const fadeProgress = (i - startSample) / fadeLength;
                let fadeMultiplier;

                if (type === 'in') {
                    // Fade in: start at 0, end at 1
                    fadeMultiplier = fadeProgress;
                } else {
                    // Fade out: start at 1, end at 0
                    fadeMultiplier = 1 - fadeProgress;
                }

                // Apply smooth curve (cosine interpolation)
                fadeMultiplier = 0.5 * (1 - Math.cos(fadeMultiplier * Math.PI));
                
                newData[i] = oldData[i] * fadeMultiplier;
            }
        }

        this.audioBuffer = newBuffer;
        this.waveformRenderer.generateWaveform(this.audioBuffer);
        
        // Clear selection after applying fade
        this.selection.start = 0;
        this.selection.end = 0;
        this.selectionDiv.style.display = 'none';
        this.updateSelectionInfo();
        this.updateDeleteButton();
        this.updateFadeButtons();
    }

    updateFadeButtons() {
        const hasSelection = this.selection.start !== this.selection.end;
        this.fadeInBtn.disabled = !hasSelection;
        this.fadeOutBtn.disabled = !hasSelection;
    }
}