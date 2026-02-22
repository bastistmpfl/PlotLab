// Main Application
import { SVGManager } from './svgManager.js';
import { SVGProcessor } from './svgProcessor.js';
import { GCodeGenerator } from './gcodeGenerator.js';
import { ProjectManager } from './projectManager.js';
import { Preview3D } from './preview3d.js';
import { ImportDialog } from './importDialog.js';
import { ImageImportDialog } from './imageImportDialog.js';
import { ExclusionZonesManager } from './exclusionZones.js';
import { PresetManager } from './presetManager.js';
import { HistoryManager } from './historyManager.js';
import { ThemeManager } from './themeManager.js';
import { PathOptimizer } from './pathOptimizer.js';

import { GCodeHighlighter } from './gcodeHighlighter.js';
import { GCodeValidator } from './gcodeValidator.js';

// Constants
const COLOR_PALETTE = [
    0x1e40af, // blue
    0x059669, // green
    0xdc2626, // red
    0xca8a04, // yellow
    0x7c3aed, // purple
    0xdb2777, // pink
    0x0891b2, // cyan
    0xea580c, // orange
    0x16a34a, // green-600
    0x9333ea  // purple-600
];

const DEFAULT_BED_MARGIN = 0.9;

/**
 * Main application class for PlotLab.
 * Orchestrates SVG management, 3D preview, G-Code generation, and UI interactions.
 * @class
 */
class App {
    /**
     * Initialize the application
     * @constructor
     */
    constructor() {
        // Managers
        this.svgManager = new SVGManager();
        this.exclusionZones = new ExclusionZonesManager();
        this.presetManager = new PresetManager();
        this.projectManager = null; // Will be initialized after _cacheDOM
        this.history = new HistoryManager();
        this.themeManager = new ThemeManager();
        this.preview3D = null;
        this.selectedSVGId = null;
        this.pendingHistoryAction = false;
        
        // Cache all DOM elements and initialize
        this._cacheDOM();
        
        // Initialize project manager with settings function
        this.projectManager = new ProjectManager(
            this.svgManager, 
            this.exclusionZones, 
            () => this._getSettings()
        );
        
        this._initUI();
        this._init3DPreview();
        this._updateZoneList();
        this._updateThemeButton();
    }

    /**
     * Cache all DOM element references for performance
     * @private
     */
    _cacheDOM() {
        this.ui = {
            // File import
            btnImport: document.getElementById('btn-import'),
            fileInput: document.getElementById('file-input'),
            
            // Transform controls
            posX: document.getElementById('pos-x'),
            posY: document.getElementById('pos-y'),
            scale: document.getElementById('scale'),
            rotation: document.getElementById('rotation'),
            svgSize: document.getElementById('svg-size'),
            
            // Settings
            btnApplySettings: document.getElementById('btn-apply-settings'),
            bedWidth: document.getElementById('bed-width'),
            bedHeight: document.getElementById('bed-height'),
            penUpZ: document.getElementById('pen-up-z'),
            sheetHeight: document.getElementById('sheet-height'),
            feedRate: document.getElementById('feed-rate'),
            travelFeedRate: document.getElementById('travel-feed-rate'),
            penOffsetX: document.getElementById('pen-offset-x'),
            penOffsetY: document.getElementById('pen-offset-y'),
            penOffsetZ: document.getElementById('pen-offset-z'),
            gcodeHeader: document.getElementById('gcode-header'),
            gcodeFooter: document.getElementById('gcode-footer'),
            optimizePaths: document.getElementById('optimize-paths'),
            
            // Exclusion zones
            btnAddZone: document.getElementById('btn-add-zone'),
            zoneModal: document.getElementById('zone-modal'),
            zoneModalClose: document.getElementById('zone-modal-close'),
            zoneModalCancel: document.getElementById('zone-modal-cancel'),
            zoneModalAdd: document.getElementById('zone-modal-add'),
            zoneName: document.getElementById('zone-name'),
            zoneX: document.getElementById('zone-x'),
            zoneY: document.getElementById('zone-y'),
            zoneWidth: document.getElementById('zone-width'),
            zoneHeight: document.getElementById('zone-height'),
            zoneList: document.getElementById('zone-list'),
            
            // Presets
            btnSavePreset: document.getElementById('btn-save-preset'),
            btnLoadPreset: document.getElementById('btn-load-preset'),
            presetSaveModal: document.getElementById('preset-save-modal'),
            presetSaveModalClose: document.getElementById('preset-save-modal-close'),
            presetSaveModalCancel: document.getElementById('preset-save-modal-cancel'),
            presetSaveModalSave: document.getElementById('preset-save-modal-save'),
            presetName: document.getElementById('preset-name'),
            presetLoadModal: document.getElementById('preset-load-modal'),
            presetLoadModalClose: document.getElementById('preset-load-modal-close'),
            presetLoadModalCloseBtn: document.getElementById('preset-load-modal-close-btn'),
            presetLoadList: document.getElementById('preset-load-list'),
            
            // G-Code
            btnExportGcode: document.getElementById('btn-export-gcode'),
            btnViewGcode: document.getElementById('btn-view-gcode'),
            gcodeModal: document.getElementById('gcode-modal'),
            modalClose: document.getElementById('modal-close'),
            btnCopyGcode: document.getElementById('btn-copy-gcode'),
            btnDownloadGcode: document.getElementById('btn-download-gcode'),
            gcodeContent: document.getElementById('gcode-content'),
            gcodePreview: document.getElementById('gcode-preview'),
            btnApplyGcode: document.getElementById('btn-apply-gcode'),
            validationPanel: document.getElementById('validation-panel'),
            validationSummary: document.getElementById('validation-summary'),
            validationDetails: document.getElementById('validation-details'),
            
            // 3D Preview
            previewCanvas: document.getElementById('preview-canvas'),
            btnResetCamera: document.getElementById('btn-reset-camera'),
            btnToggleGrid: document.getElementById('btn-toggle-grid'),
            
            // History
            btnUndo: document.getElementById('btn-undo'),
            btnRedo: document.getElementById('btn-redo'),
            
            // Theme
            btnThemeToggle: document.getElementById('btn-theme-toggle'),
            
            // Collision Warning
            collisionWarning: document.getElementById('collision-warning'),
            collisionMessage: document.getElementById('collision-message'),
            btnDismissWarning: document.getElementById('btn-dismiss-warning'),
            
            // Project Management
            btnSaveProject: document.getElementById('btn-save-project'),
            btnLoadProject: document.getElementById('btn-load-project'),
            btnExportProject: document.getElementById('btn-export-project'),
            btnImportProject: document.getElementById('btn-import-project'),
            projectFileInput: document.getElementById('project-file-input'),
            projectSaveModal: document.getElementById('project-save-modal'),
            projectSaveModalClose: document.getElementById('project-save-modal-close'),
            projectSaveModalCancel: document.getElementById('project-save-modal-cancel'),
            projectSaveModalSave: document.getElementById('project-save-modal-save'),
            projectName: document.getElementById('project-name'),
            projectLoadModal: document.getElementById('project-load-modal'),
            projectLoadModalClose: document.getElementById('project-load-modal-close'),
            projectLoadModalCloseBtn: document.getElementById('project-load-modal-close-btn'),
            projectLoadList: document.getElementById('project-load-list'),
            projectNoSaved: document.getElementById('project-no-saved'),
            
            // Lists
            svgList: document.getElementById('svg-list')
        };
    }

