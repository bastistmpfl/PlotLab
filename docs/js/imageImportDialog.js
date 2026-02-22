// Constants
const MAX_IMAGE_SIZE = 1024;
const DEBOUNCE_DELAY = 500;

import { ImageToSVGConverter } from './imageToSVGConverter.js';

/**
 * Image import dialog for converting raster images to SVG.
 * Provides side-by-side preview with conversion controls.
 * @class
 */
export class ImageImportDialog {
    /**
     * Creates an image import dialog instance
     * @param {File} file - The image file object
     */
    constructor(file) {
        this.file = file;
        this.originalImage = null;
        this.scaledImage = null;
        this.originalCanvas = null;
        this.originalCtx = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.svgString = null;
        
        // Conversion parameters
        this.threshold = 128;
        this.simplify = 1;
        this.invert = false;
        
        // UI elements
        this.backdrop = null;
        this.progressOverlay = null;
        this.thresholdSlider = null;
        this.thresholdValue = null;
        this.simplifySlider = null;
        this.simplifyValue = null;
        this.invertCheckbox = null;
        
        // Debounce timer
        this.updateTimer = null;
        
        this._resolve = null;
        this._resizeHandler = null;
    }

    /**
     * Shows the dialog and returns a promise that resolves with SVG string or null
     * @returns {Promise<string|null>} SVG string if imported, null if cancelled
     */
    show() {
        return new Promise(async (resolve) => {
            this._resolve = resolve;
            
            try {
                // Load and prepare image
                await this._loadImage();
                
                // Create dialog UI
                this._createDialog();
                
                // Initial conversion
                await this._runConversion();
                
            } catch (error) {
                console.error('Error loading image:', error);
                alert(`Failed to load image: ${error.message}`);
                this._cleanup();
                resolve(null);
            }
        });
    }

