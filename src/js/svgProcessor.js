/**
 * SVG path processor for PlotLab.
 * Parses SVG files, extracts paths, and converts to polylines with physical dimensions.
 * @class
 */
class SVGProcessor {
    // ========================================
    // CONSTANTS
    // ========================================
    
    /** Sample rate for preview (points per unit) */
    static PREVIEW_SAMPLE_RATE = 1.0;
    
    /** Sample rate for quality export (points per unit) */
    static QUALITY_SAMPLE_RATE = 2.0;
    
    /** Threshold for merging close strokes (mm) */
    static CLOSE_THRESHOLD = 0.1;
    
    /** Minimum angle for merging continuous strokes (degrees) */
    static MIN_ANGLE_DEG = 160;
    
    /** Maximum gap for merging strokes (mm) */
    static MAX_GAP = 0.1;

    
    /** Minimum segments for arc sampling */
    static ARC_MIN_SEGMENTS = 32;
    
    /** Unit conversion factors to millimeters */
    static UNIT_CONVERSIONS = {
        'mm': 1,
        'cm': 10,
        'm': 1000,
        'in': 25.4,
        'pt': 0.352778,
        'pc': 4.23333,
        'px': 0.264583,  // 96 DPI standard
        '': 0.264583     // default to px
    };

    // ========================================
    // TYPE DEFINITIONS (JSDoc)
    // ========================================
    
    /**
     * @typedef {[number, number]} Point
     * A 2D point represented as [x, y]
     */
    
    /**
     * @typedef {Point[]} Polyline
     * A polyline represented as an array of points
     */
    
    /**
     * @typedef {Object} Bounds
     * @property {number} minX - Minimum X coordinate
     * @property {number} minY - Minimum Y coordinate
     * @property {number} maxX - Maximum X coordinate
     * @property {number} maxY - Maximum Y coordinate
     * @property {number} width - Width of bounding box
     * @property {number} height - Height of bounding box
     */
    
    /**
     * @typedef {Object} PhysicalDimensions
     * @property {number} widthMM - Width in millimeters
     * @property {number} heightMM - Height in millimeters
     * @property {string} widthUnit - Original width unit
     * @property {string} heightUnit - Original height unit
     * @property {number} widthValue - Original width value
     * @property {number} heightValue - Original height value
     */
    
    /**
     * @typedef {Object} ScaleFactor
     * @property {number} scaleX - Scale factor in X direction (mm per ViewBox unit)
     * @property {number} scaleY - Scale factor in Y direction (mm per ViewBox unit)
     * @property {number} avgScale - Average scale factor
     * @property {PhysicalDimensions} physical - Physical dimensions
     */
    
    /**
     * @typedef {Object} SVGLoadResult
     * @property {Polyline[]} polylines - Extracted polylines
     * @property {Bounds} bounds - Bounding box
     * @property {number[]} viewBox - SVG viewBox [x, y, width, height]
     * @property {ScaleFactor|null} scaleFactor - Scale factor information
     * @property {PhysicalDimensions|null} physical - Physical dimensions
     */

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Instance method for processing SVG content string
     * @param {string} svgContent - SVG content as string
     * @param {boolean} [flipY=false] - Whether to flip Y axis
     * @param {number} [samplesPerUnit=2.0] - Sampling density
     * @returns {SVGLoadResult} Parsed SVG data
     */
    /**
     * Load and parse SVG file
     * @param {File} file - SVG file object
     * @param {boolean} [flipY=false] - Whether to flip Y axis
     * @param {number} [samplesPerUnit=2.0] - Sampling density
     * @returns {Promise<SVGLoadResult>} Parsed SVG data
     */
    static async loadSVG(file, flipY = false, samplesPerUnit = 2.0) {
        try {
            const text = await file.text();
            return SVGProcessor._processContent(text, flipY, samplesPerUnit);
        } catch (error) {
            console.error('SVG loading error:', error);
            throw error;
        }
    }

    // ========================================
    // CORE SVG PROCESSING
    // ========================================

