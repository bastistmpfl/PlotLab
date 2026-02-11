// Constants
const BED_CENTER_FACTOR = 0.5;
const DEFAULT_SCALE = 1.0;
const DEFAULT_ROTATION = 0.0;
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
        
        // Calculate initial translation to center SVG on bed
        // SVG bounds are in original SVG coordinate space
        const svgCenterX = (originalBounds.minX + originalBounds.maxX) / 2;
        const svgCenterY = (originalBounds.minY + originalBounds.maxY) / 2;
        const mmScale = metadata?.scaleFactor?.avgScale || DEFAULT_SCALE;
        const svgCenterXMM = svgCenterX * mmScale;
        const svgCenterYMM = svgCenterY * mmScale;
        
        // We want to position the SVG center at bed center (bedWidth/2, bedHeight/2)
        const initialX = this.bedWidth * BED_CENTER_FACTOR - svgCenterXMM * initialScale;
        const initialY = this.bedHeight * BED_CENTER_FACTOR - svgCenterYMM * initialScale;
        
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
        for (const polyline of transformed) {
            for (const [x, y] of polyline) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
            }
        }

        // Adjust so translation represents top-left corner position
        return transformed.map(polyline => 
            polyline.map(([x, y]) => [x - minX + tx, y - minY + ty])
        );
    }
}
