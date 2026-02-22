/**
 * Manages undo/redo history for PlotLab actions
 * @class
 */
export class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
    }

    /**
     * Push a new state to the history
     * @param {string} action - Action type (e.g., 'transform', 'add', 'remove', 'visibility')
     * @param {Object} data - Action data to restore state
     */
    pushState(action, data) {
        const state = {
            action,
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            timestamp: Date.now()
        };
        
        this.undoStack.push(state);
        this.redoStack = []; // Clear redo stack on new action
        
        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    /**
     * Check if undo is possible
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is possible
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Undo last action
     * @returns {Object|null} State to restore or null
     */
    undo() {
        if (!this.canUndo()) return null;
        
        const state = this.undoStack.pop();
        this.redoStack.push(state);
        
        return state;
    }

    /**
     * Redo last undone action
     * @returns {Object|null} State to restore or null
     */
    redo() {
        if (!this.canRedo()) return null;
        
        const state = this.redoStack.pop();
        this.undoStack.push(state);
        
        return state;
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Get current history size
     * @returns {Object} Sizes of undo and redo stacks
     */
    getSize() {
        return {
            undo: this.undoStack.length,
            redo: this.redoStack.length
        };
    }
}
