// Constants
const CANVAS_MARGIN = 40;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_FACTOR = 1.1;
const INITIAL_SCALE = 1.0;

// Preview colors for polylines
const PREVIEW_COLORS = [
    '#1e40af', // blue
    '#059669', // green
    '#dc2626', // red
    '#ca8a04', // yellow
    '#7c3aed', // purple
    '#db2777', // pink
    '#0891b2', // cyan
    '#ea580c'  // orange
];

/**
 * Import dialog for SVG file preview and configuration.
 * Provides pan/zoom canvas preview with auto-fit option.
 * @class
 */
export class ImportDialog {
    /**
     * Creates an import dialog instance
     * @param {File} file - The SVG file object
     * @param {Array<Array<[number, number]>>} polylines - SVG polylines
     * @param {Object} bounds - Bounding box {minX, minY, maxX, maxY, width, height}
     * @param {Object} metadata - Contains scaleFactor, physical, viewBox
     */
    constructor(file, polylines, bounds, metadata = {}) {
        this.file = file;
        this.polylines = polylines;
        this.bounds = bounds;
        this.metadata = metadata;
        this.scaleFactor = metadata.scaleFactor;
        this.physical = metadata.physical;
        this.viewBox = metadata.viewBox;
        
        this.canvas = null;
        this.ctx = null;
        this.scale = INITIAL_SCALE;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this._resizeHandler = null;
        this._resolve = null;
        
        this._createDialog();
    }

    /**
     * Creates the dialog DOM structure
     * @private
     */
    _createDialog() {
        const elements = this._buildDialogDOM();
        this._setupCanvasEvents(elements);
        this._setupButtonEvents(elements);
    }

    /**
     * Builds the complete dialog DOM structure
     * @private
     * @returns {Object} Object containing all created elements
     */
    _buildDialogDOM() {
        // Create modal backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal show';
        
        // Create dialog content
        const content = document.createElement('div');
        content.className = 'modal-content import-dialog';
        
        // Header
        const header = this._createHeader();
        
        // Body with canvas
        const body = document.createElement('div');
        body.className = 'modal-body import-dialog__body';
        
        // Info section
        const info = this._createInfoSection();
        
        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'import-dialog__canvas-container';
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'import-dialog__canvas';
        canvasContainer.appendChild(this.canvas);
        
        body.appendChild(info);
        body.appendChild(canvasContainer);
        
        // Footer
        const footer = this._createFooter();
        
        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        this.backdrop.appendChild(content);
        document.body.appendChild(this.backdrop);
        
        // Setup canvas
        this.ctx = this.canvas.getContext('2d');
        this._resizeCanvas();
        
        return {
            backdrop: this.backdrop,
            canvas: this.canvas,
            canvasContainer: canvasContainer,
            closeBtn: header.querySelector('#import-dialog-close'),
            cancelBtn: footer.querySelector('#import-dialog-cancel'),
            importBtn: footer.querySelector('#import-dialog-import')
        };
    }

    /**
     * Creates the dialog header with title and close button
     * @private
     * @returns {HTMLElement} Header element
     */
    _createHeader() {
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        // Build header with physical dimensions if available
        let headerTitle = `SVG Import Preview - ${this.file.name}`;
        let physicalInfo = '';
        
        if (this.physical) {
            physicalInfo = ` | Physical: ${this.physical.widthMM.toFixed(1)}mm × ${this.physical.heightMM.toFixed(1)}mm`;
        }
        
        header.innerHTML = `
            <h2>${headerTitle}${physicalInfo}</h2>
            <button id="import-dialog-close">&times;</button>
        `;
        
        return header;
    }

    /**
     * Creates the info section showing file statistics
     * @private
     * @returns {HTMLElement} Info section element
     */
    _createInfoSection() {
        const info = document.createElement('div');
        info.className = 'import-dialog__info';
        
        // Calculate physical dimensions in mm
        let widthMM, heightMM;
        if (this.scaleFactor) {
            widthMM = this.bounds.width * this.scaleFactor.scaleX;
            heightMM = this.bounds.height * this.scaleFactor.scaleY;
        } else {
            widthMM = this.bounds.width;
            heightMM = this.bounds.height;
        }
        
        info.innerHTML = `
            <div class="import-dialog__info-grid">
                <div><strong>Polylines:</strong> ${this.polylines.length}</div>
                <div><strong>Width:</strong> ${widthMM.toFixed(2)} mm</div>
                <div><strong>Height:</strong> ${heightMM.toFixed(2)} mm</div>
            </div>
            <div class="import-dialog__info-hint">
                Use mouse wheel to zoom, drag to pan
            </div>
        `;
        
        return info;
    }

    /**
     * Creates the dialog footer with action buttons
     * @private
     * @returns {HTMLElement} Footer element
     */
    _createFooter() {
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.innerHTML = `
            <button id="import-dialog-cancel" class="btn--secondary">Cancel</button>
            <button id="import-dialog-import" class="btn--primary">Import</button>
        `;
        return footer;
    }

