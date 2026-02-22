/**
 * @typedef {Object} ExclusionZone
 * @property {string} id - Unique identifier
 * @property {string} name - Zone name
 * @property {number} x - X position in mm
 * @property {number} y - Y position in mm
 * @property {number} width - Width in mm
 * @property {number} height - Height in mm
 * @property {boolean} enabled - Whether zone is active
 */

/**
 * Manages exclusion zones on the print bed
 * @class
 */
export class ExclusionZonesManager {
    constructor() {
        this.zones = new Map();
        this.nextId = 1;
    }

    /**
     * Add a new exclusion zone
     * @param {number} x - X position in mm
     * @param {number} y - Y position in mm
     * @param {number} width - Width in mm
     * @param {number} height - Height in mm
     * @param {string} name - Optional zone name
     * @returns {string} Generated zone ID
     */
    addZone(x, y, width, height, name = '') {
        const id = `zone_${this.nextId++}`;
        const zone = {
            id,
            name: name || `Zone ${this.nextId - 1}`,
            x,
            y,
            width,
            height,
            enabled: true
        };
        this.zones.set(id, zone);
        return id;
    }

    /**
     * Remove an exclusion zone
     * @param {string} id - Zone ID to remove
     */
    removeZone(id) {
        this.zones.delete(id);
    }

    /**
     * Update zone dimensions
     * @param {string} id - Zone ID
     * @param {number} x - New X position
     * @param {number} y - New Y position
     * @param {number} width - New width
     * @param {number} height - New height
     */
    updateZone(id, x, y, width, height) {
        const zone = this.zones.get(id);
        if (zone) {
            zone.x = x;
            zone.y = y;
            zone.width = width;
            zone.height = height;
        }
    }

    /**
     * Toggle zone enabled/disabled state
     * @param {string} id - Zone ID
     */
    toggleZone(id) {
        const zone = this.zones.get(id);
        if (zone) {
            zone.enabled = !zone.enabled;
        }
    }

    /**
     * Check if a point is inside any exclusion zone
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if point is in any enabled zone
     */
    isPointInAnyZone(x, y) {
        for (const zone of this.zones.values()) {
            if (!zone.enabled) continue;
            if (this._isPointInZone(x, y, zone)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a point is inside a specific zone
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {ExclusionZone} zone - Zone to check
     * @returns {boolean} True if point is inside zone
     */
    _isPointInZone(x, y, zone) {
        return x >= zone.x && 
               x <= zone.x + zone.width && 
               y >= zone.y && 
               y <= zone.y + zone.height;
    }

    // Removed unused methods: filterPolylines, _splitPolylineByZones

    /**
     * Get all zones
     * @returns {Array<ExclusionZone>} Array of all zones
     */
    getZones() {
        return Array.from(this.zones.values());
    }

    /**
     * Clear all zones
     */
    clear() {
        this.zones.clear();
    }
}
