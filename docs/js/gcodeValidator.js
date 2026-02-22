/**
 * Validates G-Code for common errors and issues
 * @class
 */
export class GCodeValidator {
    /**
     * Validate G-Code and return errors/warnings
     * @param {string} gcode - G-Code text to validate
     * @param {Object} settings - Validation settings
     * @param {number} settings.bedWidth - Bed width in mm
     * @param {number} settings.bedHeight - Bed height in mm
     * @param {number} settings.maxZ - Maximum Z height in mm, default 300
     * @param {number} settings.maxFeedRate - Maximum feed rate in mm/min, default 15000
     * @returns {Object} Validation result {valid, errors, warnings}
     */
    static validate(gcode, settings = {}) {
        const {
            bedWidth = 256,
            bedHeight = 256,
            maxZ = 300,
            maxFeedRate = 15000
        } = settings;

        const errors = [];
        const warnings = [];
        const lines = gcode.split('\n');

        let hasG28 = false;      // Home command
        let hasG90 = false;      // Absolute positioning
        let inAbsoluteMode = null;
        let currentX = 0, currentY = 0, currentZ = 0;

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const line = lines[i].trim();
            
            // Skip comments and empty lines
            if (line.startsWith(';') || line === '') continue;

            // Extract command (before comment)
            const [command] = line.split(';');
            const trimmedCommand = command.trim();

            // Check for home command
            if (/\bG28\b/i.test(trimmedCommand)) {
                hasG28 = true;
            }

            // Check for absolute positioning
            if (/\bG90\b/i.test(trimmedCommand)) {
                hasG90 = true;
                inAbsoluteMode = true;
            }

            // Check for relative positioning
            if (/\bG91\b/i.test(trimmedCommand)) {
                inAbsoluteMode = false;
            }

            // Extract movement commands
            if (/\b(G0|G1)\b/i.test(trimmedCommand)) {
                // Extract coordinates
                const xMatch = trimmedCommand.match(/X([-+]?\d+\.?\d*)/i);
                const yMatch = trimmedCommand.match(/Y([-+]?\d+\.?\d*)/i);
                const zMatch = trimmedCommand.match(/Z([-+]?\d+\.?\d*)/i);
                const fMatch = trimmedCommand.match(/F(\d+\.?\d*)/i);

                // Update current position (simplified, assumes absolute mode)
                if (inAbsoluteMode !== false) {
                    if (xMatch) currentX = parseFloat(xMatch[1]);
                    if (yMatch) currentY = parseFloat(yMatch[1]);
                    if (zMatch) currentZ = parseFloat(zMatch[1]);
                }

                // Check coordinates
                if (xMatch) {
                    const x = parseFloat(xMatch[1]);
                    if (x < 0) {
                        errors.push(`Line ${lineNum}: X coordinate ${x.toFixed(2)} is negative`);
                    } else if (x > bedWidth) {
                        errors.push(`Line ${lineNum}: X coordinate ${x.toFixed(2)} exceeds bed width (${bedWidth}mm)`);
                    }
                }

                if (yMatch) {
                    const y = parseFloat(yMatch[1]);
                    if (y < 0) {
                        errors.push(`Line ${lineNum}: Y coordinate ${y.toFixed(2)} is negative`);
                    } else if (y > bedHeight) {
                        errors.push(`Line ${lineNum}: Y coordinate ${y.toFixed(2)} exceeds bed height (${bedHeight}mm)`);
                    }
                }

                if (zMatch) {
                    const z = parseFloat(zMatch[1]);
                    if (z < 0) {
                        errors.push(`Line ${lineNum}: Z coordinate ${z.toFixed(2)} is negative`);
                    } else if (z > maxZ) {
                        warnings.push(`Line ${lineNum}: Z coordinate ${z.toFixed(2)} is very high (max suggested: ${maxZ}mm)`);
                    }
                }

                // Check feed rate
                if (fMatch) {
                    const f = parseFloat(fMatch[1]);
                    if (f <= 0) {
                        errors.push(`Line ${lineNum}: Feed rate F${f} must be positive`);
                    } else if (f > maxFeedRate) {
                        warnings.push(`Line ${lineNum}: Feed rate F${f} is very high (max suggested: ${maxFeedRate}mm/min)`);
                    } else if (f < 100) {
                        warnings.push(`Line ${lineNum}: Feed rate F${f} is very low (may cause slow operation)`);
                    }
                }
            }

            // Check for unknown commands (very basic)
            const commandMatch = trimmedCommand.match(/^([GM]\d+)/i);
            if (commandMatch) {
                const cmd = commandMatch[1].toUpperCase();
                const knownCommands = [
                    'G0', 'G1', 'G2', 'G3', 'G4', 'G28', 'G90', 'G91', 'G92',
                    'M0', 'M1', 'M73', 'M82', 'M83', 'M104', 'M106', 'M107', 'M109', 
                    'M140', 'M190', 'M400', 'M84'
                ];
                
                if (!knownCommands.includes(cmd)) {
                    warnings.push(`Line ${lineNum}: Uncommon G-Code command ${cmd} (may not be supported)`);
                }
            }
        }

        // Global checks
        if (!hasG28) {
            warnings.push('Missing G28 home command (recommended at start)');
        }

        if (!hasG90) {
            warnings.push('Missing G90 absolute positioning command (recommended at start)');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            summary: this._generateSummary(errors, warnings)
        };
    }

    /**
     * Generate validation summary
     * @private
     * @param {Array<string>} errors - Error messages
     * @param {Array<string>} warnings - Warning messages
     * @returns {string} Summary text
     */
    static _generateSummary(errors, warnings) {
        if (errors.length === 0 && warnings.length === 0) {
            return '✓ G-Code validation passed with no issues!';
        }

        const parts = [];
        
        if (errors.length > 0) {
            parts.push(`${errors.length} error(s) found`);
        }
        
        if (warnings.length > 0) {
            parts.push(`${warnings.length} warning(s)`);
        }

        return parts.join(', ');
    }
}