    /**
     * Loads and prepares the image
     * @private
     */
    async _loadImage() {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    this.originalImage = img;
                    
                    // Scale down if needed
                    const maxDim = Math.max(img.width, img.height);
                    if (maxDim > MAX_IMAGE_SIZE) {
                        const scale = MAX_IMAGE_SIZE / maxDim;
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.floor(img.width * scale);
                        canvas.height = Math.floor(img.height * scale);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        // Create scaled image
                        const scaledImg = new Image();
                        scaledImg.onload = () => {
                            this.scaledImage = scaledImg;
                            resolve();
                        };
                        scaledImg.src = canvas.toDataURL();
                    } else {
                        this.scaledImage = img;
                        resolve();
                    }
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(this.file);
        });
    }

    /**
     * Creates the dialog DOM structure
     * @private
     */
    _createDialog() {
        const elements = this._buildDialogDOM();
        this._setupEventListeners(elements);
        
        // Initial render
        this._renderOriginal();
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
        content.className = 'modal-content image-import-dialog';
        
        // Header
        const header = this._createHeader();
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body image-import-dialog__body';
        
        // Info section
        const info = this._createInfoSection();
        
        // Preview container (split view)
        const previewContainer = this._createPreviewContainer();
        
        // Controls panel
        const controls = this._createControlsPanel();
        
        body.appendChild(info);
        body.appendChild(previewContainer);
        body.appendChild(controls);
        
        // Footer with buttons
        const footer = this._createFooter();
        
        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        
        this.backdrop.appendChild(content);
        document.body.appendChild(this.backdrop);
        
        return {
            closeBtn: header.querySelector('.modal-close'),
            cancelBtn: footer.querySelector('.btn-cancel'),
            importBtn: footer.querySelector('.btn-import')
        };
    }

    /**
     * Creates the dialog header
     * @private
     * @returns {HTMLElement} Header element
     */
    _createHeader() {
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h3');
        title.className = 'modal-title';
        
        const img = this.scaledImage;
        const sizeInfo = img.width !== this.originalImage.width 
            ? ` (scaled from ${this.originalImage.width}×${this.originalImage.height})`
            : '';
        
        title.textContent = `Import Image: ${this.file.name} (${img.width}×${img.height}${sizeInfo})`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close');
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        return header;
    }

    /**
     * Creates the info section
     * @private
     * @returns {HTMLElement} Info element
     */
    _createInfoSection() {
        const info = document.createElement('div');
        info.className = 'image-import-dialog__info';
        
        const grid = document.createElement('div');
        grid.className = 'image-import-dialog__info-grid';
        
        const items = [
            { label: 'File Type', value: this.file.type || 'Unknown' },
            { label: 'Original Size', value: `${this.originalImage.width} × ${this.originalImage.height} px` },
            { label: 'File Size', value: `${(this.file.size / 1024).toFixed(1)} KB` }
        ];
        
        items.forEach(({ label, value }) => {
            const item = document.createElement('div');
            item.className = 'image-import-dialog__info-item';
            
            const itemLabel = document.createElement('div');
            itemLabel.className = 'image-import-dialog__info-label';
            itemLabel.textContent = label;
            
            const itemValue = document.createElement('div');
            itemValue.className = 'image-import-dialog__info-value';
            itemValue.textContent = value;
            
            item.appendChild(itemLabel);
            item.appendChild(itemValue);
            grid.appendChild(item);
        });
        
        info.appendChild(grid);
        
        return info;
    }

    /**
     * Creates the preview container with split view
     * @private
     * @returns {HTMLElement} Preview container element
     */
    _createPreviewContainer() {
        const container = document.createElement('div');
        container.className = 'image-import-dialog__preview-container';
        
        // Original panel
        const originalPanel = document.createElement('div');
        originalPanel.className = 'image-import-dialog__preview-panel';
        
        const originalHeader = document.createElement('div');
        originalHeader.className = 'image-import-dialog__preview-header';
        originalHeader.textContent = 'Original Image';
        
        const originalCanvasContainer = document.createElement('div');
        originalCanvasContainer.className = 'image-import-dialog__canvas-container';
        
        this.originalCanvas = document.createElement('canvas');
        this.originalCanvas.className = 'image-import-dialog__canvas';
        this.originalCtx = this.originalCanvas.getContext('2d');
        originalCanvasContainer.appendChild(this.originalCanvas);
        
        originalPanel.appendChild(originalHeader);
        originalPanel.appendChild(originalCanvasContainer);
        
        // Preview panel
        const previewPanel = document.createElement('div');
        previewPanel.className = 'image-import-dialog__preview-panel';
        
        const previewHeader = document.createElement('div');
        previewHeader.className = 'image-import-dialog__preview-header';
        previewHeader.textContent = 'SVG Preview';
        
        const previewCanvasContainer = document.createElement('div');
        previewCanvasContainer.className = 'image-import-dialog__canvas-container';
        
        // Progress overlay
        this.progressOverlay = document.createElement('div');
        this.progressOverlay.className = 'image-import-dialog__progress-overlay';
        
        const spinner = document.createElement('div');
        spinner.className = 'image-import-dialog__spinner';
        
        const progressText = document.createElement('div');
        progressText.className = 'image-import-dialog__progress-text';
        progressText.textContent = 'Converting image to SVG...';
        
        this.progressOverlay.appendChild(spinner);
        this.progressOverlay.appendChild(progressText);
        
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'image-import-dialog__canvas';
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        previewCanvasContainer.appendChild(this.previewCanvas);
        previewCanvasContainer.appendChild(this.progressOverlay);
        
        previewPanel.appendChild(previewHeader);
        previewPanel.appendChild(previewCanvasContainer);
        
        container.appendChild(originalPanel);
        container.appendChild(previewPanel);
        
        return container;
    }

    /**
     * Creates the controls panel
     * @private
     * @returns {HTMLElement} Controls element
     */
    _createControlsPanel() {
        const controls = document.createElement('div');
        controls.className = 'image-import-dialog__controls';
        
        const grid = document.createElement('div');
        grid.className = 'image-import-dialog__controls-grid';
        
        // Threshold control
        const thresholdGroup = document.createElement('div');
        thresholdGroup.className = 'image-import-dialog__control-group';
        
        const thresholdLabel = document.createElement('label');
        thresholdLabel.className = 'image-import-dialog__control-label';
        thresholdLabel.innerHTML = `
            Threshold
            <span class="image-import-dialog__control-hint">(0-255: Lower = more black pixels)</span>
        `;
        
        const thresholdContainer = document.createElement('div');
        thresholdContainer.className = 'image-import-dialog__slider-container';
        
        this.thresholdSlider = document.createElement('input');
        this.thresholdSlider.type = 'range';
        this.thresholdSlider.min = '0';
        this.thresholdSlider.max = '255';
        this.thresholdSlider.value = '128';
        this.thresholdSlider.className = 'image-import-dialog__slider';
        
        this.thresholdValue = document.createElement('span');
        this.thresholdValue.className = 'image-import-dialog__slider-value';
        this.thresholdValue.textContent = '128';
        
        thresholdContainer.appendChild(this.thresholdSlider);
        thresholdContainer.appendChild(this.thresholdValue);
        
        thresholdGroup.appendChild(thresholdLabel);
        thresholdGroup.appendChild(thresholdContainer);
        
        // Simplify control
        const simplifyGroup = document.createElement('div');
        simplifyGroup.className = 'image-import-dialog__control-group';
        
        const simplifyLabel = document.createElement('label');
        simplifyLabel.className = 'image-import-dialog__control-label';
        simplifyLabel.innerHTML = `
            Simplification
            <span class="image-import-dialog__control-hint">(0-10: Higher = smoother paths)</span>
        `;
        
        const simplifyContainer = document.createElement('div');
        simplifyContainer.className = 'image-import-dialog__slider-container';
        
        this.simplifySlider = document.createElement('input');
        this.simplifySlider.type = 'range';
        this.simplifySlider.min = '0';
        this.simplifySlider.max = '10';
        this.simplifySlider.value = '1';
        this.simplifySlider.step = '0.5';
        this.simplifySlider.className = 'image-import-dialog__slider';
        
        this.simplifyValue = document.createElement('span');
        this.simplifyValue.className = 'image-import-dialog__slider-value';
        this.simplifyValue.textContent = '1';
        
        simplifyContainer.appendChild(this.simplifySlider);
        simplifyContainer.appendChild(this.simplifyValue);
        
        simplifyGroup.appendChild(simplifyLabel);
        simplifyGroup.appendChild(simplifyContainer);
        
        // Invert control
        const invertGroup = document.createElement('div');
        invertGroup.className = 'image-import-dialog__control-group';
        
        const invertLabel = document.createElement('label');
        invertLabel.className = 'image-import-dialog__control-label';
        invertLabel.style.cursor = 'pointer';
        invertLabel.innerHTML = `
            <input type="checkbox" id="invert-checkbox" style="margin-right: 8px; cursor: pointer;">
            Invert Colors
            <span class="image-import-dialog__control-hint">(Swap black/white)</span>
        `;
        
        this.invertCheckbox = invertLabel.querySelector('input');
        
        invertGroup.appendChild(invertLabel);
        
        grid.appendChild(thresholdGroup);
        grid.appendChild(simplifyGroup);
        grid.appendChild(invertGroup);
        
        controls.appendChild(grid);
        
        return controls;
    }

    /**
     * Creates the footer with action buttons
     * @private
     * @returns {HTMLElement} Footer element
     */
    _createFooter() {
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-cancel';
        cancelBtn.textContent = 'Cancel';
        
        const importBtn = document.createElement('button');
        importBtn.className = 'btn btn-import';
        importBtn.textContent = 'Import SVG';
        
        footer.appendChild(cancelBtn);
        footer.appendChild(importBtn);
        
        return footer;
    }

    /**
     * Sets up event listeners
     * @private
     * @param {Object} elements - UI elements
     */
    _setupEventListeners(elements) {
        // Close/Cancel handlers
        const closeHandler = () => this._handleCancel();
        elements.closeBtn.addEventListener('click', closeHandler);
        elements.cancelBtn.addEventListener('click', closeHandler);
        
        // Import handler
        elements.importBtn.addEventListener('click', () => this._handleImport());
        
        // Control change handlers
        this.thresholdSlider.addEventListener('input', () => {
            this.thresholdValue.textContent = this.thresholdSlider.value;
            this.threshold = parseInt(this.thresholdSlider.value);
            this._scheduleUpdate();
        });
        
        this.simplifySlider.addEventListener('input', () => {
            this.simplifyValue.textContent = this.simplifySlider.value;
            this.simplify = parseFloat(this.simplifySlider.value);
            this._scheduleUpdate();
        });
        
        this.invertCheckbox.addEventListener('change', () => {
            this.invert = this.invertCheckbox.checked;
            this._scheduleUpdate();
        });
        
        // Backdrop click
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) {
                closeHandler();
            }
        });
    }

    /**
     * Renders the original image to canvas
     * @private
     */
    _renderOriginal() {
        const img = this.scaledImage;
        this.originalCanvas.width = img.width;
        this.originalCanvas.height = img.height;
        this.originalCtx.drawImage(img, 0, 0);
    }

    /**
     * Schedules a debounced preview update
     * @private
     */
    _scheduleUpdate() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this._runConversion();
        }, DEBOUNCE_DELAY);
    }

    /**
     * Runs the image to SVG conversion
     * @private
     */
    async _runConversion() {
        // Show progress overlay
        this.progressOverlay.classList.remove('hidden');
        
        try {
            // Use a small delay to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Run conversion using our own converter
            const svgString = ImageToSVGConverter.convertToSVG(this.scaledImage, {
                threshold: this.threshold,
                simplify: this.simplify,
                invert: this.invert
            });
            
            this.svgString = svgString;
            
            // Render preview
            await this._renderPreview(svgString);
            
        } catch (error) {
            console.error('Conversion error:', error);
            alert(`Conversion failed: ${error.message}`);
        } finally {
            // Hide progress overlay
            this.progressOverlay.classList.add('hidden');
        }
    }

    /**
     * Renders the SVG preview to canvas
     * @private
     * @param {string} svgString - SVG markup
     */
    async _renderPreview(svgString) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.previewCanvas.width = img.width;
                this.previewCanvas.height = img.height;
                this.previewCtx.clearRect(0, 0, img.width, img.height);
                this.previewCtx.drawImage(img, 0, 0);
                resolve();
            };
            
            img.onerror = () => {
                reject(new Error('Failed to render SVG preview'));
            };
            
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            img.src = URL.createObjectURL(blob);
        });
    }

    /**
     * Handles cancel/close
     * @private
     */
    _handleCancel() {
        this._cleanup();
        if (this._resolve) {
            this._resolve(null);
        }
    }

    /**
     * Handles import confirmation
     * @private
     */
    _handleImport() {
        if (!this.svgString) {
            alert('No SVG generated yet. Please wait for conversion to complete.');
            return;
        }
        
        this._cleanup();
        if (this._resolve) {
            this._resolve(this.svgString);
        }
    }

    /**
     * Cleans up resources and removes dialog
     * @private
     */
    _cleanup() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        
        // Clear canvases
        if (this.originalCanvas) {
            this.originalCtx = null;
            this.originalCanvas = null;
        }
        
        if (this.previewCanvas) {
            this.previewCtx = null;
            this.previewCanvas = null;
        }
        
        // Clear images
        this.originalImage = null;
        this.scaledImage = null;
    }
}
