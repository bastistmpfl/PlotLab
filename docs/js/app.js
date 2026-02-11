// Main Application
import { SVGManager } from './svgManager.js';
import { SVGProcessor } from './svgProcessor.js';
import { GCodeGenerator } from './gcodeGenerator.js';
import { Preview3D } from './preview3d.js';
import { ImportDialog } from './importDialog.js';
import { ExclusionZonesManager } from './exclusionZones.js';
import { PresetManager } from './presetManager.js';

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
        this.preview3D = null;
        this.selectedSVGId = null;
        
        // Cache all DOM elements and initialize
        this._cacheDOM();
        this._initUI();
        this._init3DPreview();
        this._updateZoneList();
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
            
            // 3D Preview
            previewCanvas: document.getElementById('preview-canvas'),
            btnResetCamera: document.getElementById('btn-reset-camera'),
            btnToggleGrid: document.getElementById('btn-toggle-grid'),
            
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
        this.ui.btnApplySettings.addEventListener('click', () => this._applySettings());
        
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
     * Handle SVG file import from file input
     * @private
     * @param {Event} event - File input change event
     */
    async _handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const result = await this._loadSVGFile(file);
            const dialogResult = await this._showImportDialog(file, result);
            
            if (!dialogResult) {
                event.target.value = '';
                return;
            }
            
            const { id, autoScale } = this._calculateSVGPlacement(result);
            this._addSVGToWorkspace(id, file.name, result, autoScale);
            
        } catch (error) {
            console.error('Error importing SVG:', error);
            alert('Failed to import SVG file: ' + error.message + '\n\nCheck console (F12) for details.');
        }
        
        // Reset file input
        event.target.value = '';
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
     * Calculate SVG placement with auto-fit scaling
     * @private
     * @param {Object} result - Parsed SVG data
     * @returns {Object} Contains calculated autoScale
     */
    _calculateSVGPlacement(result) {
        const { bounds, scaleFactor } = result;
        const bedWidth = parseFloat(this.ui.bedWidth.value);
        const bedHeight = parseFloat(this.ui.bedHeight.value);
        
        // Calculate auto-fit scale (90% of bed size to leave margin)
        const mmScale = scaleFactor?.avgScale || 1.0;
        const scaledWidth = bounds.width * mmScale;
        const scaledHeight = bounds.height * mmScale;
        const scaleX = (bedWidth * DEFAULT_BED_MARGIN) / scaledWidth;
        const scaleY = (bedHeight * DEFAULT_BED_MARGIN) / scaledHeight;
        const autoScale = Math.min(scaleX, scaleY);
        
        return { id: null, autoScale };
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
        const polylines = this.svgManager.getAllPolylines();
        
        if (polylines.length === 0) {
            console.warn('No visible SVG files to export');
            alert('No visible SVG files to export.');
            return;
        }
        
        try {
            const settings = this._getSettings();
            const warning = this._getSafetyWarnings(polylines, settings);
            if (warning) {
                alert(warning);
            }
            const gcode = GCodeGenerator.generate(polylines, settings);
            
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
        const polylines = this.svgManager.getAllPolylines();
        
        if (polylines.length === 0) {
            console.warn('No visible SVG files to view');
            alert('No visible SVG files to view.');
            return;
        }
        
        try {
            const settings = this._getSettings();
            const warning = this._getSafetyWarnings(polylines, settings);
            if (warning) {
                alert(warning);
            }
            const gcode = GCodeGenerator.generate(polylines, settings);
            
            // Show in modal
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
            this.ui.gcodeContent.select();
            document.execCommand('copy');
            alert('G-Code copied to clipboard!');
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
            const gcode = this.ui.gcodeContent.value;
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
