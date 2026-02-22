// Constants
const BED_CENTER_FACTOR = 0.5;
const DEFAULT_SCALE = 1.0;
const DEFAULT_ROTATION = 90.0;
const DEFAULT_BED_SIZE = 256;

/**
 * @typedef {Object} SVGObject
 * @property {string} id - Unique identifier
 * @property {string} filename - Original filename
 * @property {Array<Array<[number, number]>>} polylines - SVG paths as polylines
 * @property {Object} originalBounds - Original bounding box
 * @property {Array<number>} centerViewBox - Center in ViewBox units
 * @property {Array<number>} translation - [x, y] translation in mm
 * @property {number} scale - User scale factor
 * @property {number} rotation - Rotation angle in degrees
 * @property {boolean} visible - Visibility flag
 * @property {Object} metadata - Contains scaleFactor, physical dimensions, viewBox
 */

/**
 * Manages imported SVG files and their transformations
 * @class
 */
export class SVGManager {
    constructor() {
        this.svgObjects = new Map();
        this.selectedId = null;
        this.bedWidth = DEFAULT_BED_SIZE;
        this.bedHeight = DEFAULT_BED_SIZE;
        this.nextId = 1;
    }

    /**
     * Add a new SVG to the collection
     * @param {string} filename - SVG filename
     * @param {Array<Array<[number, number]>>} polylines - Extracted polylines
     * @param {Object} originalBounds - Bounding box {minX, minY, maxX, maxY}
     * @param {number} initialScale - Initial scale factor
     * @param {Object} metadata - SVG metadata (scaleFactor, physical, viewBox)
     * @returns {string} Generated SVG ID
     */
    addSVG(filename, polylines, originalBounds, initialScale = DEFAULT_SCALE, metadata = {}) {
        const id = `svg_${this.nextId++}`;
        
        // Calculate SVG center for rotation pivot
        const svgCenterX = (originalBounds.minX + originalBounds.maxX) / 2;
        const svgCenterY = (originalBounds.minY + originalBounds.maxY) / 2;
        
        // Translation represents where the SVG center should be positioned on the bed
        // Default: center of bed (128, 128)
        const initialX = this.bedWidth * BED_CENTER_FACTOR;
        const initialY = this.bedHeight * BED_CENTER_FACTOR;
        
        const svgObject = {
            id,
            filename,
            polylines,
            originalBounds,
            centerViewBox: [svgCenterX, svgCenterY],
            translation: [initialX, initialY],
            scale: initialScale,
            rotation: DEFAULT_ROTATION,
            visible: true,
            metadata: metadata // Contains scaleFactor, physical, viewBox
        };
        this.svgObjects.set(id, svgObject);
        this.selectedId = id;
        return id;
    }

    /**
     * Remove an SVG from the collection
     * @param {string} id - SVG ID to remove
     */
    removeSVG(id) {
        this.svgObjects.delete(id);
        if (this.selectedId === id) {
            this.selectedId = null;
        }
    }

    /**
     * Select an SVG
     * @param {string} id - SVG ID to select
     */
    selectSVG(id) {
        this.selectedId = id;
    }

    /**
     * Get currently selected SVG
     * @returns {SVGObject|undefined} Selected SVG object
     */
    getSelectedSVG() {
        return this.svgObjects.get(this.selectedId);
    }

    /**
     * Update SVG transformation
     * @param {string} id - SVG ID
     * @param {Array<number>} translation - [x, y] translation
     * @param {number} scale - Scale factor
     * @param {number} rotation - Rotation angle in degrees
     */
    updateTransformation(id, translation, scale, rotation) {
        const svg = this.svgObjects.get(id);
        if (svg) {
            svg.translation = translation;
            svg.scale = scale;
            svg.rotation = rotation;
        }
    }

    /**
     * Toggle SVG visibility
     * @param {string} id - SVG ID
     */
    toggleVisibility(id) {
        const svg = this.svgObjects.get(id);
        if (svg) {
            svg.visible = !svg.visible;
        }
    }

    /**
     * Set bed dimensions
     * @param {number} width - Bed width in mm
     * @param {number} height - Bed height in mm
     */
    setBedSize(width, height) {
        this.bedWidth = width;
        this.bedHeight = height;
    }

    /**
     * Get all polylines from visible SVGs (transformed)
     * @returns {Array<Array<[number, number]>>} All transformed polylines
     */
    getAllPolylines() {
        const allPolylines = [];
        for (const svg of this.svgObjects.values()) {
            if (!svg.visible) continue;
            
            const transformed = this.getTransformedPolylines(svg);
            allPolylines.push(...transformed);
        }
        return allPolylines;
    }

    /**
     * Get transformed polylines for a specific SVG
     * @param {SVGObject} svg - SVG object
     * @returns {Array<Array<[number, number]>>} Transformed polylines
     */
    getTransformedPolylines(svg) {
        const { polylines, translation, scale, rotation, metadata, centerViewBox, originalBounds } = svg;
        const [tx, ty] = translation;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Get scale factor from metadata (converts ViewBox units to mm)
        const mmScale = metadata?.scaleFactor?.avgScale || DEFAULT_SCALE;
        const [centerX, centerY] = centerViewBox || [0, 0];
        const pivotX = centerX * mmScale * scale;
        const pivotY = centerY * mmScale * scale;

        // First pass: transform all points
        const transformed = polylines.map(polyline => 
            polyline.map(([x, y]) => {
                // Convert from ViewBox units to mm
                const x_mm = x * mmScale;
                const y_mm = y * mmScale;
                
                // Scale (user scale)
                const sx = x_mm * scale;
                const sy = y_mm * scale;
                
                // Rotate around pivot (SVG center in mm after scaling)
                const dx = sx - pivotX;
                const dy = sy - pivotY;
                const rx = dx * cos - dy * sin + pivotX;
                const ry = dx * sin + dy * cos + pivotY;
                
                return [rx, ry];
            })
        );

        // Calculate bounds of rotated polylines
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const polyline of transformed) {
            for (const [x, y] of polyline) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        // Calculate center of rotated bounds
        const rotatedCenterX = (minX + maxX) / 2;
        const rotatedCenterY = (minY + maxY) / 2;

        // Adjust so translation represents the center position
        // Shift the rotated SVG so its center is at (tx, ty)
        return transformed.map(polyline => 
            polyline.map(([x, y]) => [x - rotatedCenterX + tx, y - rotatedCenterY + ty])
        );
    }

    /**
     * Get SVG objects with their polylines for G-Code generation
     * @returns {Array} Array of objects with id, polylines, visible
     */
    getAllSVGsWithPolylines() {
        return Array.from(this.svgObjects.values()).map(svg => ({
            id: svg.id,
            filename: svg.filename,
            polylines: this.getTransformedPolylines(svg),
            visible: svg.visible
        }));
    }
}
