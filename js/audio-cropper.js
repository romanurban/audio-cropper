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
        
        // Resize state
        this.isResizing = false;
        this.resizeHandle = null; // 'left' or 'right'
        this.resizeHandlesVisible = false;
        this.resizeHandleTimeout = null;
        this.minSelectionWidth = 0.1; // minimum selection width in seconds

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
        this.leftHandle = document.getElementById('leftHandle');
        this.rightHandle = document.getElementById('rightHandle');
        
        // Controls
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.splitBtn = document.getElementById('splitBtn');
        this.cropBtn = document.getElementById('cropBtn');
        this.fadeInBtn = document.getElementById('fadeInBtn');
        this.fadeOutBtn = document.getElementById('fadeOutBtn');
        this.normalizeBtn = document.getElementById('normalizeBtn');
        this.silenceBtn = document.getElementById('silenceBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        
        // Export popup elements
        this.exportPopupOverlay = document.getElementById('exportPopupOverlay');
        this.exportPopupClose = document.getElementById('exportPopupClose');
        this.exportCancel = document.getElementById('exportCancel');
        this.exportConfirm = document.getElementById('exportConfirm');
        this.bitrateSection = document.getElementById('bitrateSection');
        
        // Info displays
        this.durationSpan = document.getElementById('duration');
        this.currentTimeSpan = document.getElementById('currentTime');
        // Removed info elements
        // this.selectionInfo = document.getElementById('selectionInfo');
        // this.chunkCount = document.getElementById('chunkCount');
        // this.chunkInfo = document.getElementById('chunkInfo');
        // this.selectedChunkInfo = document.getElementById('selectedChunkInfo');
        this.playProgressPosition = null; // Removed from zoom bar
        this.hoverPosition = null; // Removed from zoom bar
        this.mousePositionTime = document.getElementById('mousePositionTime');
        this.selectionDuration = null; // Removed from zoom bar
        this.selectionStartTime = document.getElementById('selectionStartTime');
        this.selectionEndTime = document.getElementById('selectionEndTime');
        this.selectionDurationTime = document.getElementById('selectionDurationTime');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
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
        
        // Resize handles
        this.leftHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e, 'left'));
        this.rightHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e, 'right'));
        
        // Controls
        this.playBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.loopBtn.addEventListener('click', () => this.toggleLoop());
        this.splitBtn.addEventListener('click', () => this.splitAtPosition());
        this.cropBtn.addEventListener('click', () => this.showExportPopup());
        this.fadeInBtn.addEventListener('click', () => this.applyFadeIn());
        this.fadeOutBtn.addEventListener('click', () => this.applyFadeOut());
        this.normalizeBtn.addEventListener('click', () => this.applyNormalize());
        this.silenceBtn.addEventListener('click', () => this.applySilence());
        this.deleteBtn.addEventListener('click', () => this.delete());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        
        // Export popup event listeners
        this.exportPopupClose.addEventListener('click', () => this.hideExportPopup());
        this.exportCancel.addEventListener('click', () => this.hideExportPopup());
        this.exportConfirm.addEventListener('click', () => this.handleExportConfirm());
        this.exportPopupOverlay.addEventListener('click', (e) => {
            if (e.target === this.exportPopupOverlay) {
                this.hideExportPopup();
            }
        });
        
        // Format radio button change listener
        document.addEventListener('change', (e) => {
            if (e.target.name === 'format') {
                this.onFormatChange(e.target.value);
                this.updateSelectedStyles('format');
            } else if (e.target.name === 'bitrate') {
                this.updateSelectedStyles('bitrate');
            }
        });
        
        // Initialize MP3 worker
        this.mp3Worker = null;
        this.mp3WorkerReady = false;
        
        // Resize
        window.addEventListener('resize', () => this.waveformRenderer.resizeCanvas());
        
        // Click outside canvas to deselect chunks
        document.addEventListener('click', (e) => this.handleDocumentClick(e));
        
        // Global resize event listeners
        document.addEventListener('mousemove', (e) => this.handleResizeMove(e));
        document.addEventListener('mouseup', () => this.handleResizeEnd());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
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
    
    async loadSampleFile() {
        try {
            const response = await fetch('samples/stereo-test.mp3');
            if (!response.ok) {
                throw new Error('Sample file not found');
            }
            const arrayBuffer = await response.arrayBuffer();
            const file = new File([arrayBuffer], 'stereo-test.mp3', { type: 'audio/mpeg' });
            this.handleFile(file);
        } catch (error) {
            console.error('Error loading sample file:', error);
            alert('Error loading sample file. Please try uploading your own audio file.');
        }
    }

    async handleFile(file) {
        if (!file.type.startsWith('audio/')) {
            alert('Please select an audio file');
            // Reset upload area to full size for invalid files
            this.uploadArea.classList.remove('compact');
            this.resetUploadText();
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
            
            // Clear selection UI and resize handles
            this.selectionDiv.style.display = 'none';
            this.hideResizeHandles();
            if (this.resizeHandleTimeout) {
                clearTimeout(this.resizeHandleTimeout);
                this.resizeHandleTimeout = null;
            }
            
            // Initialize components with new audio
            this.chunkManager.initializeChunks(this.audioBuffer);
            this.waveformRenderer.chunks = this.chunkManager.chunks;
            
            // Update mouse event listeners to use scroll container after it's created
            this.updateMouseEventListeners();
            
            this.waveformContainer.style.display = 'block';
            
            // Make upload area compact when file is loaded
            this.uploadArea.classList.add('compact');
            
            // Update text for compact mode
            const uploadText = this.uploadArea.querySelector('.upload-text');
            uploadText.innerHTML = 'Drag & drop another audio file here or <span class="click-to-browse" onclick="document.getElementById(\'fileInput\').click()">click to browse</span>';
            
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
            
            // Reset upload area to full size on error
            this.uploadArea.classList.remove('compact');
            this.resetUploadText();
        }
    }

    updateProgress(percent) {
        this.progressBar.style.width = percent + '%';
    }

    resetUploadText() {
        const uploadText = this.uploadArea.querySelector('.upload-text');
        uploadText.innerHTML = 'Drag & drop an audio file here or <span class="click-to-browse" onclick="document.getElementById(\'fileInput\').click()">click to browse</span>';
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
        this.canvas.removeEventListener('mousemove', this.boundHoverMove);
        this.canvas.removeEventListener('mouseleave', this.boundHoverLeave);
        
        // Create bound handlers if they don't exist
        if (!this.boundMouseDown) {
            this.boundMouseDown = (e) => this.handleMouseDown(e);
            this.boundMouseMove = (e) => this.handleMouseMove(e);
            this.boundMouseUp = () => this.handleMouseUp();
            this.boundWaveformClick = (e) => this.handleWaveformClick(e);
            this.boundHoverMove = (e) => this.handleHoverMove(e);
            this.boundHoverLeave = () => this.handleHoverLeave();
        }
        
        // Always add listeners to the canvas directly for better coordinate handling
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseup', this.boundMouseUp);
        this.canvas.addEventListener('mouseleave', this.boundMouseUp);
        this.canvas.addEventListener('click', this.boundWaveformClick);
        
        // Add hover tracking listeners (separate from drag functionality)
        this.canvas.addEventListener('mousemove', this.boundHoverMove);
        this.canvas.addEventListener('mouseleave', this.boundHoverLeave);
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
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const clickTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Check if click is within existing selection
        const hasSelection = this.selection.start !== this.selection.end;
        const selectionStart = Math.min(this.selection.start, this.selection.end);
        const selectionEnd = Math.max(this.selection.start, this.selection.end);
        const clickInSelection = hasSelection && clickTime >= selectionStart && clickTime <= selectionEnd;
        
        // Don't clear selection if clicking within it
        if (clickInSelection) {
            return;
        }
        
        // Find which chunk was clicked based on time
        const selectedChunk = this.chunkManager.chunks.find(chunk => 
            clickTime >= chunk.start && clickTime <= chunk.end
        );
        
        if (selectedChunk) {
            // Clear drag selection when selecting a chunk (only if not clicking in selection)
            this.selection.start = 0;
            this.selection.end = 0;
            this.selectionDiv.style.display = 'none';
            
            // Hide resize handles and clear timeout
            this.hideResizeHandles();
            if (this.resizeHandleTimeout) {
                clearTimeout(this.resizeHandleTimeout);
                this.resizeHandleTimeout = null;
            }
            
            this.chunkManager.selectedChunk = selectedChunk;
            this.chunkManager.updateChunkOverlays();
            this.updateChunkInfo();
            this.updateDeleteButton();
            this.updateSelectionInfo();
            this.updateSelectionDuration();
            this.updateSelectionClock();
        }
    }

    handleMouseDown(event) {
        // Don't start dragging if we're resizing
        if (this.isResizing) return;
        
        // Get coordinates relative to the canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const clickTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Check if click is within existing selection
        const hasSelection = this.selection.start !== this.selection.end;
        const selectionStart = Math.min(this.selection.start, this.selection.end);
        const selectionEnd = Math.max(this.selection.start, this.selection.end);
        const clickInSelection = hasSelection && clickTime >= selectionStart && clickTime <= selectionEnd;
        
        // If clicking within selection, just reposition seek marker without starting new drag
        if (clickInSelection) {
            this.seekPosition = clickTime;
            // Redraw waveform to show updated seek position within selection
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
            
            // Reactivate resize handles when clicking within selection
            const selectionWidth = Math.abs(this.selection.end - this.selection.start);
            if (selectionWidth >= this.minSelectionWidth && !this.resizeHandlesVisible) {
                this.showResizeHandles();
            }
            
            // Enable split button only if we have a valid seek position in a chunk
            const seekChunk = this.chunkManager.chunks.find(chunk => 
                clickTime >= chunk.start && clickTime <= chunk.end
            );
            this.splitBtn.disabled = !seekChunk;
            return;
        }
        
        this.isDragging = true;
        this.dragStarted = false;
        
        // Clear existing selection when starting new drag
        this.selection.start = clickTime;
        this.selection.end = clickTime;
        this.seekPosition = clickTime;
        
        // Hide existing resize handles when starting new selection
        this.hideResizeHandles();
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
            this.resizeHandleTimeout = null;
        }
        
        // Enable split button only if we have a valid seek position in a chunk
        const seekChunk = this.chunkManager.chunks.find(chunk => 
            clickTime >= chunk.start && clickTime <= chunk.end
        );
        this.splitBtn.disabled = !seekChunk;
        
        this.initialClickTime = clickTime;
    }

    handleMouseMove(event) {
        if (!this.isDragging || this.isResizing) return;
        
        // Get coordinates relative to the canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        let currentTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Add snap-to-end functionality when dragging near canvas edges
        if (this.dragStarted && this.audioBuffer) {
            const snapThreshold = 30; // pixels from edge to trigger snap
            const canvasWidth = rect.width;
            
            // Snap to start (0) when dragging near left edge
            if (x <= snapThreshold) {
                currentTime = 0;
            }
            // Snap to end (duration) when dragging near right edge
            else if (x >= canvasWidth - snapThreshold) {
                currentTime = this.audioBuffer.duration;
            }
        }
        
        if (!this.dragStarted && Math.abs(currentTime - this.initialClickTime) > 0.1) {
            this.dragStarted = true;
            // Clear chunk selection when starting drag selection
            this.chunkManager.selectedChunk = null;
            this.chunkManager.updateChunkOverlays();
            this.updateChunkInfo();
        }
        
        if (this.dragStarted) {
            this.selection.end = currentTime;
            // Position seek marker and play progress line at the leftmost position of the selection
            this.seekPosition = Math.min(this.selection.start, this.selection.end);
            this.audioPlayer.pausedAtTime = this.seekPosition;
            this.updateSelectionDisplay();
            this.updateSelectionDuration();
            this.updateSelectionClock();
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
        } else {
            this.seekPosition = currentTime;
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
        }
    }

    handleMouseUp() {
        if (!this.isDragging || this.isResizing) return;
        
        if (!this.dragStarted) {
            // Check if click was within existing selection
            const hasSelection = this.selection.start !== this.selection.end;
            const selectionStart = Math.min(this.selection.start, this.selection.end);
            const selectionEnd = Math.max(this.selection.start, this.selection.end);
            const clickInSelection = hasSelection && this.initialClickTime >= selectionStart && this.initialClickTime <= selectionEnd;
            
            this.seekToTime(this.initialClickTime);
            this.seekPosition = this.initialClickTime;
            
            // Clear selection if clicking outside existing selection
            if (!clickInSelection) {
                this.selection.start = 0;
                this.selection.end = 0;
                this.selectionDiv.style.display = 'none';
                
                // Hide resize handles and clear timeout when clearing selection
                this.hideResizeHandles();
                if (this.resizeHandleTimeout) {
                    clearTimeout(this.resizeHandleTimeout);
                    this.resizeHandleTimeout = null;
                }
            }
            
            // Redraw waveform
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
            
            this.updateSelectionInfo();
            this.updateSelectionDuration();
            this.updateSelectionClock();
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

    handleResizeStart(event, handle) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isResizing = true;
        this.resizeHandle = handle;
        
        // Add visual feedback
        document.body.style.cursor = 'ew-resize';
        this.selectionDiv.style.userSelect = 'none';
        
        console.log(`Started resizing ${handle} handle`);
    }

    handleResizeMove(event) {
        if (!this.isResizing || !this.audioBuffer) return;
        
        // Get coordinates relative to the canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const currentTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Clamp to audio bounds
        const clampedTime = Math.max(0, Math.min(currentTime, this.audioBuffer.duration));
        
        if (this.resizeHandle === 'left') {
            // Resize from left edge - update start time
            const maxStart = this.selection.end - this.minSelectionWidth;
            this.selection.start = Math.min(clampedTime, maxStart);
        } else if (this.resizeHandle === 'right') {
            // Resize from right edge - update end time
            const minEnd = this.selection.start + this.minSelectionWidth;
            this.selection.end = Math.max(clampedTime, minEnd);
        }
        
        // Update visual display
        this.updateSelectionDisplay();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
    }

    handleResizeEnd() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.resizeHandle = null;
        
        // Remove visual feedback
        document.body.style.cursor = '';
        this.selectionDiv.style.userSelect = '';
        
        // Update seek position to start of selection
        this.seekPosition = Math.min(this.selection.start, this.selection.end);
        this.audioPlayer.pausedAtTime = this.seekPosition;
        
        console.log('Finished resizing selection');
    }

    showResizeHandles() {
        if (this.selection.start === this.selection.end) return;
        
        const selectionWidth = Math.abs(this.selection.end - this.selection.start);
        if (selectionWidth < this.minSelectionWidth) return;
        
        this.selectionDiv.classList.add('resizable', 'show-handles');
        this.resizeHandlesVisible = true;
        console.log('Resize handles shown');
    }

    hideResizeHandles() {
        this.selectionDiv.classList.remove('resizable', 'show-handles');
        this.resizeHandlesVisible = false;
        console.log('Resize handles hidden');
    }

    scheduleResizeHandles() {
        // Clear any existing timeout
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
        }
        
        // Check if selection is wide enough for resize handles
        const selectionWidth = Math.abs(this.selection.end - this.selection.start);
        if (selectionWidth >= this.minSelectionWidth) {
            // Schedule resize handles to appear after 800ms delay
            this.resizeHandleTimeout = setTimeout(() => {
                this.showResizeHandles();
            }, 800);
        }
    }

    handleHoverMove(event) {
        if (!this.audioBuffer) return;
        
        // Get coordinates relative to the canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const hoverTime = this.waveformRenderer.getTimeFromMousePosition(x);
        
        // Only show hover position if it's within audio bounds
        if (hoverTime >= 0 && hoverTime <= this.audioBuffer.duration) {
            // Update zoom bar hover position (if element exists)
            if (this.hoverPosition) {
                this.hoverPosition.textContent = `🎯 ${AudioUtils.formatTime(hoverTime)}`;
                this.hoverPosition.style.display = 'block';
            }
            
            // Update main digital time display mouse position
            this.mousePositionTime.textContent = AudioUtils.formatTimeWithMilliseconds(hoverTime);
        } else {
            if (this.hoverPosition) {
                this.hoverPosition.style.display = 'none';
            }
            // Keep mouse position showing, don't hide it
        }
    }

    handleHoverLeave() {
        // Keep showing the last hover position when mouse leaves
        // this.hoverPosition.style.display = 'none';
        // this.mousePositionTime.style.display = 'none';
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
        
        // Position seek pointer and play progress line at the beginning of the selected area
        this.seekPosition = this.selection.start;
        this.audioPlayer.pausedAtTime = this.selection.start;
        
        // Allow drag selection to span across any part of the waveform
        
        this.updateSelectionInfo();
        this.updateSelectionDisplay();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        
        // Schedule resize handles to appear with delay
        this.scheduleResizeHandles();
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
                this.updateSelectionDuration();
                this.updateSelectionClock();
            }
        }
    }

    handleKeyDown(event) {
        // Ignore shortcuts when typing in inputs
        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        )) {
            return;
        }

        // Check if audio is loaded
        if (!this.audioBuffer || !this.audioPlayer) {
            return;
        }

        // Check if currently processing (crop operation)
        if (this.cropBtn.disabled) {
            return;
        }

        switch (event.code) {
            case 'Space':
                if (event.shiftKey) {
                    // Shift+Space: Play from selection start
                    this.playFromSelectionStart();
                } else {
                    // Space: Toggle play/pause
                    this.togglePlayPause();
                }
                event.preventDefault(); // Prevent page scroll
                break;
                
            case 'Escape':
                // Escape: Stop playback and clear selection
                this.stop();
                this.clearSelection();
                event.preventDefault();
                break;
                
            case 'KeyS':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+S: Split at current position
                    this.splitAtPosition();
                    event.preventDefault();
                }
                break;
                
            case 'KeyL':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+L: Toggle loop
                    this.toggleLoop();
                    event.preventDefault();
                }
                break;
                
            case 'Delete':
            case 'Backspace':
                // Delete/Backspace: Delete selection or selected chunk
                if (this.selection.start !== this.selection.end || this.chunkManager.selectedChunk) {
                    this.delete();
                    event.preventDefault();
                }
                break;
                
            case 'KeyA':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+A: Select all audio
                    this.selectAll();
                    event.preventDefault();
                }
                break;
                
            case 'KeyE':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+E: Export/Crop selection
                    this.cropAudio();
                    event.preventDefault();
                }
                break;
                
            case 'ArrowLeft':
                // Left arrow: Seek backward
                if (event.shiftKey) {
                    this.seekRelative(-5); // 5 seconds
                } else {
                    this.seekRelative(-1); // 1 second
                }
                event.preventDefault();
                break;
                
            case 'ArrowRight':
                // Right arrow: Seek forward
                if (event.shiftKey) {
                    this.seekRelative(5); // 5 seconds
                } else {
                    this.seekRelative(1); // 1 second
                }
                event.preventDefault();
                break;
                
            case 'Home':
                // Home: Go to beginning
                this.seekToTime(0);
                event.preventDefault();
                break;
                
            case 'End':
                // End: Go to end
                if (this.audioBuffer) {
                    this.seekToTime(this.audioBuffer.duration);
                }
                event.preventDefault();
                break;
                
            case 'KeyF':
                if (event.metaKey || event.ctrlKey) {
                    if (event.shiftKey) {
                        // Cmd/Ctrl+Shift+F: Fade out
                        this.applyFadeOut();
                    } else {
                        // Cmd/Ctrl+F: Fade in
                        this.applyFadeIn();
                    }
                    event.preventDefault();
                }
                break;
                
            case 'KeyN':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+N: Normalize
                    this.applyNormalize();
                    event.preventDefault();
                }
                break;
                
            case 'KeyM':
                if (event.metaKey || event.ctrlKey) {
                    // Cmd/Ctrl+M: Apply silence (mute)
                    this.applySilence();
                    event.preventDefault();
                }
                break;
                
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
            case 'Digit5':
            case 'Digit6':
            case 'Digit7':
            case 'Digit8':
            case 'Digit9':
                // Number keys 1-9: Jump to 10%-90% of audio
                if (!event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                    const percentage = parseInt(event.code.slice(-1)) / 10;
                    const targetTime = this.audioBuffer.duration * percentage;
                    this.seekToTime(targetTime);
                    event.preventDefault();
                }
                break;
                
            case 'Digit0':
                // 0: Jump to beginning
                if (!event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                    this.seekToTime(0);
                    event.preventDefault();
                }
                break;
                
            case 'KeyH':
            case 'Slash':
                // H or ?: Show keyboard shortcuts help
                if ((event.code === 'KeyH' && !event.shiftKey) || 
                    (event.code === 'Slash' && event.shiftKey)) {
                    this.showKeyboardShortcuts();
                    event.preventDefault();
                }
                break;
        }
    }

    updateSelectionDisplay() {
        if (!this.audioBuffer || this.chunkManager.chunks.length === 0) return;
        
        // When zoomed, use canvas-based coordinate system
        if (this.waveformRenderer.zoomLevel > 1.0) {
            const startX = this.waveformRenderer.getPixelPositionForTimeZoomed(this.selection.start);
            const endX = this.waveformRenderer.getPixelPositionForTimeZoomed(this.selection.end);
            
            if (startX >= 0 && endX >= 0) {
                const leftX = Math.min(startX, endX);
                const width = Math.max(1, Math.abs(endX - startX));
                
                // Position in content coordinates; the scroller will clip/scroll it
                this.selectionDiv.style.left = `${leftX}px`;
                this.selectionDiv.style.width = `${width}px`;
                this.selectionDiv.style.display = 'block';
            } else {
                this.selectionDiv.style.display = 'none';
            }
            return;
        }
        
        // When not zoomed, use the original chunk-based rendering
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
            
            // Hide resize handles and clear timeout
            this.hideResizeHandles();
            if (this.resizeHandleTimeout) {
                clearTimeout(this.resizeHandleTimeout);
                this.resizeHandleTimeout = null;
            }
            
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
        this.updateSelectionDuration();
        this.updateSelectionClock();
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
        
        this.playBtn.textContent = '⏸︎';
        this.playBtn.setAttribute('data-pause', 'true');
        this.animateProgress();
    }

    togglePlayPause() {
        if (this.audioPlayer.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async playFromSelectionStart() {
        // If there's a selection, seek to its start and play
        if (this.selection.start !== this.selection.end) {
            const selectionStart = Math.min(this.selection.start, this.selection.end);
            await this.seekToTime(selectionStart);
            if (!this.audioPlayer.isPlaying) {
                await this.play();
            }
        } else {
            // No selection - just toggle play/pause
            this.togglePlayPause();
        }
    }

    selectAll() {
        if (!this.audioBuffer) return;
        
        // Select entire audio duration
        this.selection.start = 0;
        this.selection.end = this.audioBuffer.duration;
        this.seekPosition = 0;
        this.audioPlayer.pausedAtTime = 0;
        
        // Clear chunk selection
        this.chunkManager.selectedChunk = null;
        this.chunkManager.updateChunkOverlays();
        
        // Update UI
        this.updateSelectionDisplay();
        this.updateSelectionInfo();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        this.updateFadeButtons();
        this.updateNormalizeButton();
        this.updateSilenceButton();
        
        // Schedule resize handles
        this.scheduleResizeHandles();
        
        // Redraw waveform
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime(), this.selection);
    }

    async seekRelative(deltaSeconds) {
        if (!this.audioBuffer) return;
        
        const currentTime = this.seekPosition;
        const newTime = Math.max(0, Math.min(currentTime + deltaSeconds, this.audioBuffer.duration));
        await this.seekToTime(newTime);
    }

    showExportPopup() {
        this.exportPopupOverlay.style.display = 'flex';
        // Reset to WAV format by default
        document.querySelector('input[name="format"][value="wav"]').checked = true;
        this.onFormatChange('wav');
        
        // Update selected styles
        this.updateSelectedStyles('format');
        this.updateSelectedStyles('bitrate');
        
        // Focus the first radio button for accessibility
        setTimeout(() => {
            document.querySelector('input[name="format"][value="wav"]').focus();
        }, 100);
        
        // Add escape key listener
        this.popupKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideExportPopup();
            }
        };
        document.addEventListener('keydown', this.popupKeyHandler);
    }

    hideExportPopup() {
        this.exportPopupOverlay.style.display = 'none';
        
        // Remove escape key listener
        if (this.popupKeyHandler) {
            document.removeEventListener('keydown', this.popupKeyHandler);
            this.popupKeyHandler = null;
        }
    }

    onFormatChange(format) {
        if (format === 'mp3') {
            this.bitrateSection.style.display = 'block';
            this.initMp3Worker();
        } else {
            this.bitrateSection.style.display = 'none';
        }
    }

    updateSelectedStyles(inputName) {
        // Remove selected class from all options of this type
        const optionClass = inputName === 'format' ? 'format-option' : 'bitrate-option';
        document.querySelectorAll(`.${optionClass}`).forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to the checked option
        const checkedInput = document.querySelector(`input[name="${inputName}"]:checked`);
        if (checkedInput) {
            checkedInput.closest(`.${optionClass}`).classList.add('selected');
        }
    }

    async handleExportConfirm() {
        const format = document.querySelector('input[name="format"]:checked').value;
        let bitrate = 192; // default
        
        if (format === 'mp3') {
            const bitrateInput = document.querySelector('input[name="bitrate"]:checked');
            if (bitrateInput) {
                bitrate = parseInt(bitrateInput.value);
            } else {
                // No bitrate selected, show error
                alert('Please select an MP3 quality setting.');
                return;
            }
        }
        
        // Disable export button to prevent double-clicking
        this.exportConfirm.disabled = true;
        this.exportConfirm.textContent = 'Exporting...';
        
        try {
            this.hideExportPopup();
            await this.exportAudio(format, bitrate);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            // Re-enable export button
            this.exportConfirm.disabled = false;
            this.exportConfirm.textContent = 'Export';
        }
    }

    async initMp3Worker() {
        if (this.mp3Worker || this.mp3WorkerReady) return;

        try {
            this.mp3Worker = new Worker('js/workers/mp3-encoder-worker.js');
            
            // Set up worker message handling
            this.mp3Worker.onmessage = (e) => this.handleMp3WorkerMessage(e);
            this.mp3Worker.onerror = (error) => {
                console.error('MP3 Worker error:', error);
                this.mp3WorkerReady = false;
            };

            // Initialize the worker
            await this.sendMp3WorkerMessage('init');
            this.mp3WorkerReady = true;
            console.log('MP3 encoder worker initialized');
            
        } catch (error) {
            console.error('Failed to initialize MP3 worker:', error);
            this.mp3Worker = null;
            this.mp3WorkerReady = false;
        }
    }

    sendMp3WorkerMessage(type, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.mp3Worker) {
                reject(new Error('MP3 worker not initialized'));
                return;
            }

            const id = Math.random().toString(36).substr(2, 9);
            
            const timeout = setTimeout(() => {
                reject(new Error('MP3 worker timeout'));
            }, 30000); // 30 second timeout

            const handleResponse = (e) => {
                if (e.data.id === id) {
                    clearTimeout(timeout);
                    this.mp3Worker.removeEventListener('message', handleResponse);
                    
                    if (e.data.success) {
                        resolve(e.data);
                    } else {
                        reject(new Error(e.data.error || 'MP3 encoding failed'));
                    }
                }
            };

            this.mp3Worker.addEventListener('message', handleResponse);
            this.mp3Worker.postMessage({ type, id, ...data });
        });
    }

    handleMp3WorkerMessage(e) {
        const { type } = e.data;
        
        switch (type) {
            case 'progress':
                this.updateEncodingProgress(e.data.progress);
                break;
            case 'error':
                console.error('MP3 encoding error:', e.data.error);
                this.hideEncodingProgress();
                break;
        }
    }

    updateEncodingProgress(progress) {
        // Update progress display (we'll implement this next)
        if (this.progressBar) {
            this.progressBar.style.width = progress + '%';
        }
    }

    hideEncodingProgress() {
        if (this.progress) {
            this.progress.style.display = 'none';
        }
    }

    showKeyboardShortcuts() {
        const shortcuts = `
🎵 Audio Editor - Keyboard Shortcuts

PLAYBACK:
• Space - Toggle play/pause
• Shift+Space - Play from selection start
• Escape - Stop and clear selection
• Ctrl/Cmd+L - Toggle loop mode

NAVIGATION:
• ← → - Seek 1 second backward/forward
• Shift+← → - Seek 5 seconds backward/forward
• Home - Go to beginning
• End - Go to end
• 0-9 - Jump to 0%-90% of audio

EDITING:
• Ctrl/Cmd+A - Select all audio
• Ctrl/Cmd+S - Split at current position
• Delete/Backspace - Delete selection or chunk
• Ctrl/Cmd+E - Export selection (WAV/MP3)

EFFECTS:
• Ctrl/Cmd+F - Apply fade in
• Ctrl/Cmd+Shift+F - Apply fade out
• Ctrl/Cmd+N - Normalize audio
• Ctrl/Cmd+M - Apply silence (mute)

HELP:
• H or ? - Show this help
        `;
        
        alert(shortcuts);
    }

    toggleLoop() {
        if (!this.audioPlayer) return;
        
        const isLooping = this.audioPlayer.toggleLoop();
        this.updateLoopButton(isLooping);
        console.log(`Loop ${isLooping ? 'enabled' : 'disabled'}`);
    }

    updateLoopButton(isLooping) {
        if (isLooping) {
            this.loopBtn.classList.add('active');
            this.loopBtn.style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.6), rgba(69, 160, 73, 0.5))';
            this.loopBtn.style.borderColor = '#4CAF50';
            this.loopBtn.style.color = '#ffffff';
            this.loopBtn.style.boxShadow = '0 0 16px rgba(76, 175, 80, 0.8), inset 0 1px 2px rgba(76, 175, 80, 0.5)';
        } else {
            this.loopBtn.classList.remove('active');
            this.loopBtn.style.background = '';
            this.loopBtn.style.borderColor = '';
            this.loopBtn.style.color = '';
            this.loopBtn.style.boxShadow = '';
        }
    }

    pause() {
        if (!this.audioPlayer.isPlaying) return;
        
        this.audioPlayer.pause();
        this.playBtn.textContent = '▷';
        this.playBtn.removeAttribute('data-pause');
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
    }

    stop() {
        this.audioPlayer.stop(this.chunkManager.chunks);
        this.playBtn.textContent = '▷';
        this.playBtn.removeAttribute('data-pause');
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
    }

    animateProgress() {
        if (!this.audioPlayer.isPlaying) {
            // Reset play button when audio stops
            this.playBtn.textContent = '▷';
            this.playBtn.removeAttribute('data-pause');
            if (this.playProgressPosition) {
                this.playProgressPosition.style.display = 'none';
            }
            return;
        }
        
        this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        this.updateCurrentTime();
        requestAnimationFrame(() => this.animateProgress());
    }

    async exportAudio(format = 'wav', bitrate = 192) {
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
            // No selection - download entire audio file
            start = 0;
            end = this.audioBuffer.duration;
        }
        
        // Format and bitrate are now passed as parameters
        
        try {
            this.cropBtn.disabled = true;
            this.progress.style.display = 'block';
            this.updateProgress(0);
            
            const sampleRate = this.audioBuffer.sampleRate;
            const channels = this.audioBuffer.numberOfChannels;
            const startFrame = Math.floor(start * sampleRate);
            const endFrame = Math.floor(end * sampleRate);
            const frameCount = endFrame - startFrame;
            
            // Extract audio data for the selected region
            const audioChannels = [];
            for (let channel = 0; channel < channels; channel++) {
                const channelData = new Float32Array(frameCount);
                const sourceData = this.audioBuffer.getChannelData(channel);
                
                for (let i = 0; i < frameCount; i++) {
                    channelData[i] = sourceData[startFrame + i] || 0;
                }
                audioChannels.push(channelData);
            }
            
            let blob, filename, mimeType;
            
            if (format === 'mp3') {
                // MP3 Export
                this.updateProgress(25);
                
                if (!this.mp3WorkerReady) {
                    await this.initMp3Worker();
                }
                
                // Use the passed bitrate parameter
                const result = await this.sendMp3WorkerMessage('encode', {
                    channels: audioChannels,
                    sampleRate,
                    bitrate
                });
                
                this.updateProgress(90);
                
                blob = new Blob([result.data], { type: 'audio/mpeg' });
                mimeType = 'audio/mpeg';
                
                // Generate filename
                if (hasRegionSelection || hasChunkSelection) {
                    filename = `cropped_audio_${start.toFixed(1)}s-${end.toFixed(1)}s_${bitrate}kbps.mp3`;
                } else {
                    filename = `audio_export_${new Date().getTime()}_${bitrate}kbps.mp3`;
                }
                
            } else {
                // WAV Export (existing logic)
                this.updateProgress(50);
                
                const newBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
                
                for (let channel = 0; channel < channels; channel++) {
                    const newData = newBuffer.getChannelData(channel);
                    newData.set(audioChannels[channel]);
                }
                
                this.updateProgress(75);
                
                const wavArrayBuffer = AudioUtils.audioBufferToWav(newBuffer);
                blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
                mimeType = 'audio/wav';
                
                // Generate filename
                if (hasRegionSelection || hasChunkSelection) {
                    filename = `cropped_audio_${start.toFixed(1)}s-${end.toFixed(1)}s.wav`;
                } else {
                    filename = `audio_export_${new Date().getTime()}.wav`;
                }
            }
            
            this.updateProgress(100);
            
            AudioUtils.downloadBlob(blob, filename);
            
            console.log(`Exported ${format.toUpperCase()} audio: ${start.toFixed(2)}s to ${end.toFixed(2)}s`);
            
            // Hide progress after a short delay
            setTimeout(() => {
                this.progress.style.display = 'none';
                this.cropBtn.disabled = false;
            }, 500);
            
        } catch (error) {
            console.error('Error exporting audio:', error);
            alert(`Error exporting ${format.toUpperCase()} audio. Please try again.`);
            this.progress.style.display = 'none';
            this.cropBtn.disabled = false;
        }
    }

    updateSelectionInfo() {
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (!hasRegionSelection) {
            // this.selectionInfo.textContent = 'No selection';
            this.cropBtn.disabled = false; // Always enable crop button when audio is loaded
            this.updateFadeButtons();
            this.updateNormalizeButton();
            this.updateSilenceButton();
            return;
        }
        
        // Drag selection (green) has priority - always allow it
        const start = AudioUtils.formatTime(this.selection.start);
        const end = AudioUtils.formatTime(this.selection.end);
        const duration = AudioUtils.formatTime(Math.abs(this.selection.end - this.selection.start));
        // this.selectionInfo.textContent = `${start} - ${end} (${duration})`;
        this.cropBtn.disabled = false;
        this.updateFadeButtons();
        this.updateNormalizeButton();
        this.updateSilenceButton();
    }

    updateSelectionDuration() {
        // This method is kept for compatibility but the zoom bar element was removed
        if (!this.selectionDuration) return;
        
        const hasRegionSelection = this.selection.start !== this.selection.end;
        
        if (!hasRegionSelection) {
            this.selectionDuration.textContent = '';
            this.selectionDuration.style.display = 'none';
            return;
        }
        
        const duration = Math.abs(this.selection.end - this.selection.start);
        this.selectionDuration.textContent = `📏 ${AudioUtils.formatTime(duration)}`;
        this.selectionDuration.style.display = 'block';
    }

    updateSelectionClock() {
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        
        if (!hasRegionSelection && !hasChunkSelected) {
            // Clear selection display when nothing is selected
            this.selectionStartTime.textContent = '-';
            this.selectionEndTime.textContent = '-';
            this.selectionDurationTime.textContent = '-';
            return;
        }
        
        let startTime, endTime, duration;
        
        if (hasRegionSelection) {
            // Show region selection times (drag selection takes priority)
            startTime = Math.min(this.selection.start, this.selection.end);
            endTime = Math.max(this.selection.start, this.selection.end);
            duration = endTime - startTime;
        } else if (hasChunkSelected) {
            // Show selected chunk times
            startTime = this.chunkManager.selectedChunk.start;
            endTime = this.chunkManager.selectedChunk.end;
            duration = endTime - startTime;
        }
        
        // Update persistent selection info block
        this.selectionStartTime.textContent = AudioUtils.formatTimeWithMilliseconds(startTime);
        this.selectionEndTime.textContent = AudioUtils.formatTimeWithMilliseconds(endTime);
        this.selectionDurationTime.textContent = AudioUtils.formatTimeWithMilliseconds(duration);
    }

    updateDuration() {
        if (this.durationSpan && this.audioBuffer) {
            this.durationSpan.textContent = AudioUtils.formatTimeWithMilliseconds(this.audioBuffer.duration);
        }
    }

    updateCurrentTime() {
        if (!this.audioBuffer) return;
        const currentTime = this.audioPlayer.getCurrentPlaybackTime();
        if (this.currentTimeSpan) {
            this.currentTimeSpan.textContent = AudioUtils.formatTimeWithMilliseconds(currentTime);
        }
        this.updatePlayProgressPosition(currentTime);
    }

    updatePlayProgressPosition(currentTime) {
        if (!this.audioBuffer || !this.playProgressPosition) return;
        
        if (this.audioPlayer.isPlaying) {
            this.playProgressPosition.textContent = `▶️ ${AudioUtils.formatTime(currentTime)}`;
            this.playProgressPosition.style.display = 'block';
        } else {
            this.playProgressPosition.style.display = 'none';
        }
    }

    updateChunkInfo() {
        // Chunk info display removed - method kept for compatibility
        // const chunkInfo = this.chunkManager.getChunkInfo();
        // this.chunkCount.textContent = chunkInfo.count;
        
        // if (chunkInfo.selected) {
        //     const duration = chunkInfo.selected.end - chunkInfo.selected.start;
        //     const info = `Chunk ${chunkInfo.selected.id + 1} | ${AudioUtils.formatTime(chunkInfo.selected.start)} - ${AudioUtils.formatTime(chunkInfo.selected.end)} | Duration: ${AudioUtils.formatTime(duration)}`;
        //     this.selectedChunkInfo.textContent = info;
        //     this.chunkInfo.style.display = 'block';
        // } else {
        //     this.chunkInfo.style.display = 'none';
        // }
    }

    updateDeleteButton() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        this.deleteBtn.disabled = !(hasSelection || hasChunkSelected);
    }

    enableControls() {
        this.playBtn.disabled = false;
        this.stopBtn.disabled = false;
        this.loopBtn.disabled = false;
        this.splitBtn.disabled = false;
        this.updateSelectionInfo();
        this.updateFadeButtons();
        this.updateNormalizeButton();
        this.updateSilenceButton();
    }

    applyFadeIn() {
        let startTime, endTime;
        
        // Determine what to apply fade to: region selection or selected chunk
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (hasRegionSelection) {
            startTime = Math.min(this.selection.start, this.selection.end);
            endTime = Math.max(this.selection.start, this.selection.end);
        } else if (hasChunkSelection) {
            startTime = this.chunkManager.selectedChunk.start;
            endTime = this.chunkManager.selectedChunk.end;
        } else {
            alert('Please select a region or chunk to apply fade in effect');
            return;
        }

        this.applyFadeEffect(startTime, endTime, 'in');
    }

    applyFadeOut() {
        let startTime, endTime;
        
        // Determine what to apply fade to: region selection or selected chunk
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (hasRegionSelection) {
            startTime = Math.min(this.selection.start, this.selection.end);
            endTime = Math.max(this.selection.start, this.selection.end);
        } else if (hasChunkSelection) {
            startTime = this.chunkManager.selectedChunk.start;
            endTime = this.chunkManager.selectedChunk.end;
        } else {
            alert('Please select a region or chunk to apply fade out effect');
            return;
        }

        this.applyFadeEffect(startTime, endTime, 'out');
    }

    applyNormalize() {
        let startTime, endTime;
        
        // Determine what to apply normalize to: region selection or selected chunk
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (hasRegionSelection) {
            startTime = Math.min(this.selection.start, this.selection.end);
            endTime = Math.max(this.selection.start, this.selection.end);
        } else if (hasChunkSelection) {
            startTime = this.chunkManager.selectedChunk.start;
            endTime = this.chunkManager.selectedChunk.end;
        } else {
            alert('Please select a region or chunk to apply normalize effect');
            return;
        }

        this.applyNormalizeEffect(startTime, endTime);
    }

    applySilence() {
        let startTime, endTime;
        
        // Determine what to apply silence to: region selection or selected chunk
        const hasRegionSelection = this.selection.start !== this.selection.end;
        const hasChunkSelection = this.chunkManager.selectedChunk !== null;
        
        if (hasRegionSelection) {
            startTime = Math.min(this.selection.start, this.selection.end);
            endTime = Math.max(this.selection.start, this.selection.end);
        } else if (hasChunkSelection) {
            startTime = this.chunkManager.selectedChunk.start;
            endTime = this.chunkManager.selectedChunk.end;
        } else {
            alert('Please select a region or chunk to apply silence effect');
            return;
        }

        this.applySilenceEffect(startTime, endTime);
    }

    applySilenceEffect(startTime, endTime) {
        if (!this.audioBuffer) return;

        const sampleRate = this.audioBuffer.sampleRate;
        const channels = this.audioBuffer.numberOfChannels;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

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

            // Apply silence to the selected region (set to zero)
            for (let i = startSample; i < endSample; i++) {
                newData[i] = 0;
            }
        }

        this.audioBuffer = newBuffer;
        this.waveformRenderer.generateWaveform(this.audioBuffer);
        
        // Clear selection after applying silence
        this.selection.start = 0;
        this.selection.end = 0;
        this.selectionDiv.style.display = 'none';
        
        // Clear chunk selection after applying silence
        this.chunkManager.selectedChunk = null;
        this.chunkManager.updateChunkOverlays();
        
        // Hide resize handles and clear timeout
        this.hideResizeHandles();
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
            this.resizeHandleTimeout = null;
        }
        
        this.updateSelectionInfo();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        this.updateFadeButtons();
        this.updateSilenceButton();
        this.updateSilenceButton();
        this.updateChunkInfo();
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
        
        // Clear chunk selection after applying fade
        this.chunkManager.selectedChunk = null;
        this.chunkManager.updateChunkOverlays();
        
        // Hide resize handles and clear timeout
        this.hideResizeHandles();
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
            this.resizeHandleTimeout = null;
        }
        
        this.updateSelectionInfo();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        this.updateFadeButtons();
        this.updateSilenceButton();
        this.updateSilenceButton();
        this.updateChunkInfo();
    }

    applyNormalizeEffect(startTime, endTime) {
        if (!this.audioBuffer) return;

        this.audioBuffer = AudioUtils.normalizeAudio(this.audioBuffer, startTime, endTime, this.audioContext);
        this.waveformRenderer.generateWaveform(this.audioBuffer);
        
        // Clear selection after applying normalize
        this.selection.start = 0;
        this.selection.end = 0;
        this.selectionDiv.style.display = 'none';
        
        // Clear chunk selection after applying normalize
        this.chunkManager.selectedChunk = null;
        this.chunkManager.updateChunkOverlays();
        
        // Hide resize handles and clear timeout
        this.hideResizeHandles();
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
            this.resizeHandleTimeout = null;
        }
        
        this.updateSelectionInfo();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        this.updateFadeButtons();
        this.updateNormalizeButton();
        this.updateSilenceButton();
        this.updateChunkInfo();
    }

    updateFadeButtons() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        this.fadeInBtn.disabled = !(hasSelection || hasChunkSelected);
        this.fadeOutBtn.disabled = !(hasSelection || hasChunkSelected);
    }

    updateNormalizeButton() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        this.normalizeBtn.disabled = !(hasSelection || hasChunkSelected);
    }

    updateSilenceButton() {
        const hasSelection = this.selection.start !== this.selection.end;
        const hasChunkSelected = this.chunkManager.selectedChunk !== null;
        this.silenceBtn.disabled = !(hasSelection || hasChunkSelected);
    }

    clearSelection() {
        this.selection.start = 0;
        this.selection.end = 0;
        this.selectionDiv.style.display = 'none';
        
        // Hide resize handles and clear timeout
        this.hideResizeHandles();
        if (this.resizeHandleTimeout) {
            clearTimeout(this.resizeHandleTimeout);
            this.resizeHandleTimeout = null;
        }
        
        this.updateSelectionInfo();
        this.updateSelectionDuration();
        this.updateSelectionClock();
        this.updateDeleteButton();
        this.updateFadeButtons();
        this.updateNormalizeButton();
        this.updateSilenceButton();
        
        // Redraw waveform to clear selection
        if (this.audioBuffer) {
            this.waveformRenderer.drawWaveform(this.audioBuffer, this.seekPosition, this.audioPlayer.getCurrentPlaybackTime());
        }
    }

    // Cleanup method for when the editor is destroyed
    destroy() {
        if (this.mp3Worker) {
            this.mp3Worker.terminate();
            this.mp3Worker = null;
            this.mp3WorkerReady = false;
        }
        
        // Clean up popup key handler
        if (this.popupKeyHandler) {
            document.removeEventListener('keydown', this.popupKeyHandler);
            this.popupKeyHandler = null;
        }
    }
}