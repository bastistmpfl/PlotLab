// Constants
const DEFAULT_PEN_UP_Z = 0.6;
const DEFAULT_SHEET_HEIGHT = 0.15;
const DEFAULT_BED_SIZE = 256;
const DEFAULT_FEED_RATE = 3000;
const DEFAULT_TRAVEL_FEED_RATE = 9000;
const DEFAULT_PEN_OFFSET = [0, 0, 0];

/**
 * @typedef {Object} Settings
 * @property {number} bedWidth - Bed width in mm
 * @property {number} bedHeight - Bed height in mm
 * @property {number} penUpZ - Z height when pen is up
 * @property {number} sheetHeight - Sheet height/thickness
 * @property {Array<number>} penOffset - [X, Y, Z] pen offset from nozzle
 * @property {number} feedRate - Drawing feed rate in mm/min
 * @property {number} travelFeedRate - Travel feed rate in mm/min
 * @property {string} headerTemplate - Custom header template
 * @property {string} footerTemplate - Custom footer template
 */

/**
 * G-Code generator for pen plotters
 * @class
 */
export class GCodeGenerator {
    /**
     * Generate G-Code from polylines
     * @param {Array<Array<[number, number]>>} polylines - Array of polylines to draw
     * @param {Settings} settings - Generator settings
     * @returns {string} Generated G-Code
     */
    static generate(polylines, settings) {
        const {
            bedWidth = DEFAULT_BED_SIZE,
            bedHeight = DEFAULT_BED_SIZE,
            penUpZ = DEFAULT_PEN_UP_Z,
            sheetHeight = DEFAULT_SHEET_HEIGHT,
            penOffset = DEFAULT_PEN_OFFSET,
            feedRate = DEFAULT_FEED_RATE,
            travelFeedRate = DEFAULT_TRAVEL_FEED_RATE,
            headerTemplate = '',
            footerTemplate = ''
        } = settings;

        const safePenUpZ = Number.isFinite(penUpZ) ? penUpZ : DEFAULT_PEN_UP_Z;
        const safeSheetHeight = Number.isFinite(sheetHeight) ? sheetHeight : DEFAULT_SHEET_HEIGHT;
        const safeFeedRate = Number.isFinite(feedRate) ? feedRate : DEFAULT_FEED_RATE;
        const safeTravelFeedRate = Number.isFinite(travelFeedRate) ? travelFeedRate : DEFAULT_TRAVEL_FEED_RATE;
        const safeBedWidth = Number.isFinite(bedWidth) ? bedWidth : DEFAULT_BED_SIZE;
        const safeBedHeight = Number.isFinite(bedHeight) ? bedHeight : DEFAULT_BED_SIZE;
        const safePenOffset = Array.isArray(penOffset) && penOffset.length === 3
            ? penOffset.map(value => (Number.isFinite(value) ? value : 0))
            : [0, 0, 0];

        let gcode = [];

        const [offsetX, offsetY, offsetZ] = safePenOffset;
        const nozzleUpZ = safePenUpZ - offsetZ;
        const nozzleDownZ = safeSheetHeight - offsetZ;
        const context = {
            penUpZ: safePenUpZ.toFixed(3),
            nozzleUpZ: nozzleUpZ.toFixed(3),
            sheetHeight: safeSheetHeight.toFixed(3),
            feedRate: Math.round(safeFeedRate).toString(),
            travelFeedRate: Math.round(safeTravelFeedRate).toString(),
            offsetX: offsetX.toFixed(3),
            offsetY: offsetY.toFixed(3),
            offsetZ: offsetZ.toFixed(3),
            bedWidth: safeBedWidth.toFixed(3),
            bedHeight: safeBedHeight.toFixed(3),
            timestamp: new Date().toISOString()
        };

        const headerText = headerTemplate?.trim().length
            ? headerTemplate
            : GCodeGenerator._getDefaultHeaderTemplate();
        const footerText = footerTemplate?.trim().length
            ? footerTemplate
            : GCodeGenerator._getDefaultFooterTemplate();

        gcode.push(...GCodeGenerator._expandTemplate(headerText, context).split('\n'));
        gcode.push('');

        // Process each polyline
        const totalPolylines = polylines.filter(pl => pl && pl.length >= 2).length;
        let completedPolylines = 0;
        
        polylines.forEach((polyline, idx) => {
            if (!polyline || polyline.length < 2) return;
            
            gcode.push(`; Polyline ${idx + 1}`);
            
            // Move to start position (pen up)
            const [startX, startY] = polyline[0];
            gcode.push(`G0 X${(startX - offsetX).toFixed(3)} Y${(startY - offsetY).toFixed(3)} Z${nozzleUpZ.toFixed(3)} F${safeTravelFeedRate}`);
            
            // Lower pen
            gcode.push(`G0 Z${nozzleDownZ.toFixed(3)} F${safeTravelFeedRate} ; Pen down (offset adjusted)`);
            
            // Draw the polyline
            for (let i = 1; i < polyline.length; i++) {
                const [x, y] = polyline[i];
                gcode.push(`G1 X${(x - offsetX).toFixed(3)} Y${(y - offsetY).toFixed(3)} F${safeFeedRate}`);
            }
            
            // Raise pen
            gcode.push(`G0 Z${nozzleUpZ.toFixed(3)} F${safeTravelFeedRate} ; Pen up (offset adjusted)`);
            
            // Add progress update (M73)
            completedPolylines++;
            const progress = Math.round((completedPolylines / totalPolylines) * 100);
            gcode.push(`M73 P${progress} R0 ; Progress: ${progress}%`);
            
            gcode.push('');
        });
        
        // Footer
        gcode.push(...GCodeGenerator._expandTemplate(footerText, context).split('\n'));
        gcode.push('');
        
        return gcode.join('\n');
    }