    /**
     * Initialize all UI event listeners
     * @private
     */
    _initUI() {
        // Import button
        this.ui.btnImport.addEventListener('click', () => this.ui.fileInput.click());
        this.ui.fileInput.addEventListener('change', (e) => this._handleFileImport(e));
        
        // Transform controls
        this.ui.posX.addEventListener('input', () => this._updateTransform());
        this.ui.posY.addEventListener('input', () => this._updateTransform());
        this.ui.scale.addEventListener('input', () => this._updateTransform());
        this.ui.rotation.addEventListener('input', () => this._updateTransform());
        
        // Settings
        this.ui.btnApplySettings.addEventListener('click', () => {
            this._applySettings();
        });
        
        // Exclusion zones
        this.ui.btnAddZone.addEventListener('click', () => this._openModal('zoneModal'));
        this.ui.zoneModalClose.addEventListener('click', () => this._closeModal('zoneModal'));
        this.ui.zoneModalCancel.addEventListener('click', () => this._closeModal('zoneModal'));
        this.ui.zoneModalAdd.addEventListener('click', () => this._addZone());
        
        // Presets
        this.ui.btnSavePreset.addEventListener('click', () => this._openModal('presetSaveModal'));
        this.ui.btnLoadPreset.addEventListener('click', () => this._showPresetLoadModal());
        this.ui.presetSaveModalClose.addEventListener('click', () => this._closeModal('presetSaveModal'));
        this.ui.presetSaveModalCancel.addEventListener('click', () => this._closeModal('presetSaveModal'));
        this.ui.presetSaveModalSave.addEventListener('click', () => this._savePreset());
        this.ui.presetLoadModalClose.addEventListener('click', () => this._closeModal('presetLoadModal'));
        this.ui.presetLoadModalCloseBtn.addEventListener('click', () => this._closeModal('presetLoadModal'));
        
        // Project Management
        this.ui.btnSaveProject.addEventListener('click', () => this._openModal('projectSaveModal'));
        this.ui.btnLoadProject.addEventListener('click', () => this._showProjectLoadModal());
        this.ui.btnExportProject.addEventListener('click', () => this._exportProjectToFile());
        this.ui.btnImportProject.addEventListener('click', () => this.ui.projectFileInput.click());
        this.ui.projectFileInput.addEventListener('change', (e) => this._handleProjectImport(e));
        this.ui.projectSaveModalClose.addEventListener('click', () => this._closeModal('projectSaveModal'));
        this.ui.projectSaveModalCancel.addEventListener('click', () => this._closeModal('projectSaveModal'));
        this.ui.projectSaveModalSave.addEventListener('click', () => this._saveProject());
        this.ui.projectLoadModalClose.addEventListener('click', () => this._closeModal('projectLoadModal'));
        this.ui.projectLoadModalCloseBtn.addEventListener('click', () => this._closeModal('projectLoadModal'));
        
        // G-Code buttons
        this.ui.btnExportGcode.addEventListener('click', () => this._exportGCode());
        this.ui.btnViewGcode.addEventListener('click', () => this._viewGCode());
        
        // 3D controls
        this.ui.btnResetCamera.addEventListener('click', () => {
            if (this.preview3D) this.preview3D.resetCamera();
        });
        this.ui.btnToggleGrid.addEventListener('click', () => {
            if (this.preview3D) this.preview3D.toggleGrid();
        });
        
        // History controls
        this.ui.btnUndo.addEventListener('click', () => this._handleUndo());
        this.ui.btnRedo.addEventListener('click', () => this._handleRedo());
        
        // Theme toggle
        this.ui.btnThemeToggle.addEventListener('click', () => this._toggleTheme());
        
        // Collision warning dismiss
        this.ui.btnDismissWarning.addEventListener('click', () => {
            this.ui.collisionWarning.style.display = 'none';
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
        
        // G-Code modal controls
        this.ui.modalClose.addEventListener('click', () => this._closeModal('gcodeModal'));
        this.ui.btnCopyGcode.addEventListener('click', () => this._copyGCode());
        this.ui.btnDownloadGcode.addEventListener('click', () => this._downloadGCode());
        
        // Close modal on background click
        this.ui.gcodeModal.addEventListener('click', (e) => {
            if (e.target.id === 'gcode-modal') this._closeModal('gcodeModal');
        });
    }

    /**
     * Initialize 3D preview with canvas and bed size
     * @private
     */
    _init3DPreview() {
        this.preview3D = new Preview3D(this.ui.previewCanvas);
        
        // Set initial bed size
        const bedWidth = parseFloat(this.ui.bedWidth.value);
        const bedHeight = parseFloat(this.ui.bedHeight.value);
        this.preview3D.setBedSize(bedWidth, bedHeight);
    }

    /**
     * Handle file import - routes to SVG or image handler based on file type
     * @private
     * @param {Event} event - File input change event
     */
    async _handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Reset file input
        event.target.value = '';
        
        try {
            // Check if it's an SVG file (by MIME type or extension)
            const isSVG = file.type === 'image/svg+xml' || 
                          file.name.toLowerCase().endsWith('.svg');
            
            if (isSVG) {
                // Handle as SVG directly
                await this._handleSVGImport(file);
            } else if (this._isRasterImage(file)) {
                // Handle as raster image (needs conversion)
                await this._handleImageImport(file);
            } else {
                // Fallback: try as SVG
                await this._handleSVGImport(file);
            }
        } catch (error) {
            console.error('Error importing file:', error);
            alert('Failed to import file: ' + error.message + '\n\nCheck console (F12) for details.');
        }
    }

    /**
     * Check if file is a raster image (PNG, JPG, GIF, etc.)
     * @private
     * @param {File} file - File to check
     * @returns {boolean} True if raster image
     */
    _isRasterImage(file) {
        const rasterTypes = [
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/gif',
            'image/bmp',
            'image/webp'
        ];
        
        const rasterExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
        
        return rasterTypes.includes(file.type.toLowerCase()) ||
               rasterExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    /**
     * Handle SVG file import
     * @private
     * @param {File} file - SVG file to import
     */
    async _handleSVGImport(file) {
        const result = await this._loadSVGFile(file);
        const dialogResult = await this._showImportDialog(file, result);
        
        if (!dialogResult) {
            return;
        }
        
        const { id, autoScale } = this._calculateSVGPlacement(result);
        this._addSVGToWorkspace(id, file.name, result, autoScale);
    }

    /**
     * Handle image file import with conversion to SVG
     * @private
     * @param {File} file - Image file to import
     */
    async _handleImageImport(file) {
        // Show image import dialog with conversion controls
        const imageDialog = new ImageImportDialog(file);
        const svgString = await imageDialog.show();
        
        if (!svgString) {
            return; // User cancelled
        }
        
        // Process the SVG string to get polylines
        const result = SVGProcessor._processContent(svgString, false, 2.0);
        
        if (result.polylines.length === 0) {
            alert('No paths found in converted SVG.');
            return;
        }
        
        // Show standard import dialog for final confirmation
        const dialogResult = await this._showImportDialog(file, result);
        
        if (!dialogResult) {
            return;
        }
        
        // Add to workspace
        const { id, autoScale } = this._calculateSVGPlacement(result);
        const filename = file.name.replace(/\.[^/.]+$/, '') + '.svg'; // Replace extension with .svg
        this._addSVGToWorkspace(id, filename, result, autoScale);
    }

    /**
     * Load and parse SVG file
     * @private
     * @param {File} file - SVG file to load
     * @returns {Promise<Object>} Parsed SVG data with polylines, bounds, scaleFactor, physical dimensions
     */
    async _loadSVGFile(file) {
        const { polylines, bounds, scaleFactor, physical, viewBox } = await SVGProcessor.loadSVG(file);
        
        if (polylines.length === 0) {
            throw new Error('No paths found in SVG file.');
        }
        
        return { polylines, bounds, scaleFactor, physical, viewBox };
    }

    /**
     * Show import preview dialog and await user decision
     * @private
     * @param {File} file - Original SVG file
     * @param {Object} result - Parsed SVG data
     * @returns {Promise<Object|null>} Dialog result or null if cancelled
     */
    async _showImportDialog(file, result) {
        const { polylines, bounds, scaleFactor, physical, viewBox } = result;
        const dialog = new ImportDialog(file, polylines, bounds, { scaleFactor, physical, viewBox });
        return await dialog.show();
    }

    /**
     * Calculate SVG placement - imports at original size (1:1 scale)
     * @private
     * @param {Object} result - Parsed SVG data
     * @returns {Object} Contains scale factor (always 1.0 for original size)
     */
    _calculateSVGPlacement(result) {
        // Import at original size (1:1 scale), centered at bed center (128, 128)
        return { id: null, autoScale: 1.0 };
    }

    /**
     * Add SVG to workspace with managers and UI
     * @private
     * @param {string|null} suggestedId - Suggested ID or null for auto-generation
     * @param {string} filename - Original filename
     * @param {Object} svgData - Parsed SVG data
     * @param {number} autoScale - Calculated scale factor
     */
    _addSVGToWorkspace(suggestedId, filename, svgData, autoScale) {
        const { polylines, bounds, scaleFactor, physical, viewBox } = svgData;
        
        // Pass metadata (physical dimensions, scale factor) to SVG manager
        const id = this.svgManager.addSVG(filename, polylines, bounds, autoScale, { 
            scaleFactor, 
            physical, 
            viewBox 
        });
        
        // Capture state after addition for undo
        if (!this.pendingHistoryAction) {
            const afterState = this._captureState('add', id);
            if (afterState) {
                this.history.pushState('add', afterState);
                this._updateHistoryButtons();
            }
        }
        
        // Update UI
        this._addSVGToList(id, filename);
        this._selectSVG(id);
        
        // Update 3D preview with color
        const svg = this.svgManager.getSelectedSVG();
        const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
        const color = this._getColorForSVG(id);
        this.preview3D.addSVG(id, transformedPolylines, color);
        this.preview3D.selectSVG(id);
    }

    /**
     * Get distinct color for SVG based on index
     * @private
     * @param {string} id - SVG identifier
     * @returns {number} Hex color value
     */
    _getColorForSVG(id) {
        const index = Array.from(this.svgManager.svgObjects.keys()).indexOf(id);
        return COLOR_PALETTE[index % COLOR_PALETTE.length];
    }

    /**
     * Add SVG item to sidebar list with controls
     * @private
     * @param {string} id - SVG identifier
     * @param {string} filename - Display filename
     */
    _addSVGToList(id, filename) {
        const li = document.createElement('li');
        li.className = 'svg-list__item';
        li.dataset.id = id;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'svg-name';
        nameSpan.textContent = filename;
        nameSpan.title = filename;
        
        const controls = document.createElement('div');
        controls.className = 'svg-list__controls';
        
        const visBtn = document.createElement('button');
        visBtn.textContent = '👁';
        visBtn.title = 'Toggle visibility';
        visBtn.setAttribute('aria-label', 'Toggle visibility');
        visBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleVisibility(id);
        });
        
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑';
        delBtn.title = 'Remove';
        delBtn.setAttribute('aria-label', 'Remove');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._removeSVG(id);
        });
        
        controls.appendChild(visBtn);
        controls.appendChild(delBtn);
        
        li.appendChild(nameSpan);
        li.appendChild(controls);
        
        li.addEventListener('click', () => this._selectSVG(id));
        
        this.ui.svgList.appendChild(li);
    }

    /**
     * Select SVG and update UI state
     * @private
     * @param {string} id - SVG identifier to select
     */
    _selectSVG(id) {
        this.selectedSVGId = id;
        this.svgManager.selectSVG(id);
        
        // Update list UI
        document.querySelectorAll('#svg-list li').forEach(li => {
            li.classList.toggle('svg-list__item--selected', li.dataset.id === id);
        });
        
        // Update transform controls
        const svg = this.svgManager.getSelectedSVG();
        if (svg) {
            this.ui.posX.value = svg.translation[0].toFixed(1);
            this.ui.posY.value = svg.translation[1].toFixed(1);
            this.ui.scale.value = (svg.scale * 100).toFixed(0);
            this.ui.rotation.value = svg.rotation.toFixed(0);
            this._updateSizeDisplay();
        }
        
        // Update 3D preview
        this.preview3D.selectSVG(id);
    }

    /**
     * Remove SVG from workspace
     * @private
     * @param {string} id - SVG identifier to remove
     */
    _removeSVG(id) {
        // Capture state before removal for undo
        if (!this.pendingHistoryAction) {
            const beforeState = this._captureState('remove', id);
            if (beforeState) {
                this.history.pushState('remove', beforeState);
                this._updateHistoryButtons();
            }
        }
        
        this.svgManager.removeSVG(id);
        
        // Remove from list
        const li = this.ui.svgList.querySelector(`li[data-id="${id}"]`);
        if (li) li.remove();
        
        // Remove from 3D preview
        this.preview3D.removeSVG(id);
        
        // Select another SVG if available
        if (this.svgManager.svgObjects.size > 0) {
            const firstId = this.svgManager.svgObjects.keys().next().value;
            this._selectSVG(firstId);
        } else {
            this.selectedSVGId = null;
        }
    }

    /**
     * Toggle SVG visibility
     * @private
     * @param {string} id - SVG identifier
     */
    _toggleVisibility(id) {
        // Capture state before toggle for undo
        if (!this.pendingHistoryAction) {
            const beforeState = this._captureState('visibility', id);
            if (beforeState) {
                this.history.pushState('visibility', beforeState);
                this._updateHistoryButtons();
            }
        }
        
        this.svgManager.toggleVisibility(id);
        const svg = this.svgManager.svgObjects.get(id);
        
        // Update list button
        const li = this.ui.svgList.querySelector(`li[data-id="${id}"]`);
        const visBtn = li.querySelector('button[title="Toggle visibility"]');
        visBtn.textContent = svg.visible ? '👁' : '🚫';
        
        // Update 3D preview
        if (svg.visible) {
            const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
            const color = this._getColorForSVG(id);
            this.preview3D.addSVG(id, transformedPolylines, color);
            if (this.selectedSVGId === id) {
                this.preview3D.selectSVG(id);
            }
        } else {
            this.preview3D.removeSVG(id);
        }
    }

    /**
     * Update SVG transformation from UI controls
     * @private
     */
    _updateTransform() {
        if (!this.selectedSVGId) return;
        
        // Capture state before transformation for undo
        if (!this.pendingHistoryAction) {
            const beforeState = this._captureState('transform', this.selectedSVGId);
            if (beforeState) {
                this.history.pushState('transform', beforeState);
                this._updateHistoryButtons();
            }
        }
        
        const tx = parseFloat(this.ui.posX.value);
        const ty = parseFloat(this.ui.posY.value);
        const scale = parseFloat(this.ui.scale.value) / 100;
        const rotation = parseFloat(this.ui.rotation.value);
        
        this.svgManager.updateTransformation(
            this.selectedSVGId,
            [tx, ty],
            scale,
            rotation
        );
        
        // Update 3D preview
        const svg = this.svgManager.getSelectedSVG();
        if (svg && svg.visible) {
            const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
            const color = this._getColorForSVG(this.selectedSVGId);
            this.preview3D.updateSVG(this.selectedSVGId, transformedPolylines, color);
        }
        
        // Update size display
        this._updateSizeDisplay();
        
        // Check for collisions
        this._checkCollisions();
    }

    /**
     * Apply bed dimensions to managers and preview
     * @private
     */
    _applySettings() {
        const bedWidth = parseFloat(this.ui.bedWidth.value);
        const bedHeight = parseFloat(this.ui.bedHeight.value);
        
        this.svgManager.setBedSize(bedWidth, bedHeight);
        this.preview3D.setBedSize(bedWidth, bedHeight);
    }

    /**
     * @typedef {Object} Settings
     * @property {number} bedWidth - Print bed width in mm
     * @property {number} bedHeight - Print bed height in mm
     * @property {number} penUpZ - Z height when pen is up (mm)
     * @property {number} sheetHeight - Sheet/paper height (mm)
     * @property {number} feedRate - Drawing feed rate (mm/min)
     * @property {number} travelFeedRate - Travel feed rate (mm/min)
     * @property {number[]} penOffset - [X, Y, Z] offset for pen position (mm)
     * @property {string} headerTemplate - G-Code header template
     * @property {string} footerTemplate - G-Code footer template
     */

    /**
     * Get current settings from UI
     * @private
     * @returns {Settings} Current settings object
     */
    _getSettings() {
        return {
            bedWidth: parseFloat(this.ui.bedWidth.value),
            bedHeight: parseFloat(this.ui.bedHeight.value),
            penUpZ: parseFloat(this.ui.penUpZ.value),
            sheetHeight: parseFloat(this.ui.sheetHeight.value),
            feedRate: parseFloat(this.ui.feedRate.value),
            travelFeedRate: parseFloat(this.ui.travelFeedRate.value),
            penOffset: [
                parseFloat(this.ui.penOffsetX.value),
                parseFloat(this.ui.penOffsetY.value),
                parseFloat(this.ui.penOffsetZ.value)
            ],
            headerTemplate: this.ui.gcodeHeader.value,
            footerTemplate: this.ui.gcodeFooter.value
        };
    }

    /**
     * Validate polylines against bed bounds and exclusion zones
     * @private
     * @param {Array} polylines - Array of polylines to validate
     * @param {Settings} settings - Current settings
     * @returns {string} Warning message or empty string
     */
    _getSafetyWarnings(polylines, settings) {
        const bedWidth = parseFloat(this.ui.bedWidth.value);
        const bedHeight = parseFloat(this.ui.bedHeight.value);
        const [offsetX, offsetY] = settings.penOffset;
        let outOfBoundsPoints = 0;
        let zoneHits = 0;

        for (const polyline of polylines) {
            for (const point of polyline) {
                const x = point[0] + offsetX;
                const y = point[1] + offsetY;

                if (Number.isNaN(x) || Number.isNaN(y)) {
                    return 'Some points contain invalid coordinates (NaN). Check SVG import and transforms.';
                }

                if (x < 0 || y < 0 || x > bedWidth || y > bedHeight) {
                    outOfBoundsPoints += 1;
                }

                if (this.exclusionZones.isPointInAnyZone(x, y)) {
                    zoneHits += 1;
                }
            }
        }

        const warnings = [];
        if (outOfBoundsPoints > 0) {
            warnings.push(`Found ${outOfBoundsPoints} point(s) outside the bed (${bedWidth}×${bedHeight}mm).`);
        }
        if (zoneHits > 0) {
            warnings.push(`Found ${zoneHits} point(s) inside exclusion zones.`);
        }

        if (warnings.length === 0) return '';
        return `Warning:\n${warnings.join('\n')}\nG-code will still be generated as-is.`;
    }

    /**
     * Export G-Code to file download
     * @private
     */
    _exportGCode() {
        let svgs = this.svgManager.getAllSVGsWithPolylines();
        const visibleSvgs = svgs.filter(svg => svg.visible);
        
        if (visibleSvgs.length === 0) {
            console.warn('No visible SVG files to export');
            alert('No visible SVG files to export.');
            return;
        }
        
        try {
            const settings = this._getSettings();
            
            // Get all polylines from visible SVGs
            let polylines = visibleSvgs.flatMap(svg => svg.polylines);
            
            // Optimize path order if enabled
            if (this.ui.optimizePaths.checked) {
                polylines = PathOptimizer.optimize(polylines, [0, 0]);
            }
            
            // Generate G-Code
            const gcode = GCodeGenerator.generate(polylines, settings);
            
            // Check for safety warnings
            const warning = this._getSafetyWarnings(polylines, settings);
            if (warning) {
                alert(warning);
            }
            
            // Download file
            const blob = new Blob([gcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plotter_output.gcode';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting G-Code:', error);
            alert('Failed to export G-Code: ' + error.message);
        }
    }

    /**
     * View G-Code in modal
     * @private
     */
    _viewGCode() {
        let svgs = this.svgManager.getAllSVGsWithPolylines();
        const visibleSvgs = svgs.filter(svg => svg.visible);
        
        if (visibleSvgs.length === 0) {
            console.warn('No visible SVG files to view');
            alert('No visible SVG files to view.');
            return;
        }
        
        try {
            const settings = this._getSettings();
            
            // Get all polylines from visible SVGs
            let polylines = visibleSvgs.flatMap(svg => svg.polylines);
            
            // Optimize path order if enabled
            if (this.ui.optimizePaths.checked) {
                polylines = PathOptimizer.optimize(polylines, [0, 0]);
            }
            
            // Generate G-Code
            const gcode = GCodeGenerator.generate(polylines, settings);
            
            // Check for safety warnings
            const warning = this._getSafetyWarnings(polylines, settings);
            if (warning) {
                alert(warning);
            }
            
            // Store G-Code for later use
            this.currentGCode = gcode;
            
            // Validate G-Code
            const validationResult = GCodeValidator.validate(gcode, {
                bedWidth: parseFloat(this.ui.bedWidth.value),
                bedHeight: parseFloat(this.ui.bedHeight.value)
            });
            this._displayValidation(validationResult);
            
            // Show in modal editor
            this.ui.gcodeContent.value = gcode;
            
            this._openModal('gcodeModal');
        } catch (error) {
            console.error('Error generating G-Code:', error);
            alert('Failed to generate G-Code: ' + error.message);
        }
    }

    /**
     * Generic modal closer
     * @private
     * @param {string} modalKey - Key in this.ui object for modal element
     */
    _closeModal(modalKey) {
        this.ui[modalKey].classList.remove('show');
    }

    /**
     * Generic modal opener
     * @private
     * @param {string} modalKey - Key in this.ui object for modal element
     */
    _openModal(modalKey) {
        this.ui[modalKey].classList.add('show');
    }

    /**
     * Copy G-Code to clipboard
     * @private
     */
    _copyGCode() {
        try {
            const gcode = this.currentGCode || this.ui.gcodeContent.value;
            navigator.clipboard.writeText(gcode).then(() => {
                alert('G-Code copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                this.ui.gcodeContent.select();
                document.execCommand('copy');
                alert('G-Code copied to clipboard!');
            });
        } catch (error) {
            console.error('Error copying G-Code:', error);
            alert('Failed to copy G-Code.');
        }
    }

    /**
     * Download G-Code from modal
     * @private
     */
    _downloadGCode() {
        try {
            const gcode = this.currentGCode || this.ui.gcodeContent.value;
            const blob = new Blob([gcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plotter_output.gcode';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading G-Code:', error);
            alert('Failed to download G-Code.');
        }
    }

    /**
     * Display validation results
     * @private
     * @param {Object} result - Validation result from GCodeValidator
     */
    _displayValidation(result) {
        if (!this.ui.validationPanel) return;

        const { valid, errors, warnings, summary } = result;

        // Show/hide panel based on results
        if (errors.length === 0 && warnings.length === 0) {
            this.ui.validationPanel.style.display = 'none';
            return;
        }

        this.ui.validationPanel.style.display = 'block';

        // Update summary
        let summaryClass = valid ? 'validation-success' : 'validation-error';
        if (valid && warnings.length > 0) summaryClass = 'validation-warning';
        
        this.ui.validationSummary.className = `validation-summary ${summaryClass}`;
        this.ui.validationSummary.textContent = summary;

        // Update details
        let detailsHTML = '';

        if (errors.length > 0) {
            detailsHTML += '<div class="validation-section validation-errors">';
            detailsHTML += '<h4>Errors:</h4><ul>';
            errors.forEach(error => {
                detailsHTML += `<li>${this._escapeHTML(error)}</li>`;
            });
            detailsHTML += '</ul></div>';
        }

        if (warnings.length > 0) {
            detailsHTML += '<div class="validation-section validation-warnings">';
            detailsHTML += '<h4>Warnings:</h4><ul>';
            warnings.forEach(warning => {
                detailsHTML += `<li>${this._escapeHTML(warning)}</li>`;
            });
            detailsHTML += '</ul></div>';
        }

        this.ui.validationDetails.innerHTML = detailsHTML;
    }

    /**
     * Escape HTML for display
     * @private
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Add new exclusion zone from modal form
     * @private
     */
    _addZone() {
        const name = this.ui.zoneName.value || `Zone ${this.exclusionZones.zones.size + 1}`;
        const x = parseFloat(this.ui.zoneX.value);
        const y = parseFloat(this.ui.zoneY.value);
        const width = parseFloat(this.ui.zoneWidth.value);
        const height = parseFloat(this.ui.zoneHeight.value);
        
        this.exclusionZones.addZone(x, y, width, height, name);
        this._updateZoneList();
        this._updateZoneVisualization();
        this._closeModal('zoneModal');
        
        // Reset form
        this.ui.zoneName.value = '';
    }

    /**
     * Update exclusion zones list in UI
     * @private
     */
    _updateZoneList() {
        this.ui.zoneList.innerHTML = '';
        
        const zones = this.exclusionZones.getZones();
        zones.forEach(zone => {
            const li = document.createElement('li');
            li.className = 'zone-list__item';
            li.dataset.id = zone.id;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'svg-name';
            nameSpan.textContent = `${zone.name} (${zone.width}×${zone.height}mm)`;
            nameSpan.title = zone.name;
            
            const controls = document.createElement('div');
            controls.className = 'svg-list__controls';
            
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = zone.enabled ? '✓' : '✗';
            toggleBtn.title = 'Toggle';
            toggleBtn.setAttribute('aria-label', 'Toggle zone');
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exclusionZones.toggleZone(zone.id);
                this._updateZoneList();
                this._updateZoneVisualization();
            });
            
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑';
            delBtn.title = 'Remove';
            delBtn.setAttribute('aria-label', 'Remove');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exclusionZones.removeZone(zone.id);
                this._updateZoneList();
                this._updateZoneVisualization();
            });
            
            controls.appendChild(toggleBtn);
            controls.appendChild(delBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(controls);
            this.ui.zoneList.appendChild(li);
        });
    }

    /**
     * Update exclusion zones in 3D preview
     * @private
     */
    _updateZoneVisualization() {
        if (!this.preview3D) return;
        
        const zones = this.exclusionZones.getZones();
        this.preview3D.updateExclusionZones(zones);
    }

    /**
     * Save current settings as preset
     * @private
     */
    _savePreset() {
        const name = this.ui.presetName.value.trim();
        if (!name) {
            alert('Please enter a preset name.');
            return;
        }
        
        try {
            const settings = {
                bedWidth: parseFloat(this.ui.bedWidth.value),
                bedHeight: parseFloat(this.ui.bedHeight.value),
                penUpZ: parseFloat(this.ui.penUpZ.value),
                sheetHeight: parseFloat(this.ui.sheetHeight.value),
                penOffsetX: parseFloat(this.ui.penOffsetX.value),
                penOffsetY: parseFloat(this.ui.penOffsetY.value),
                penOffsetZ: parseFloat(this.ui.penOffsetZ.value),
                feedRate: parseFloat(this.ui.feedRate.value),
                travelFeedRate: parseFloat(this.ui.travelFeedRate.value),
                headerTemplate: this.ui.gcodeHeader.value,
                footerTemplate: this.ui.gcodeFooter.value
            };
            
            this.presetManager.savePreset(name, settings);
            this._closeModal('presetSaveModal');
            alert(`Preset "${name}" saved!`);
        } catch (error) {
            console.error('Error saving preset:', error);
            alert('Failed to save preset: ' + error.message);
        }
    }

    /**
     * Show preset load modal with available presets
     * @private
     */
    _showPresetLoadModal() {
        this.ui.presetLoadList.innerHTML = '';
        
        const presets = this.presetManager.getAllPresets();
        if (presets.length === 0) {
            this.ui.presetLoadList.innerHTML = '<li style="padding: 10px;">No presets saved yet.</li>';
        } else {
            presets.forEach(preset => {
                const li = document.createElement('li');
                li.className = 'preset-grid__card';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'svg-name';
                nameSpan.textContent = preset.name;
                nameSpan.title = preset.name;
                
                const controls = document.createElement('div');
                controls.className = 'svg-list__controls';
                
                const loadBtn = document.createElement('button');
                loadBtn.textContent = '📥';
                loadBtn.title = 'Load';
                loadBtn.setAttribute('aria-label', 'Load preset');
                loadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._loadPreset(preset.name);
                });
                
                const delBtn = document.createElement('button');
                delBtn.textContent = '🗑';
                delBtn.title = 'Delete';
                delBtn.setAttribute('aria-label', 'Delete preset');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete preset "${preset.name}"?`)) {
                        this.presetManager.deletePreset(preset.name);
                        this._showPresetLoadModal(); // Refresh list
                    }
                });
                
                controls.appendChild(loadBtn);
                controls.appendChild(delBtn);
                
                li.appendChild(nameSpan);
                li.appendChild(controls);
                this.ui.presetLoadList.appendChild(li);
            });
        }
        
        this._openModal('presetLoadModal');
    }

    /**
     * Load preset by name and apply to UI
     * @private
     * @param {string} name - Preset name to load
     */
    _loadPreset(name) {
        const preset = this.presetManager.loadPreset(name);
        if (!preset) {
            console.error('Preset not found:', name);
            return;
        }
        
        try {
            const { settings } = preset;
            this.ui.bedWidth.value = settings.bedWidth;
            this.ui.bedHeight.value = settings.bedHeight;
            this.ui.penUpZ.value = settings.penUpZ;
            this.ui.sheetHeight.value = settings.sheetHeight;
            this.ui.penOffsetX.value = settings.penOffsetX;
            this.ui.penOffsetY.value = settings.penOffsetY;
            this.ui.penOffsetZ.value = settings.penOffsetZ;
            this.ui.feedRate.value = settings.feedRate ?? 3000;
            this.ui.travelFeedRate.value = settings.travelFeedRate ?? 9000;
            this.ui.gcodeHeader.value = settings.headerTemplate ?? this.ui.gcodeHeader.value;
            this.ui.gcodeFooter.value = settings.footerTemplate ?? this.ui.gcodeFooter.value;
            
            this._applySettings();
            this._closeModal('presetLoadModal');
            alert(`Preset "${name}" loaded!`);
        } catch (error) {
            console.error('Error loading preset:', error);
            alert('Failed to load preset: ' + error.message);
        }
    }

    // ========================================
    // HISTORY / UNDO-REDO SYSTEM
    // ========================================

    /**
     * Capture current state for history
     * @private
     * @param {string} action - Action type
     * @param {string} id - SVG ID
     * @returns {Object} State snapshot
     */
    _captureState(action, id) {
        const svg = this.svgManager.svgObjects.get(id);
        if (!svg) return null;

        return {
            id,
            action,
            translation: [...svg.translation],
            scale: svg.scale,
            rotation: svg.rotation,
            visible: svg.visible,
            // For add/remove actions
            filename: svg.filename,
            polylines: svg.polylines,
            originalBounds: svg.originalBounds,
            metadata: svg.metadata
        };
    }

    /**
     * Restore state from history snapshot
     * @private
     * @param {Object} state - State snapshot
     */
    _restoreState(state) {
        const { id, action } = state;

        this.pendingHistoryAction = true; // Prevent recursive history captures

        try {
            switch (action) {
                case 'transform': {
                    const svg = this.svgManager.svgObjects.get(id);
                    if (svg) {
                        svg.translation = [...state.translation];
                        svg.scale = state.scale;
                        svg.rotation = state.rotation;

                        // Update UI if this is the selected SVG
                        if (this.selectedSVGId === id) {
                            this.ui.posX.value = state.translation[0].toFixed(1);
                            this.ui.posY.value = state.translation[1].toFixed(1);
                            this.ui.scale.value = (state.scale * 100).toFixed(0);
                            this.ui.rotation.value = state.rotation.toFixed(0);
                        }

                        // Update 3D preview
                        if (svg.visible) {
                            const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
                            const color = this._getColorForSVG(id);
                            this.preview3D.updateSVG(id, transformedPolylines, color);
                        }
                    }
                    break;
                }
                case 'remove': {
                    // Re-add the SVG
                    this.svgManager.svgObjects.set(id, {
                        id,
                        filename: state.filename,
                        polylines: state.polylines,
                        originalBounds: state.originalBounds,
                        centerViewBox: state.centerViewBox || [0, 0],
                        translation: [...state.translation],
                        scale: state.scale,
                        rotation: state.rotation,
                        visible: state.visible,
                        metadata: state.metadata
                    });

                    this._addSVGToList(id, state.filename);

                    // Update 3D preview
                    if (state.visible) {
                        const svg = this.svgManager.svgObjects.get(id);
                        const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
                        const color = this._getColorForSVG(id);
                        this.preview3D.addSVG(id, transformedPolylines, color);
                    }
                    break;
                }
                case 'add': {
                    // Remove the SVG
                    this.svgManager.removeSVG(id);
                    const li = this.ui.svgList.querySelector(`li[data-id="${id}"]`);
                    if (li) li.remove();
                    this.preview3D.removeSVG(id);

                    // Select another SVG if available
                    if (this.svgManager.svgObjects.size > 0) {
                        const firstId = this.svgManager.svgObjects.keys().next().value;
                        this._selectSVG(firstId);
                    } else {
                        this.selectedSVGId = null;
                    }
                    break;
                }
                case 'visibility': {
                    const svg = this.svgManager.svgObjects.get(id);
                    if (svg) {
                        svg.visible = state.visible;

                        // Update list button
                        const li = this.ui.svgList.querySelector(`li[data-id="${id}"]`);
                        const visBtn = li?.querySelector('button[title="Toggle visibility"]');
                        if (visBtn) visBtn.textContent = state.visible ? '👁' : '🚫';

                        // Update 3D preview
                        if (state.visible) {
                            const transformedPolylines = this.svgManager.getTransformedPolylines(svg);
                            const color = this._getColorForSVG(id);
                            this.preview3D.addSVG(id, transformedPolylines, color);
                            if (this.selectedSVGId === id) {
                                this.preview3D.selectSVG(id);
                            }
                        } else {
                            this.preview3D.removeSVG(id);
                        }
                    }
                    break;
                }
            }
        } finally {
            this.pendingHistoryAction = false;
        }
    }

    /**
     * Handle undo action
     * @private
     */
    _handleUndo() {
        const state = this.history.undo();
        if (state) {
            this._restoreState(state.data);
            this._updateHistoryButtons();
        }
    }

    /**
     * Handle redo action
     * @private
     */
    _handleRedo() {
        const state = this.history.redo();
        if (state) {
            // For redo, we need to apply the opposite of what undo did
            const oppositeAction = this._getOppositeAction(state.data.action);
            this._restoreState({ ...state.data, action: oppositeAction });
            this._updateHistoryButtons();
        }
    }

    /**
     * Get opposite action for redo
     * @private
     * @param {string} action - Original action
     * @returns {string} Opposite action
     */
    _getOppositeAction(action) {
        const opposites = {
            'add': 'remove',
            'remove': 'add',
            'transform': 'transform',
            'visibility': 'visibility'
        };
        return opposites[action] || action;
    }

    /**
     * Update undo/redo button states
     * @private
     */
    _updateHistoryButtons() {
        this.ui.btnUndo.disabled = !this.history.canUndo();
        this.ui.btnRedo.disabled = !this.history.canRedo();
    }

    // ========================================
    // KEYBOARD SHORTCUTS
    // ========================================

    /**
     * Handle keyboard shortcuts
     * @private
     * @param {KeyboardEvent} event - Keyboard event
     */
    _handleKeyboard(event) {
        // Don't handle shortcuts when typing in input fields
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        // Ctrl+Z: Undo (works everywhere)
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this._handleUndo();
            return;
        }

        // Ctrl+Shift+Z or Ctrl+Y: Redo (works everywhere)
        if (((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
            ((event.ctrlKey || event.metaKey) && event.key === 'y')) {
            event.preventDefault();
            this._handleRedo();
            return;
        }

        // Ctrl+E: Export G-Code (works everywhere except input fields)
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            this._exportGCode();
            return;
        }

        // Escape: Close modals (works everywhere)
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                const modalId = openModal.id;
                this._closeModal(modalId);
                event.preventDefault();
            }
            return;
        }

        // Don't handle other shortcuts in input fields
        if (isInputField) return;

        // Delete: Remove selected SVG
        if (event.key === 'Delete' && this.selectedSVGId) {
            event.preventDefault();
            if (confirm('Remove selected SVG?')) {
                this._removeSVG(this.selectedSVGId);
            }
            return;
        }

        // Arrow keys: Move selected SVG
        if (this.selectedSVGId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            const step = event.shiftKey ? 10 : 1; // 10mm with Shift, 1mm without
            const svg = this.svgManager.getSelectedSVG();
            if (!svg) return;

            let [x, y] = svg.translation;

            switch (event.key) {
                case 'ArrowUp':
                    y -= step;
                    break;
                case 'ArrowDown':
                    y += step;
                    break;
                case 'ArrowLeft':
                    x -= step;
                    break;
                case 'ArrowRight':
                    x += step;
                    break;
            }

            // Update UI inputs
            this.ui.posX.value = x.toFixed(1);
            this.ui.posY.value = y.toFixed(1);

            // Trigger transform update
            this._updateTransform();
            return;
        }
    }

    // ========================================
    // THEME MANAGEMENT
    // ========================================

    /**
     * Toggle theme between light and dark
     * @private
     */
    _toggleTheme() {
        this.themeManager.toggleTheme();
        this._updateThemeButton();
    }

    /**
     * Update theme toggle button text
     * @private
     */
    _updateThemeButton() {
        const theme = this.themeManager.getCurrentTheme();
        this.ui.btnThemeToggle.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
        this.ui.btnThemeToggle.title = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
    }

    /**
     * Update size display with current SVG dimensions after scaling
     * @private
     */
    _updateSizeDisplay() {
        const svg = this.svgManager.getSelectedSVG();
        if (!svg || !this.ui.svgSize) {
            if (this.ui.svgSize) {
                this.ui.svgSize.textContent = '-';
            }
            return;
        }
        
        const { originalBounds, scale, metadata } = svg;
        const originalWidth = originalBounds.maxX - originalBounds.minX;
        const originalHeight = originalBounds.maxY - originalBounds.minY;
        const mmScale = metadata?.scaleFactor?.avgScale || 1.0;
        
        const scaledWidth = originalWidth * mmScale * scale;
        const scaledHeight = originalHeight * mmScale * scale;
        
        this.ui.svgSize.textContent = `${scaledWidth.toFixed(1)} × ${scaledHeight.toFixed(1)}`;
    }

    /**
     * Check for collisions and display warning
     * @private
     */
    _checkCollisions() {
        const polylines = this.svgManager.getAllPolylines();
        
        if (polylines.length === 0) {
            this.ui.collisionWarning.style.display = 'none';
            return;
        }

        const settings = this._getSettings();
        const exclusionZones = this.exclusionZones.getAllZones();

        const result = this.preview3D.checkCollisions(polylines, settings, exclusionZones);

        if (result.hasCollisions) {
            let message = '';
            if (result.outOfBounds > 0) {
                message += `${result.outOfBounds} point(s) outside bed area. `;
            }
            if (result.zoneCollisions > 0) {
                message += `${result.zoneCollisions} point(s) in exclusion zones.`;
            }
            
            this.ui.collisionMessage.textContent = message;
            this.ui.collisionWarning.style.display = 'flex';
        } else {
            this.ui.collisionWarning.style.display = 'none';
        }
    }

    // ========================================
    // PROJECT MANAGEMENT
    // ========================================

    /**
     * Save project to localStorage
     * @private
     */
    _saveProject() {
        const name = this.ui.projectName.value.trim();
        if (!name) {
            alert('Please enter a project name.');
            return;
        }

        try {
            this.projectManager.saveProject(name);
            this._closeModal('projectSaveModal');
            this.ui.projectName.value = '';
            alert(`Project "${name}" saved successfully!`);
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Failed to save project: ' + error.message);
        }
    }

    /**
     * Show project load modal with project list
     * @private
     */
    _showProjectLoadModal() {
        this._openModal('projectLoadModal');
        this._updateProjectList();
    }

    /**
     * Update project list in modal
     * @private
     */
    _updateProjectList() {
        const projects = this.projectManager.getAllProjects();
        const projectNames = Object.keys(projects);

        if (projectNames.length === 0) {
            this.ui.projectNoSaved.style.display = 'block';
            this.ui.projectLoadList.innerHTML = '';
            return;
        }

        this.ui.projectNoSaved.style.display = 'none';
        this.ui.projectLoadList.innerHTML = '';

        projectNames.forEach(name => {
            const project = projects[name];
            const li = document.createElement('li');
            li.className = 'project-list__item';

            const info = document.createElement('div');
            info.className = 'project-info';
            
            const title = document.createElement('strong');
            title.textContent = name;
            
            const date = document.createElement('small');
            const timestamp = new Date(project.timestamp);
            date.textContent = timestamp.toLocaleString();
            date.style.color = 'var(--color-text-secondary)';
            
            const meta = document.createElement('small');
            meta.textContent = `${project.svgs.length} SVGs, ${project.exclusionZones?.length || 0} zones`;
            meta.style.color = 'var(--color-text-secondary)';

            info.appendChild(title);
            info.appendChild(document.createElement('br'));
            info.appendChild(date);
            info.appendChild(document.createElement('br'));
            info.appendChild(meta);

            const controls = document.createElement('div');
            controls.className = 'project-controls';

            const btnLoad = document.createElement('button');
            btnLoad.textContent = 'Load';
            btnLoad.className = 'btn--primary';
            btnLoad.addEventListener('click', () => this._loadProject(name));

            const btnDelete = document.createElement('button');
            btnDelete.textContent = 'Delete';
            btnDelete.className = 'btn--danger';
            btnDelete.addEventListener('click', () => this._deleteProject(name));

            controls.appendChild(btnLoad);
            controls.appendChild(btnDelete);

            li.appendChild(info);
            li.appendChild(controls);

            this.ui.projectLoadList.appendChild(li);
        });
    }

    /**
     * Load project from localStorage
     * @private
     * @param {string} name - Project name
     */
    _loadProject(name) {
        const projectData = this.projectManager.loadProject(name);
        if (!projectData) {
            alert('Project not found.');
            return;
        }

        if (!confirm(`Load project "${name}"? This will clear current work.`)) {
            return;
        }

        try {
            this._applyProjectData(projectData);
            this._closeModal('projectLoadModal');
            alert(`Project "${name}" loaded successfully!`);
        } catch (error) {
            console.error('Error loading project:', error);
            alert('Failed to load project: ' + error.message);
        }
    }

    /**
     * Delete project from localStorage
     * @private
     * @param {string} name - Project name
     */
    _deleteProject(name) {
        if (!confirm(`Delete project "${name}"?`)) return;

        this.projectManager.deleteProject(name);
        this._updateProjectList();
    }

    /**
     * Export project to JSON file
     * @private
     */
    _exportProjectToFile() {
        const name = prompt('Enter project name for export:');
        if (!name) return;

        try {
            this.projectManager.exportToFile(name);
        } catch (error) {
            console.error('Error exporting project:', error);
            alert('Failed to export project: ' + error.message);
        }
    }

    /**
     * Handle project import from file
     * @private
     */
    async _handleProjectImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const projectData = await this.projectManager.importFromFile(file);
            
            if (!confirm(`Import project "${projectData.name}"? This will clear current work.`)) {
                return;
            }

            this._applyProjectData(projectData);
            alert(`Project "${projectData.name}" imported successfully!`);
        } catch (error) {
            console.error('Error importing project:', error);
            alert('Failed to import project: ' + error.message);
        } finally {
            event.target.value = ''; // Reset file input
        }
    }

    /**
     * Apply project data to current state
     * @private
     * @param {Object} projectData - Project data to apply
     */
    _applyProjectData(projectData) {
        // Clear current SVGs and zones
        this.ui.svgList.innerHTML = '';
        this.svgManager.svgObjects.clear();
        this.svgManager.nextId = 1;
        this.selectedSVGId = null;
        
        this.exclusionZones.zones = [];
        
        // Clear 3D preview
        if (this.preview3D) {
            this.preview3D.clearAll();
        }

        // Apply settings to UI
        if (projectData.settings) {
            const s = projectData.settings;
            this.ui.bedWidth.value = s.bedWidth;
            this.ui.bedHeight.value = s.bedHeight;
            this.ui.penUpZ.value = s.penUpZ;
            this.ui.sheetHeight.value = s.sheetHeight;
            this.ui.feedRate.value = s.feedRate;
            this.ui.travelFeedRate.value = s.travelFeedRate;
            this.ui.penOffsetX.value = s.penOffsetX || 0;
            this.ui.penOffsetY.value = s.penOffsetY || 0;
            this.ui.penOffsetZ.value = s.penOffsetZ || 0;
            if (s.gcodeHeader) this.ui.gcodeHeader.value = s.gcodeHeader;
            if (s.gcodeFooter) this.ui.gcodeFooter.value = s.gcodeFooter;
        }

        // Restore exclusion zones
        projectData.exclusionZones?.forEach(zone => {
            this.exclusionZones.addZone(zone.name, zone.x, zone.y, zone.width, zone.height);
        });
        this._updateZoneList();

        // Restore SVGs
        projectData.svgs.forEach(svg => {
            const id = this.svgManager.addSVG(
                svg.filename,
                svg.polylines,
                svg.originalBounds,
                svg.scale,
                svg.metadata
            );

            const svgObj = this.svgManager.svgObjects.get(id);
            if (svgObj) {
                svgObj.translation = svg.translation;
                svgObj.rotation = svg.rotation;
                svgObj.visible = svg.visible;
                svgObj.penColor = svg.penColor || 'default';
                svgObj.hatchingEnabled = svg.hatchingEnabled || false;
                svgObj.hatchingSettings = svg.hatchingSettings || { spacing: 2, angle: 45, pattern: 'parallel' };

                this._addSVGToList(id, svg.filename);

                if (svg.visible) {
                    const polylines = this.svgManager.getTransformedPolylines(svgObj);
                    const color = this._getColorForSVG(id);
                    this.preview3D.addSVG(id, polylines, color);
                }
            }
        });

        // Update 3D preview bed size
        this._applySettings();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