    /**
     * Sets up canvas interaction events (pan, zoom, resize)
     * @private
     * @param {Object} elements - Dialog elements
     */
    _setupCanvasEvents({ canvas, canvasContainer }) {
        // Wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
            this.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.scale * delta));
            this._drawPreview();
        });
        
        // Pan with mouse drag
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            canvas.classList.add('import-dialog__canvas--dragging');
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.panX += dx;
                this.panY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this._drawPreview();
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.classList.remove('import-dialog__canvas--dragging');
        });
        
        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            canvas.classList.remove('import-dialog__canvas--dragging');
        });
        
        // Window resize handler with cleanup
        this._resizeHandler = () => this._resizeCanvas();
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Sets up button click events
     * @private
     * @param {Object} elements - Dialog elements containing buttons
     */
    _setupButtonEvents({ closeBtn, cancelBtn, importBtn }) {
        // Close button
        closeBtn.addEventListener('click', () => {
            this._resolve(null);
        });
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            this._resolve(null);
        });
        
        // Import button
        importBtn.addEventListener('click', () => {
            this._resolve({ polylines: this.polylines, bounds: this.bounds });
        });
    }

    /**
     * Resizes canvas to fit container
     * @private
     */
    _resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this._drawPreview();
    }

    /**
     * Draws the SVG preview on canvas
     * @private
     */
    _drawPreview() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Validate bounds
        if (!this.bounds || this.bounds.width <= 0 || this.bounds.height <= 0) {
            this._drawError(ctx);
            return;
        }
        
        // Calculate scaling to fit SVG in canvas with margin
        const availableWidth = width - 2 * CANVAS_MARGIN;
        const availableHeight = height - 2 * CANVAS_MARGIN;
        
        const scaleX = availableWidth / this.bounds.width;
        const scaleY = availableHeight / this.bounds.height;
        const autoScale = Math.min(scaleX, scaleY) * this.scale;
        
        // Center the drawing
        const centerX = width / 2 + this.panX;
        const centerY = height / 2 + this.panY;
        
        // Apply transformations
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(autoScale, autoScale);
        ctx.translate(-this.bounds.width / 2, -this.bounds.height / 2);
        if (Number.isFinite(this.bounds.minX) && Number.isFinite(this.bounds.minY)) {
            ctx.translate(-this.bounds.minX, -this.bounds.minY);
        }
        
        // Draw polylines
        const { drawnCount, skippedCount } = this._drawPolylines(ctx, autoScale);
        
        ctx.restore();
        
        // Draw bounds rectangle
        this._drawBoundsRectangle(ctx, centerX, centerY, autoScale);
    }

    /**
     * Draws error message when bounds are invalid
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _drawError(ctx) {
        console.error('❌ Invalid bounds:', this.bounds);
        ctx.fillStyle = '#ff0000';
        ctx.font = '16px Arial';
        ctx.fillText('ERROR: Invalid SVG bounds', 20, 40);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText('width=' + (this.bounds?.width || 'undefined'), 20, 70);
        ctx.fillText('height=' + (this.bounds?.height || 'undefined'), 20, 90);
    }

    /**
     * Draws all polylines on canvas
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} autoScale - Current scale factor
     * @returns {Object} Statistics about drawn polylines
     */
    _drawPolylines(ctx, autoScale) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let drawnCount = 0;
        let skippedCount = 0;
        
        this.polylines.forEach((polyline, index) => {
            if (polyline.length < 2) {
                skippedCount++;
                return;
            }
            
            try {
                ctx.strokeStyle = PREVIEW_COLORS[index % PREVIEW_COLORS.length];
                ctx.lineWidth = 1.5 / autoScale;
                ctx.beginPath();
                ctx.moveTo(polyline[0][0], polyline[0][1]);
                for (let i = 1; i < polyline.length; i++) {
                    ctx.lineTo(polyline[i][0], polyline[i][1]);
                }
                ctx.stroke();
                drawnCount++;
            } catch (e) {
                console.warn('Failed to draw polyline', index, e);
                skippedCount++;
            }
        });
        
        return { drawnCount, skippedCount };
    }

    /**
     * Draws the bounding box rectangle
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} autoScale - Current scale factor
     */
    _drawBoundsRectangle(ctx, centerX, centerY, autoScale) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(autoScale, autoScale);
        const rectX = -this.bounds.width / 2;
        const rectY = -this.bounds.height / 2;
        ctx.strokeRect(rectX, rectY, this.bounds.width, this.bounds.height);
        ctx.restore();
        ctx.setLineDash([]);
    }

    /**
     * Shows the import dialog and returns a promise
     * @returns {Promise<{polylines: Array, bounds: Object} | null>} Import result or null if canceled
     */
    show() {
        // Draw the initial preview
        this._drawPreview();
        
        return new Promise((resolve) => {
            this._resolve = (result) => {
                // Cleanup: remove dialog and event listeners
                this.backdrop.remove();
                if (this._resizeHandler) {
                    window.removeEventListener('resize', this._resizeHandler);
                    this._resizeHandler = null;
                }
                resolve(result);
            };
        });
    }
}