    /**
     * Process SVG content string
     * @private
     * @param {string} svgContent - SVG content as string
     * @param {boolean} flipY - Whether to flip Y axis
     * @param {number} samplesPerUnit - Sampling density
     * @returns {SVGLoadResult} Parsed SVG data
     */
    static _processContent(svgContent, flipY = false, samplesPerUnit = 2.0) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, 'image/svg+xml');
            
            // Check for parsing errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Failed to parse SVG file');
            }

            const svg = doc.documentElement;
            
            // Extract canvas dimensions from viewBox, width/height, or path bounds
            const [vx, vy, vw, vh] = SVGProcessor._getSVGBounds(svg);
            
            // Get physical dimensions and scale factor
            const scaleFactor = SVGProcessor._getScaleFactor(svg, [vx, vy, vw, vh]);
            
            // Collect all strokes (no fill) and polygons (with fill)
            const strokes = [];
            const polygons = [];
            
            // Process all drawable elements
            const elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
            
            for (const element of elements) {
                const fill = (element.getAttribute('fill') || 'none').toLowerCase();
                const tagName = element.tagName.toLowerCase();
                
                try {
                    let polylines = [];
                    
                    switch (tagName) {
                        case 'path': {
                            const d = element.getAttribute('d');
                            polylines = SVGProcessor._samplePath(d, samplesPerUnit);
                            break;
                        }
                        case 'line': {
                            const x1 = parseFloat(element.getAttribute('x1')) || 0;
                            const y1 = parseFloat(element.getAttribute('y1')) || 0;
                            const x2 = parseFloat(element.getAttribute('x2')) || 0;
                            const y2 = parseFloat(element.getAttribute('y2')) || 0;
                            polylines = [[[x1, y1], [x2, y2]]];
                            break;
                        }
                        case 'polyline':
                        case 'polygon': {
                            const points = element.getAttribute('points');
                            if (points) {
                                const coords = points.trim().split(/[\s,]+/).map(parseFloat);
                                const result = [];
                                for (let i = 0; i < coords.length; i += 2) {
                                    result.push([coords[i], coords[i + 1]]);
                                }
                                if (result.length >= 2) {
                                    polylines = [result];
                                }
                            }
                            break;
                        }
                        case 'circle': {
                            const cx = parseFloat(element.getAttribute('cx')) || 0;
                            const cy = parseFloat(element.getAttribute('cy')) || 0;
                            const r = parseFloat(element.getAttribute('r')) || 0;
                            const points = [];
                            const segments = Math.max(SVGProcessor.ARC_MIN_SEGMENTS, 
                                Math.ceil(r * samplesPerUnit * 2 * Math.PI / SVGProcessor.ARC_MIN_SEGMENTS));
                            for (let i = 0; i <= segments; i++) {
                                const angle = (i / segments) * 2 * Math.PI;
                                points.push([
                                    cx + r * Math.cos(angle),
                                    cy + r * Math.sin(angle)
                                ]);
                            }
                            polylines = [points];
                            break;
                        }
                        case 'ellipse': {
                            const cx = parseFloat(element.getAttribute('cx')) || 0;
                            const cy = parseFloat(element.getAttribute('cy')) || 0;
                            const rx = parseFloat(element.getAttribute('rx')) || 0;
                            const ry = parseFloat(element.getAttribute('ry')) || 0;
                            const points = [];
                            const segments = Math.max(SVGProcessor.ARC_MIN_SEGMENTS, 
                                Math.ceil(Math.max(rx, ry) * samplesPerUnit * 2 * Math.PI / SVGProcessor.ARC_MIN_SEGMENTS));
                            for (let i = 0; i <= segments; i++) {
                                const angle = (i / segments) * 2 * Math.PI;
                                points.push([
                                    cx + rx * Math.cos(angle),
                                    cy + ry * Math.sin(angle)
                                ]);
                            }
                            polylines = [points];
                            break;
                        }
                        case 'rect': {
                            const x = parseFloat(element.getAttribute('x')) || 0;
                            const y = parseFloat(element.getAttribute('y')) || 0;
                            const w = parseFloat(element.getAttribute('width')) || 0;
                            const h = parseFloat(element.getAttribute('height')) || 0;
                            polylines = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
                            break;
                        }
                    }
                    
                    // Apply SVG transforms
                    const matrix = SVGProcessor._getTransformMatrix(element);
                    polylines = polylines.map(pl => SVGProcessor._applyTransform(pl, matrix));
                    
                    // Normalize coordinates relative to viewBox
                    polylines = polylines.map(pl => pl.map(([x, y]) => [x - vx, y - vy]));
                    
                    // Apply Y-flip if requested
                    if (flipY) {
                        polylines = polylines.map(pl => pl.map(([x, y]) => [x, vh - y]));
                    }
                    
                    // Sort into strokes or polygons based on fill
                    for (const polyline of polylines) {
                        if (polyline.length >= 2) {
                            if (fill === 'none' || !fill) {
                                strokes.push(polyline);
                            } else if (polyline.length >= 3) {
                                polygons.push(polyline);
                            }
                        }
                    }
                    
                } catch (error) {
                    console.warn(`Failed to parse ${tagName} element:`, error);
                }
            }
            
            // Merge continuous strokes
            const mergedStrokes = SVGProcessor._mergeContinuousStrokes(strokes);
            
            // Combine all polylines (strokes + polygons)
            const allPolylines = [...mergedStrokes, ...polygons];
            
            // Calculate bounds from all polylines
            const bounds = SVGProcessor._calculateBounds(allPolylines, vw, vh);

            return { 
                polylines: allPolylines, 
                bounds,
                viewBox: [vx, vy, vw, vh],
                scaleFactor,
                physical: scaleFactor?.physical || null
            };
            
        } catch (error) {
            console.error('SVG loading error:', error);
            throw error;
        }
    }

    // ========================================
    // SVG BOUNDS & DIMENSIONS
    // ========================================

    /**
     * Extract SVG bounds from viewBox, width/height, or computed from elements
     * @private
     * @param {SVGSVGElement} svg - SVG DOM element
     * @returns {number[]} ViewBox as [x, y, width, height]
     */
    static _getSVGBounds(svg) {
        // Try viewBox first
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            try {
                const parts = viewBox.split(/[\s,]+/).map(parseFloat);
                if (parts.length >= 4) {
                    return [parts[0], parts[1], parts[2], parts[3]];
                }
            } catch (e) {
                console.warn('Failed to parse viewBox:', viewBox);
            }
        }

        // Try explicit width/height
        let vw = 0, vh = 0;
        try {
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            const widthParsed = SVGProcessor._parseLength(width);
            const heightParsed = SVGProcessor._parseLength(height);
            vw = widthParsed.value;
            vh = heightParsed.value;
        } catch (e) {
            console.warn('Failed to parse width/height');
        }

        if (vw > 0 && vh > 0) {
            return [0, 0, vw, vh];
        }

        // Fallback: compute from path bounds
        try {
            const elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            for (const element of elements) {
                const bbox = element.getBBox ? element.getBBox() : null;
                if (bbox) {
                    minX = Math.min(minX, bbox.x);
                    maxX = Math.max(maxX, bbox.x + bbox.width);
                    minY = Math.min(minY, bbox.y);
                    maxY = Math.max(maxY, bbox.y + bbox.height);
                }
            }
            
            if (minX !== Infinity) {
                return [minX, minY, maxX - minX, maxY - minY];
            }
        } catch (e) {
            console.warn('Failed to compute bounds from elements');
        }

        // Default fallback
        return [0, 0, 100, 100];
    }

    /**
     * Parse length value with unit (e.g., "10mm", "2.5in")
     * @private
     * @param {string|number} value - Length value
     * @returns {{value: number, unit: string}} Parsed length
     */
    static _parseLength(value) {
        try {
            if (!value) return { value: 0, unit: 'px' };
            const str = String(value).trim();
            
            // Extract number (supports exponential notation)
            const numberMatch = str.match(/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
            if (!numberMatch) return { value: 0, unit: 'px' };
            
            const num = parseFloat(numberMatch[0]);
            const unit = str.substring(numberMatch[0].length).trim() || 'px';
            
            return { value: num, unit };
        } catch {
            return { value: 0, unit: 'px' };
        }
    }

    /**
     * Convert length value to millimeters
     * @private
     * @param {number} value - Numeric value
     * @param {string} unit - Unit of measurement
     * @returns {number} Value in millimeters
     */
    static _convertToMM(value, unit) {
        const factor = SVGProcessor.UNIT_CONVERSIONS[unit] || SVGProcessor.UNIT_CONVERSIONS['px'];
        return value * factor;
    }

    /**
     * Extract physical dimensions from SVG width/height attributes
     * @private
     * @param {SVGSVGElement} svg - SVG DOM element
     * @returns {PhysicalDimensions|null} Physical dimensions or null
     */
    static _getPhysicalDimensions(svg) {
        const widthAttr = svg.getAttribute('width');
        const heightAttr = svg.getAttribute('height');
        
        if (!widthAttr || !heightAttr) {
            return null;
        }
        
        const width = SVGProcessor._parseLength(widthAttr);
        const height = SVGProcessor._parseLength(heightAttr);
        
        const widthMM = SVGProcessor._convertToMM(width.value, width.unit);
        const heightMM = SVGProcessor._convertToMM(height.value, height.unit);
        
        return {
            widthMM,
            heightMM,
            widthUnit: width.unit,
            heightUnit: height.unit,
            widthValue: width.value,
            heightValue: height.value
        };
    }

    /**
     * Calculate scale factor from ViewBox to physical dimensions
     * @private
     * @param {SVGSVGElement} svg - SVG DOM element
     * @param {number[]} viewBoxDimensions - ViewBox as [x, y, width, height]
     * @returns {ScaleFactor|null} Scale factor or null
     */
    static _getScaleFactor(svg, viewBoxDimensions) {
        const physical = SVGProcessor._getPhysicalDimensions(svg);
        if (!physical) return null;
        
        const [vx, vy, vw, vh] = viewBoxDimensions;
        
        // Scale factor in mm per ViewBox unit
        const scaleX = vw > 0 ? physical.widthMM / vw : 1;
        const scaleY = vh > 0 ? physical.heightMM / vh : 1;
        
        return {
            scaleX,
            scaleY,
            avgScale: (scaleX + scaleY) / 2,
            physical
        };
    }

    // ========================================
    // PATH SAMPLING (REFACTORED)
    // ========================================

    /**
     * Sample SVG path data into polylines
     * @private
     * @param {string} d - SVG path data string
     * @param {number} samplesPerUnit - Sampling density
     * @returns {Polyline[]} Array of sampled polylines
     */
    static _samplePath(d, samplesPerUnit = 2.0) {
        if (!d) return [];
        
        // Tokenize path data
        const tokens = SVGProcessor._tokenizePath(d);
        
        // Initialize state
        const state = {
            currentX: 0,
            currentY: 0,
            startX: 0,
            startY: 0,
            lastControlX: undefined,
            lastControlY: undefined,
            lastQuadraticControlX: undefined,
            lastQuadraticControlY: undefined,
            currentPolyline: [],
            allPolylines: []
        };
        
        // Process tokens
        let currentCommand = null;
        let currentArgs = [];

        for (const token of tokens) {
            if (token.type === 'cmd') {
                if (currentCommand) {
                    SVGProcessor._processPathCommand(currentCommand, currentArgs, state, samplesPerUnit);
                }
                currentCommand = token.value;
                currentArgs = [];
            } else {
                currentArgs.push(token.value);
            }
        }

        // Process final command
        if (currentCommand) {
            SVGProcessor._processPathCommand(currentCommand, currentArgs, state, samplesPerUnit);
        }
        
        // Save final polyline
        if (state.currentPolyline.length > 1) {
            state.allPolylines.push(state.currentPolyline);
        }

        // Remove self-overlapping segments (common in stroke-to-path SVGs)
        return SVGProcessor._removeSelfOverlaps(state.allPolylines);
    }
    
    /**
     * Remove self-overlapping segments from polylines
     * Common in Inkscape "stroke to path" conversions where paths trace both sides
     * @private
     * @param {Array<Array<Array<number>>>} polylines - Array of polylines
     * @returns {Array<Array<Array<number>>>} Cleaned polylines
     */
    static _removeSelfOverlaps(polylines) {
        // Disabled: Too difficult to distinguish stroke-to-path artifacts 
        // from legitimate closed paths without breaking normal geometry
        // Users should simplify stroke-to-path SVGs in Inkscape if needed
        return polylines;
    }
    
    /**
     * Check if three points form a back-and-forth pattern (p0->p1->p2 where p1->p2 backtracks p0->p1)
     * @private
     */
    static _isBackAndForth(p0, p1, p2) {
        // Direction vectors
        const dir1 = [p1[0] - p0[0], p1[1] - p0[1]];
        const dir2 = [p2[0] - p1[0], p2[1] - p1[1]];
        
        const len1 = Math.sqrt(dir1[0] * dir1[0] + dir1[1] * dir1[1]);
        const len2 = Math.sqrt(dir2[0] * dir2[0] + dir2[1] * dir2[1]);
        
        const threshold = SVGProcessor.CLOSE_THRESHOLD;
        
        // Both segments must be significant length (at least 1mm)
        if (len1 < 1.0 || len2 < 1.0) return false;
        
        // Calculate net displacement from p0 to p2
        const netDx = p2[0] - p0[0];
        const netDy = p2[1] - p0[1];
        const netDist = Math.sqrt(netDx * netDx + netDy * netDy);
        
        // Total path length
        const totalLen = len1 + len2;
        
        // If net displacement is much smaller than total path length,
        // it's a back-and-forth pattern (like drawing a stroke outline)
        // Net displacement should be less than 10% of total length
        const isBackAndForth = netDist < totalLen * 0.15;
        
        // Also check if the two segments are roughly similar length (within 50%)
        const lenRatio = Math.min(len1, len2) / Math.max(len1, len2);
        const similarLength = lenRatio > 0.5;
        
        // For stroke-to-path, we want long segments that backtrack
        const areLongSegments = len1 > 10.0 || len2 > 10.0;
        
        return isBackAndForth && similarLength && areLongSegments;
    }
    
    /**
     * Check if two line segments overlap (are parallel and very close)
     * @private
     */
    static _areSegmentsOverlapping(p1, p2, q1, q2, threshold) {
        const midP = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const midQ = [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2];
        
        const dx = midP[0] - midQ[0];
        const dy = midP[1] - midQ[1];
        const distMid = Math.sqrt(dx * dx + dy * dy);
        
        if (distMid > threshold * 10) return false;
        
        const dir1 = [p2[0] - p1[0], p2[1] - p1[1]];
        const dir2 = [q2[0] - q1[0], q2[1] - q1[1]];
        
        const len1 = Math.sqrt(dir1[0] * dir1[0] + dir1[1] * dir1[1]);
        const len2 = Math.sqrt(dir2[0] * dir2[0] + dir2[1] * dir2[1]);
        
        if (len1 < threshold || len2 < threshold) return false;
        
        dir1[0] /= len1; dir1[1] /= len1;
        dir2[0] /= len2; dir2[1] /= len2;
        
        // Check if parallel OR antiparallel (dot product close to ±1)
        // Antiparallel (opposite direction) is common in stroke-to-path conversions
        const dot = dir1[0] * dir2[0] + dir1[1] * dir2[1];
        const isParallelOrAntiparallel = Math.abs(Math.abs(dot) - 1) < 0.1;
        
        return isParallelOrAntiparallel && distMid < threshold;
    }

    /**
     * Tokenize SVG path data string
     * @private
     * @param {string} d - SVG path data
     * @returns {Array<{type: string, value: string|number}>} Tokens
     */
    static _tokenizePath(d) {
        const tokens = [];
        const tokenRegex = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
        let tokenMatch;
        
        while ((tokenMatch = tokenRegex.exec(d)) !== null) {
            if (tokenMatch[1]) {
                tokens.push({ type: 'cmd', value: tokenMatch[1] });
            } else if (tokenMatch[2]) {
                tokens.push({ type: 'num', value: parseFloat(tokenMatch[2]) });
            }
        }
        
        return tokens;
    }

    /**
     * Process a single path command
     * @private
     * @param {string} command - Path command letter
     * @param {number[]} args - Command arguments
     * @param {Object} state - Current path state
     * @param {number} samplesPerUnit - Sampling density
     */
    static _processPathCommand(command, args, state, samplesPerUnit) {
        const handler = SVGProcessor._getCommandHandler(command);
        if (handler) {
            handler(args, state, samplesPerUnit);
        }
    }

    /**
     * Get command handler function for a path command
     * @private
     * @param {string} command - Path command letter
     * @returns {Function|null} Handler function or null
     */
    static _getCommandHandler(command) {
        const handlers = {
            'M': SVGProcessor._handleMoveTo,
            'm': SVGProcessor._handleMoveToRel,
            'L': SVGProcessor._handleLineTo,
            'l': SVGProcessor._handleLineToRel,
            'H': SVGProcessor._handleHorizontal,
            'h': SVGProcessor._handleHorizontalRel,
            'V': SVGProcessor._handleVertical,
            'v': SVGProcessor._handleVerticalRel,
            'C': SVGProcessor._handleCubicBezier,
            'c': SVGProcessor._handleCubicBezierRel,
            'S': SVGProcessor._handleSmoothCubic,
            's': SVGProcessor._handleSmoothCubicRel,
            'Q': SVGProcessor._handleQuadraticBezier,
            'q': SVGProcessor._handleQuadraticBezierRel,
            'T': SVGProcessor._handleSmoothQuadratic,
            't': SVGProcessor._handleSmoothQuadraticRel,
            'A': SVGProcessor._handleArc,
            'a': SVGProcessor._handleArcRel,
            'Z': SVGProcessor._handleClose,
            'z': SVGProcessor._handleClose
        };
        
        return handlers[command] || null;
    }

    // ========================================
    // PATH COMMAND HANDLERS
    // ========================================

    /**
     * Handle M (absolute move-to) command
     * @private
     */
    static _handleMoveTo(args, state, samplesPerUnit) {
        if (state.currentPolyline.length > 1) {
            state.allPolylines.push(state.currentPolyline);
        }
        state.currentPolyline = [];
        
        if (args.length >= 2) {
            state.currentX = args[0];
            state.currentY = args[1];
            state.startX = state.currentX;
            state.startY = state.currentY;
            state.currentPolyline.push([state.currentX, state.currentY]);
        }
        
        // Implicit line-to for additional coordinates
        for (let i = 2; i < args.length; i += 2) {
            const nextX = args[i];
            const nextY = args[i + 1];
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
            state.currentY = nextY;
        }
        
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle m (relative move-to) command
     * @private
     */
    static _handleMoveToRel(args, state, samplesPerUnit) {
        if (state.currentPolyline.length > 1) {
            state.allPolylines.push(state.currentPolyline);
        }
        state.currentPolyline = [];
        
        if (args.length >= 2) {
            state.currentX += args[0];
            state.currentY += args[1];
            state.startX = state.currentX;
            state.startY = state.currentY;
            state.currentPolyline.push([state.currentX, state.currentY]);
        }
        
        // Implicit line-to for additional coordinates
        for (let i = 2; i < args.length; i += 2) {
            const nextX = state.currentX + args[i];
            const nextY = state.currentY + args[i + 1];
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
            state.currentY = nextY;
        }
        
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle L (absolute line-to) command
     * @private
     */
    static _handleLineTo(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 2) {
            const nextX = args[i];
            const nextY = args[i + 1];
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
            state.currentY = nextY;
        }
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle l (relative line-to) command
     * @private
     */
    static _handleLineToRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 2) {
            const nextX = state.currentX + args[i];
            const nextY = state.currentY + args[i + 1];
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
            state.currentY = nextY;
        }
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle H (absolute horizontal line) command
     * @private
     */
    static _handleHorizontal(args, state, samplesPerUnit) {
        args.forEach(x => {
            const nextX = x;
            const nextY = state.currentY;
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
        });
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle h (relative horizontal line) command
     * @private
     */
    static _handleHorizontalRel(args, state, samplesPerUnit) {
        args.forEach(dx => {
            const nextX = state.currentX + dx;
            const nextY = state.currentY;
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentX = nextX;
        });
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle V (absolute vertical line) command
     * @private
     */
    static _handleVertical(args, state, samplesPerUnit) {
        args.forEach(y => {
            const nextX = state.currentX;
            const nextY = y;
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentY = nextY;
        });
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle v (relative vertical line) command
     * @private
     */
    static _handleVerticalRel(args, state, samplesPerUnit) {
        args.forEach(dy => {
            const nextX = state.currentX;
            const nextY = state.currentY + dy;
            SVGProcessor._appendSampledLine(
                state,
                state.currentX,
                state.currentY,
                nextX,
                nextY,
                samplesPerUnit
            );
            state.currentY = nextY;
        });
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Sample a straight line segment
     * @private
     * @param {number} x0 - Start X
     * @param {number} y0 - Start Y
     * @param {number} x1 - End X
     * @param {number} y1 - End Y
     * @param {number} samplesPerUnit - Sampling density
     * @returns {Point[]} Sampled points
     */
    static _sampleLine(x0, y0, x1, y1, samplesPerUnit = 2.0) {
        const length = Math.hypot(x1 - x0, y1 - y0);
        const numSegments = Math.max(1, Math.ceil(length * samplesPerUnit));
        const points = [];

        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            points.push([
                x0 + (x1 - x0) * t,
                y0 + (y1 - y0) * t
            ]);
        }

        return points;
    }

    /**
     * Append sampled line to the current polyline
     * @private
     */
    static _appendSampledLine(state, x0, y0, x1, y1, samplesPerUnit) {
        const points = SVGProcessor._sampleLine(x0, y0, x1, y1, samplesPerUnit);
        if (state.currentPolyline.length > 0) {
            state.currentPolyline.push(...points.slice(1));
        } else {
            state.currentPolyline.push(...points);
        }
    }

    /**
     * Handle C (absolute cubic Bezier) command
     * @private
     */
    static _handleCubicBezier(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 6) {
            const bezier = SVGProcessor._sampleCubicBezier(
                state.currentX, state.currentY,
                args[i], args[i + 1],
                args[i + 2], args[i + 3],
                args[i + 4], args[i + 5],
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastControlX = args[i + 2];
            state.lastControlY = args[i + 3];
            state.currentX = args[i + 4];
            state.currentY = args[i + 5];
        }
        state.lastQuadraticControlX = undefined;
        state.lastQuadraticControlY = undefined;
    }

    /**
     * Handle c (relative cubic Bezier) command
     * @private
     */
    static _handleCubicBezierRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 6) {
            const bezier = SVGProcessor._sampleCubicBezier(
                state.currentX, state.currentY,
                state.currentX + args[i], state.currentY + args[i + 1],
                state.currentX + args[i + 2], state.currentY + args[i + 3],
                state.currentX + args[i + 4], state.currentY + args[i + 5],
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastControlX = state.currentX + args[i + 2];
            state.lastControlY = state.currentY + args[i + 3];
            state.currentX += args[i + 4];
            state.currentY += args[i + 5];
        }
        state.lastQuadraticControlX = undefined;
        state.lastQuadraticControlY = undefined;
    }

    /**
     * Handle S (absolute smooth cubic Bezier) command
     * @private
     */
    static _handleSmoothCubic(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 4) {
            // Mirror last control point or use current point if no previous curve
            let cx1 = state.currentX;
            let cy1 = state.currentY;
            if (state.lastControlX !== undefined && state.lastControlY !== undefined) {
                cx1 = 2 * state.currentX - state.lastControlX;
                cy1 = 2 * state.currentY - state.lastControlY;
            }
            
            const bezier = SVGProcessor._sampleCubicBezier(
                state.currentX, state.currentY,
                cx1, cy1,
                args[i], args[i + 1],
                args[i + 2], args[i + 3],
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastControlX = args[i];
            state.lastControlY = args[i + 1];
            state.currentX = args[i + 2];
            state.currentY = args[i + 3];
        }
        state.lastQuadraticControlX = undefined;
        state.lastQuadraticControlY = undefined;
    }

    /**
     * Handle s (relative smooth cubic Bezier) command
     * @private
     */
    static _handleSmoothCubicRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 4) {
            // Mirror last control point or use current point if no previous curve
            let cx1 = state.currentX;
            let cy1 = state.currentY;
            if (state.lastControlX !== undefined && state.lastControlY !== undefined) {
                cx1 = 2 * state.currentX - state.lastControlX;
                cy1 = 2 * state.currentY - state.lastControlY;
            }
            
            const bezier = SVGProcessor._sampleCubicBezier(
                state.currentX, state.currentY,
                cx1, cy1,
                state.currentX + args[i], state.currentY + args[i + 1],
                state.currentX + args[i + 2], state.currentY + args[i + 3],
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastControlX = state.currentX + args[i];
            state.lastControlY = state.currentY + args[i + 1];
            state.currentX += args[i + 2];
            state.currentY += args[i + 3];
        }
        state.lastQuadraticControlX = undefined;
        state.lastQuadraticControlY = undefined;
    }

    /**
     * Handle Q (absolute quadratic Bezier) command
     * @private
     */
    static _handleQuadraticBezier(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 4) {
            const bezier = SVGProcessor._sampleQuadraticBezier(
                state.currentX, state.currentY,
                args[i], args[i + 1],
                args[i + 2], args[i + 3],
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastQuadraticControlX = args[i];
            state.lastQuadraticControlY = args[i + 1];
            state.currentX = args[i + 2];
            state.currentY = args[i + 3];
        }
        state.lastControlX = undefined;
        state.lastControlY = undefined;
    }

    /**
     * Handle q (relative quadratic Bezier) command
     * @private
     */
    static _handleQuadraticBezierRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 4) {
            const cx = state.currentX + args[i];
            const cy = state.currentY + args[i + 1];
            const ex = state.currentX + args[i + 2];
            const ey = state.currentY + args[i + 3];
            
            const bezier = SVGProcessor._sampleQuadraticBezier(
                state.currentX, state.currentY,
                cx, cy,
                ex, ey,
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastQuadraticControlX = cx;
            state.lastQuadraticControlY = cy;
            state.currentX = ex;
            state.currentY = ey;
        }
        state.lastControlX = undefined;
        state.lastControlY = undefined;
    }

    /**
     * Handle T (absolute smooth quadratic Bezier) command
     * @private
     */
    static _handleSmoothQuadratic(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 2) {
            let cx = state.currentX;
            let cy = state.currentY;
            if (state.lastQuadraticControlX !== undefined && state.lastQuadraticControlY !== undefined) {
                cx = 2 * state.currentX - state.lastQuadraticControlX;
                cy = 2 * state.currentY - state.lastQuadraticControlY;
            }
            
            const ex = args[i];
            const ey = args[i + 1];
            
            const bezier = SVGProcessor._sampleQuadraticBezier(
                state.currentX, state.currentY,
                cx, cy,
                ex, ey,
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastQuadraticControlX = cx;
            state.lastQuadraticControlY = cy;
            state.currentX = ex;
            state.currentY = ey;
        }
        state.lastControlX = undefined;
        state.lastControlY = undefined;
    }

    /**
     * Handle t (relative smooth quadratic Bezier) command
     * @private
     */
    static _handleSmoothQuadraticRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 2) {
            let cx = state.currentX;
            let cy = state.currentY;
            if (state.lastQuadraticControlX !== undefined && state.lastQuadraticControlY !== undefined) {
                cx = 2 * state.currentX - state.lastQuadraticControlX;
                cy = 2 * state.currentY - state.lastQuadraticControlY;
            }
            
            const ex = state.currentX + args[i];
            const ey = state.currentY + args[i + 1];
            
            const bezier = SVGProcessor._sampleQuadraticBezier(
                state.currentX, state.currentY,
                cx, cy,
                ex, ey,
                samplesPerUnit
            );
            state.currentPolyline.push(...bezier.slice(1));
            state.lastQuadraticControlX = cx;
            state.lastQuadraticControlY = cy;
            state.currentX = ex;
            state.currentY = ey;
        }
        state.lastControlX = undefined;
        state.lastControlY = undefined;
    }

    /**
     * Handle A (absolute arc) command
     * @private
     */
    static _handleArc(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 7) {
            const arc = SVGProcessor._sampleEllipticalArc(
                state.currentX, state.currentY,
                args[i], args[i + 1], args[i + 2],
                args[i + 3], args[i + 4],
                args[i + 5], args[i + 6],
                samplesPerUnit
            );
            state.currentPolyline.push(...arc.slice(1));
            state.currentX = args[i + 5];
            state.currentY = args[i + 6];
        }
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle a (relative arc) command
     * @private
     */
    static _handleArcRel(args, state, samplesPerUnit) {
        for (let i = 0; i < args.length; i += 7) {
            const arc = SVGProcessor._sampleEllipticalArc(
                state.currentX, state.currentY,
                args[i], args[i + 1], args[i + 2],
                args[i + 3], args[i + 4],
                state.currentX + args[i + 5], state.currentY + args[i + 6],
                samplesPerUnit
            );
            state.currentPolyline.push(...arc.slice(1));
            state.currentX += args[i + 5];
            state.currentY += args[i + 6];
        }
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Handle Z/z (close path) command
     * @private
     */
    static _handleClose(args, state, samplesPerUnit) {
        // Check if we need to add a close line
        let needsCloseLine = false;
        
        if (state.currentPolyline.length > 0) {
            const lastPoint = state.currentPolyline[state.currentPolyline.length - 1];
            const dx = Math.abs(lastPoint[0] - state.startX);
            const dy = Math.abs(lastPoint[1] - state.startY);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only add close line if distance is significant
            needsCloseLine = distance > SVGProcessor.CLOSE_THRESHOLD;
            
            if (needsCloseLine) {
                state.currentPolyline.push([state.startX, state.startY]);
            }
        }
        
        // Save the polyline
        if (state.currentPolyline.length > 1) {
            state.allPolylines.push(state.currentPolyline);
        }
        
        state.currentPolyline = [];
        state.currentX = state.startX;
        state.currentY = state.startY;
        SVGProcessor._resetControlPoints(state);
    }

    /**
     * Reset control points (after non-curve commands)
     * @private
     */
    static _resetControlPoints(state) {
        state.lastControlX = undefined;
        state.lastControlY = undefined;
        state.lastQuadraticControlX = undefined;
        state.lastQuadraticControlY = undefined;
    }

    // ========================================
    // CURVE SAMPLING
    // ========================================

    /**
     * Sample cubic Bezier curve
     * @private
     * @param {number} x0 - Start X
     * @param {number} y0 - Start Y
     * @param {number} x1 - Control point 1 X
     * @param {number} y1 - Control point 1 Y
     * @param {number} x2 - Control point 2 X
     * @param {number} y2 - Control point 2 Y
     * @param {number} x3 - End X
     * @param {number} y3 - End Y
     * @param {number} samplesPerUnit - Sampling density
     * @returns {Point[]} Sampled points
     */
    static _sampleCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, samplesPerUnit = 2.0) {
        // Estimate curve length for adaptive sampling
        const p0 = Math.hypot(x1 - x0, y1 - y0);
        const p1 = Math.hypot(x2 - x1, y2 - y1);
        const p2 = Math.hypot(x3 - x2, y3 - y2);
        const estLength = p0 + p1 + p2;
        
        const numSegments = Math.max(4, Math.ceil(estLength * samplesPerUnit));
        const points = [];
        
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const t2 = t * t;
            const t3 = t2 * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            
            const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
            const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
            points.push([x, y]);
        }
        
        return points;
    }

    /**
     * Sample quadratic Bezier curve
     * @private
     * @param {number} x0 - Start X
     * @param {number} y0 - Start Y
     * @param {number} x1 - Control point X
     * @param {number} y1 - Control point Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} samplesPerUnit - Sampling density
     * @returns {Point[]} Sampled points
     */
    static _sampleQuadraticBezier(x0, y0, x1, y1, x2, y2, samplesPerUnit = 2.0) {
        const p0 = Math.hypot(x1 - x0, y1 - y0);
        const p1 = Math.hypot(x2 - x1, y2 - y1);
        const estLength = p0 + p1;

        const numSegments = Math.max(4, Math.ceil(estLength * samplesPerUnit));
        const points = [];

        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const t2 = t * t;

            const x = mt2 * x0 + 2 * mt * t * x1 + t2 * x2;
            const y = mt2 * y0 + 2 * mt * t * y1 + t2 * y2;
            points.push([x, y]);
        }

        return points;
    }

    /**
     * Sample elliptical arc using SVG arc algorithm
     * @private
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} rx - X radius
     * @param {number} ry - Y radius
     * @param {number} xAxisRotation - Rotation angle in degrees
     * @param {number} largeArcFlag - Large arc flag (0 or 1)
     * @param {number} sweepFlag - Sweep flag (0 or 1)
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} samplesPerUnit - Sampling density
     * @returns {Point[]} Sampled points
     */
    static _sampleEllipticalArc(x1, y1, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x2, y2, samplesPerUnit = 2.0) {
        // Handle degenerate cases
        if (rx === 0 || ry === 0) {
            return [[x1, y1], [x2, y2]];
        }

        // Convert rotation to radians
        const phi = (xAxisRotation * Math.PI) / 180;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        // Ensure radii are positive
        rx = Math.abs(rx);
        ry = Math.abs(ry);

        // Compute center point (following SVG spec)
        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;
        const x1p = cosPhi * dx + sinPhi * dy;
        const y1p = -sinPhi * dx + cosPhi * dy;

        // Correct radii if needed
        const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lambda > 1) {
            rx *= Math.sqrt(lambda);
            ry *= Math.sqrt(lambda);
        }

        // Compute center
        const sign = largeArcFlag === sweepFlag ? -1 : 1;
        const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / 
            (rx * rx * y1p * y1p + ry * ry * x1p * x1p));
        const coeff = sign * Math.sqrt(sq);
        const cxp = coeff * (rx * y1p) / ry;
        const cyp = -coeff * (ry * x1p) / rx;

        const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
        const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

        // Compute angles
        const ux = (x1p - cxp) / rx;
        const uy = (y1p - cyp) / ry;
        const vx = (-x1p - cxp) / rx;
        const vy = (-y1p - cyp) / ry;

        const n = Math.sqrt(ux * ux + uy * uy);
        const p = ux;
        let theta1 = Math.acos(p / n);
        if (uy < 0) theta1 = -theta1;

        const np = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
        const dot = ux * vx + uy * vy;
        let dTheta = Math.acos(dot / np);
        if (ux * vy - uy * vx < 0) dTheta = -dTheta;

        if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;
        if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;

        // Sample the arc
        const arcLength = Math.abs(dTheta * Math.max(rx, ry));
        const numSamples = Math.max(2, Math.ceil(arcLength * samplesPerUnit));
        const points = [];

        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const angle = theta1 + t * dTheta;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);

            const x = cosPhi * rx * cosAngle - sinPhi * ry * sinAngle + cx;
            const y = sinPhi * rx * cosAngle + cosPhi * ry * sinAngle + cy;
            points.push([x, y]);
        }

        return points;
    }

    // ========================================
    // POLYLINE UTILITIES
    // ========================================

    /**
     * Calculate bounding box from polylines
     * @private
     * @param {Polyline[]} polylines - Array of polylines
     * @param {number} [svgWidth=100] - Fallback width
     * @param {number} [svgHeight=100] - Fallback height
     * @returns {Bounds} Bounding box
     */
    static _calculateBounds(polylines, svgWidth = 100, svgHeight = 100) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const polyline of polylines) {
            if (!polyline || !Array.isArray(polyline)) continue;
            for (const [x, y] of polyline) {
                if (isNaN(x) || isNaN(y)) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        
        // If no valid points found, use SVG dimensions
        if (minX === Infinity) {
            return {
                minX: 0,
                minY: 0,
                maxX: svgWidth,
                maxY: svgHeight,
                width: svgWidth,
                height: svgHeight
            };
        }
        
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Merge continuous strokes based on proximity and direction
     * @private
     * @param {Polyline[]} strokes - Array of stroke polylines
     * @param {number} [maxGap=0.1] - Maximum gap for merging
     * @param {number} [minAngleDeg=160] - Minimum angle for merging
     * @returns {Polyline[]} Merged strokes
     */
    static _mergeContinuousStrokes(strokes, maxGap = 0.1, minAngleDeg = 160) {
        if (!strokes || strokes.length <= 1) return strokes;
        
        const getStrokeDirection = (stroke) => {
            if (stroke.length < 2) return null;
            const dx = stroke[stroke.length - 1][0] - stroke[0][0];
            const dy = stroke[stroke.length - 1][1] - stroke[0][1];
            const length = Math.hypot(dx, dy);
            if (length < 0.001) return null;
            return [dx / length, dy / length];
        };
        
        const angleBetweenVectors = (v1, v2) => {
            if (!v1 || !v2) return 0;
            let dot = v1[0] * v2[0] + v1[1] * v2[1];
            dot = Math.max(-1, Math.min(1, dot));
            const angleRad = Math.acos(dot);
            return (angleRad * 180) / Math.PI;
        };
        
        const merged = [];
        let current = [...strokes[0]];
        
        for (let i = 1; i < strokes.length; i++) {
            const nextStroke = strokes[i];
            
            if (current.length < 2 || nextStroke.length < 2) {
                merged.push(current);
                current = [...nextStroke];
                continue;
            }
            
            // Check if connected
            const endPoint = current[current.length - 1];
            const startPoint = nextStroke[0];
            const gap = Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]);
            
            if (gap > maxGap) {
                merged.push(current);
                current = [...nextStroke];
                continue;
            }
            
            // Check direction
            const dirCurrent = getStrokeDirection(current);
            const dirNext = getStrokeDirection(nextStroke);
            const angle = angleBetweenVectors(dirCurrent, dirNext);
            
            if (angle <= (180 - minAngleDeg)) {
                // Merge
                if (gap < 0.01) {
                    current.push(...nextStroke.slice(1));
                } else {
                    current.push(...nextStroke);
                }
            } else {
                merged.push(current);
                current = [...nextStroke];
            }
        }
        
        merged.push(current);
        return merged;
    }

    // ========================================
    // TRANSFORM UTILITIES
    // ========================================

    /**
     * Get accumulated transform matrix for an element
     * @private
     * @param {Element} element - SVG element
     * @returns {Object} Transform matrix {a, b, c, d, e, f}
     */
    static _getTransformMatrix(element) {
        let current = element;
        let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

        const multiply = (m1, m2) => ({
            a: m1.a * m2.a + m1.c * m2.b,
            b: m1.b * m2.a + m1.d * m2.b,
            c: m1.a * m2.c + m1.c * m2.d,
            d: m1.b * m2.c + m1.d * m2.d,
            e: m1.a * m2.e + m1.c * m2.f + m1.e,
            f: m1.b * m2.e + m1.d * m2.f + m1.f
        });

        const parseTransform = (transformStr) => {
            if (!transformStr) return null;
            const commands = transformStr.match(/[a-zA-Z]+\([^\)]+\)/g);
            if (!commands) return null;
            
            let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            
            for (const cmd of commands) {
                const [type, argsStr] = [cmd.split('(')[0].trim(), cmd.split('(')[1].replace(')', '')];
                const args = argsStr.split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n));
                let t = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
                
                switch (type) {
                    case 'translate': {
                        const tx = args[0] || 0;
                        const ty = args[1] || 0;
                        t = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
                        break;
                    }
                    case 'scale': {
                        const sx = args[0] !== undefined ? args[0] : 1;
                        const sy = args[1] !== undefined ? args[1] : sx;
                        t = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
                        break;
                    }
                    case 'rotate': {
                        const angle = ((args[0] || 0) * Math.PI) / 180;
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        if (args.length >= 3) {
                            const cx = args[1];
                            const cy = args[2];
                            t = multiply(
                                multiply({ a: 1, b: 0, c: 0, d: 1, e: cx, f: cy }, 
                                    { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }),
                                { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy }
                            );
                        } else {
                            t = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
                        }
                        break;
                    }
                    case 'matrix': {
                        if (args.length === 6) {
                            t = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
                        }
                        break;
                    }
                }
                
                m = multiply(m, t);
            }
            
            return m;
        };

        while (current && current.getAttribute) {
            const tStr = current.getAttribute('transform');
            const tMatrix = parseTransform(tStr);
            if (tMatrix) {
                matrix = multiply(tMatrix, matrix);
            }
            current = current.parentElement;
        }
        
        return matrix;
    }

    /**
     * Apply transform matrix to polyline
     * @private
     * @param {Polyline} polyline - Input polyline
     * @param {Object} matrix - Transform matrix {a, b, c, d, e, f}
     * @returns {Polyline} Transformed polyline
     */
    static _applyTransform(polyline, matrix) {
        return polyline.map(([x, y]) => [
            matrix.a * x + matrix.c * y + matrix.e,
            matrix.b * x + matrix.d * y + matrix.f
        ]);
    }
}

// Export for ES modules
export { SVGProcessor };

