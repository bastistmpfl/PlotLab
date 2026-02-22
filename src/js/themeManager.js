/**
 * Manages dark/light theme switching and persistence
 * @class
 */
export class ThemeManager {
    constructor() {
        this.storageKey = 'plotlab_theme';
        this.currentTheme = this._loadTheme();
        this._applyTheme(this.currentTheme);
    }

    /**
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Set theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error('Invalid theme:', theme);
            return;
        }

        this.currentTheme = theme;
        this._applyTheme(theme);
        this._saveTheme(theme);
    }

    /**
     * Toggle between light and dark theme
     * @returns {string} New theme
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    }

    /**
     * Apply theme to document
     * @private
     * @param {string} theme - Theme to apply
     */
    _applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    /**
     * Save theme to localStorage
     * @private
     * @param {string} theme - Theme to save
     */
    _saveTheme(theme) {
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    }

    /**
     * Load theme from localStorage or detect system preference
     * @private
     * @returns {string} Loaded or detected theme
     */
    _loadTheme() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved === 'light' || saved === 'dark') {
                return saved;
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }

        // Detect system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light'; // Default
    }
}
