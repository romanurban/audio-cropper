/**
 * Manages undo/redo history for the audio editor
 */

export class HistoryManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
    }

    /**
     * Saves current state to history
     * @param {Object} state - Current state snapshot
     * @param {string} action - Description of the action
     */
    saveState(state, action) {
        // Remove any history after current position when adding new state
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // Create deep copy of state
        const stateCopy = this.deepCopyState(state);
        
        // Add action description
        stateCopy.action = action;
        stateCopy.timestamp = Date.now();
        
        // Add to history
        this.history.push(stateCopy);
        this.currentIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }
        
        console.log(`History: Saved state "${action}" (${this.currentIndex + 1}/${this.history.length})`);
    }

    /**
     * Undoes the last action
     * @returns {Object|null} Previous state or null if no undo available
     */
    undo() {
        if (!this.canUndo()) {
            return null;
        }
        
        this.currentIndex--;
        const state = this.history[this.currentIndex];
        console.log(`History: Undoing "${this.history[this.currentIndex + 1].action}" -> "${state.action}"`);
        return this.deepCopyState(state);
    }

    /**
     * Redoes the next action
     * @returns {Object|null} Next state or null if no redo available
     */
    redo() {
        if (!this.canRedo()) {
            return null;
        }
        
        this.currentIndex++;
        const state = this.history[this.currentIndex];
        console.log(`History: Redoing "${state.action}"`);
        return this.deepCopyState(state);
    }

    /**
     * Checks if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Checks if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Gets the current action description
     * @returns {string}
     */
    getCurrentAction() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.history[this.currentIndex].action;
        }
        return 'Initial state';
    }

    /**
     * Gets the next undo action description
     * @returns {string|null}
     */
    getUndoAction() {
        if (this.canUndo()) {
            return this.history[this.currentIndex].action;
        }
        return null;
    }

    /**
     * Gets the next redo action description
     * @returns {string|null}
     */
    getRedoAction() {
        if (this.canRedo()) {
            return this.history[this.currentIndex + 1].action;
        }
        return null;
    }

    /**
     * Clears all history
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        console.log('History: Cleared all history');
    }

    /**
     * Creates a deep copy of the state
     * @param {Object} state - State to copy
     * @returns {Object} Deep copy of state
     */
    deepCopyState(state) {
        const copy = {
            audioBuffer: null,
            chunks: state.chunks ? state.chunks.map(chunk => ({ ...chunk })) : [],
            selection: { ...state.selection },
            seekPosition: state.seekPosition,
            selectedChunk: state.selectedChunk ? { ...state.selectedChunk } : null,
            action: state.action,
            timestamp: state.timestamp
        };

        // Deep copy audio buffer if it exists
        if (state.audioBuffer) {
            copy.audioBuffer = this.copyAudioBuffer(state.audioBuffer);
        }

        return copy;
    }

    /**
     * Creates a copy of an AudioBuffer
     * @param {AudioBuffer} original - Original audio buffer
     * @returns {AudioBuffer} Copy of the audio buffer
     */
    copyAudioBuffer(original) {
        const copy = this.audioContext.createBuffer(
            original.numberOfChannels,
            original.length,
            original.sampleRate
        );

        // Copy channel data
        for (let channel = 0; channel < original.numberOfChannels; channel++) {
            const originalData = original.getChannelData(channel);
            const copyData = copy.getChannelData(channel);
            copyData.set(originalData);
        }

        return copy;
    }

    /**
     * Creates a state snapshot from current editor state
     * @param {Object} editor - Audio editor instance
     * @returns {Object} State snapshot
     */
    createStateSnapshot(editor) {
        return {
            audioBuffer: editor.audioBuffer,
            chunks: editor.chunkManager.chunks,
            selection: { ...editor.selection },
            seekPosition: editor.seekPosition,
            selectedChunk: editor.chunkManager.selectedChunk
        };
    }

    /**
     * Gets history info for debugging
     * @returns {Object} History information
     */
    getHistoryInfo() {
        return {
            length: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentAction: this.getCurrentAction(),
            undoAction: this.getUndoAction(),
            redoAction: this.getRedoAction()
        };
    }
}