    /**
     * Expand template string with context values
     * @private
     * @param {string} template - Template string with {variable} placeholders
     * @param {Object} context - Context object with values
     * @returns {string} Expanded template
     */
    static _expandTemplate(template, context) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            if (Object.prototype.hasOwnProperty.call(context, key)) {
                return context[key];
            }
            return match;
        });
    }

    /**
     * Get default header template
     * @private
     * @returns {string} Default header G-Code template
     */
    static _getDefaultHeaderTemplate() {
        return [
            '; ========== PlotLab - generated G-code  ==========',
            '',
            '; ========== machine: P1S ==========',
            '',
            '; ========== startup sequence ==========',
            '; heating: off',
            'M106 P1 S0 ; turn off part fan',
            'M106 P2 S0 ; turn off AUX fan',
            'M106 P3 S0 ; turn off Chamber fan',
            '',
            'G28 ; home all axes',
            '',
            '; ========== MANUAL STEP NEEDED NOW ==========',
            '',
            'M106 P1 S255 ; turn on part fan',
            'M400 U1 ; wait for user interaction',
            'M106 P1 S0 ; turn off part fan',
            '',
            '; ATTACH THE PEN ADAPTER NOW AND PRESS CONTINUE',
            '',
            '; ========== MANUAL STEP NEEDED NOW ==========',
            '; coordinates settings',
            'G90 ; absolute coords',
            '',
            '; progress bar',
            'M73 P0 R0 ; clear progress bar',
            '',
            'G0 Z{nozzleUpZ} F{travelFeedRate} ; pen up (safe height, nozzle adjusted for pen offset)'
        ].join('\n');
    }

    /**
     * Get default footer template
     * @private
     * @returns {string} Default footer G-Code template
     */
    static _getDefaultFooterTemplate() {
        return [
            '; ========== end sequence ==========',
            '; progress complete',
            'M73 P100 R0 ; set progress bar to 100%',
            '',
            '; Go to up left corner and end',
            'G0 X0 Y{bedHeight} Z100',
            '; FINISHED'
        ].join('\n');
    }
}
