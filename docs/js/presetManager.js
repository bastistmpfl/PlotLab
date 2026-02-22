// Constants
const STORAGE_KEY = 'plotlab_presets';

/**
 * Manages user presets (save/load settings to localStorage)
 * @class
 */
export class PresetManager {
    constructor() {
        this.presets = new Map();
        this.loadFromLocalStorage();
    }

    /**
     * Save current settings as a preset
     * @param {string} name - Preset name
     * @param {Object} settings - Settings object to save
     * @returns {Object} Saved preset with timestamp
     */
    savePreset(name, settings) {
        const preset = {
            name,
            timestamp: Date.now(),
            settings: { ...settings }
        };
        this.presets.set(name, preset);
        this.saveToLocalStorage();
        return preset;
    }

    /**
     * Load a preset by name
     * @param {string} name - Preset name
     * @returns {Object|undefined} Preset object or undefined if not found
     */
    loadPreset(name) {
        return this.presets.get(name);
    }

    /**
     * Delete a preset
     * @param {string} name - Preset name to delete
     */
    deletePreset(name) {
        this.presets.delete(name);
        this.saveToLocalStorage();
    }

    /**
     * Get all saved presets
     * @returns {Array<Object>} Array of all presets
     */
    getAllPresets() {
        return Array.from(this.presets.values());
    }

    /**
     * Save presets to localStorage
     * @private
     */
    saveToLocalStorage() {
        try {
            const data = Array.from(this.presets.entries());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save presets:', error);
        }
    }

    /**
     * Load presets from localStorage
     * @private
     */
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const entries = JSON.parse(data);
                this.presets = new Map(entries);
            }
        } catch (error) {
            console.error('Failed to load presets:', error);
        }
    }
}
