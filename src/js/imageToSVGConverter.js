/**
 * Simple image to SVG converter using edge detection and path tracing.
 * Provides a lightweight alternative to complex tracing libraries.
 * @class
 */
export class ImageToSVGConverter {
    /**
     * Converts an image to SVG paths
     * @param {HTMLImageElement} image - Source image
     * @param {Object} options - Conversion options
     * @param {number} options.threshold - Brightness threshold (0-255, default: 128)
     * @param {number} options.simplify - Path simplification tolerance (default: 1)
     * @param {boolean} options.invert - Invert colors (default: false)
     * @returns {string} SVG markup
     */
    static convertToSVG(image, options = {}) {
        const {
            threshold = 128,
            simplify = 1,
            invert = false
        } = options;

        // Create canvas and get image data
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const width = imageData.width;
        const height = imageData.height;
        
        // Convert to binary (black/white) based on threshold
        const binary = this._toBinary(imageData, threshold, invert);
        
        // Find contours
        const paths = this._findContours(binary, width, height);
        
        // Simplify paths
        const simplifiedPaths = paths.map(path => this._simplifyPath(path, simplify));
        
        // Generate SVG
        return this._generateSVG(simplifiedPaths, width, height);
    }

    /**
     * Convert image data to binary (black/white) array
     * @private
     * @param {ImageData} imageData - Canvas image data
     * @param {number} threshold - Brightness threshold
     * @param {boolean} invert - Invert colors
     * @returns {Uint8Array} Binary array (0 or 1)
     */
    static _toBinary(imageData, threshold, invert) {
        const data = imageData.data;
        const binary = new Uint8Array(imageData.width * imageData.height);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Calculate brightness (grayscale)
            const brightness = (r + g + b) / 3;
            
            // Apply threshold (transparent is white)
            const isBlack = (a > 128 && brightness < threshold);
            binary[i / 4] = (invert ? !isBlack : isBlack) ? 1 : 0;
        }
        
        return binary;
    }

    /**
     * Find contours in binary image using marching squares
     * @private
     * @param {Uint8Array} binary - Binary image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array<Array<{x: number, y: number}>>} Array of contour paths
     */
    static _findContours(binary, width, height) {
        const paths = [];
        const visited = new Uint8Array(width * height);
        
        // Scan for edge pixels
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const idx = y * width + x;
                
                if (visited[idx]) continue;
                
                // Check if this is an edge pixel (has both black and white neighbors)
                const isEdge = this._isEdgePixel(binary, width, height, x, y);
                
                if (isEdge) {
                    // Trace contour from this point
                    const path = this._traceContour(binary, visited, width, height, x, y);
                    if (path.length > 3) { // Only keep paths with more than 3 points
                        paths.push(path);
                    }
                }
            }
        }
        
        return paths;
    }

    /**
     * Check if pixel is on an edge
     * @private
     */
    static _isEdgePixel(binary, width, height, x, y) {
        const idx = y * width + x;
        const current = binary[idx];
        
        // Check 4-connected neighbors
        const neighbors = [
            y > 0 ? binary[(y - 1) * width + x] : current,           // top
            x < width - 1 ? binary[y * width + (x + 1)] : current,   // right
            y < height - 1 ? binary[(y + 1) * width + x] : current,  // bottom
            x > 0 ? binary[y * width + (x - 1)] : current            // left
        ];
        
        // Edge if at least one neighbor is different
        return neighbors.some(n => n !== current);
    }

    /**
     * Trace a contour starting from a point
     * @private
     */
    static _traceContour(binary, visited, width, height, startX, startY) {
        const path = [];
        const directions = [
            { dx: 0, dy: -1 },  // up
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: 1 },   // down
            { dx: -1, dy: 0 }   // left
        ];
        
        let x = startX;
        let y = startY;
        let dir = 0; // Start moving right
        let steps = 0;
        const maxSteps = width * height; // Prevent infinite loops
        
        while (steps < maxSteps) {
            const idx = y * width + x;
            
            if (visited[idx] && steps > 0) {
                break; // Returned to start (closed contour)
            }
            
            visited[idx] = 1;
            path.push({ x, y });
            
            // Try to continue in same direction or turn
            let found = false;
            for (let i = 0; i < 4; i++) {
                const newDir = (dir + i) % 4;
                const dx = directions[newDir].dx;
                const dy = directions[newDir].dy;
                const newX = x + dx;
                const newY = y + dy;
                
                if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                    const newIdx = newY * width + newX;
                    if (this._isEdgePixel(binary, width, height, newX, newY)) {
                        x = newX;
                        y = newY;
                        dir = newDir;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) break;
            steps++;
        }
        
        return path;
    }

    /**
     * Simplify path using Douglas-Peucker algorithm
     * @private
     * @param {Array<{x: number, y: number}>} path - Input path
     * @param {number} tolerance - Simplification tolerance
     * @returns {Array<{x: number, y: number}>} Simplified path
     */
    static _simplifyPath(path, tolerance) {
        if (path.length < 3) return path;
        
        return this._douglasPeucker(path, tolerance);
    }

    /**
     * Douglas-Peucker path simplification
     * @private
     */
    static _douglasPeucker(points, tolerance) {
        if (points.length < 3) return points;
        
        let maxDistance = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];
        
        // Find point with maximum distance from line
        for (let i = 1; i < points.length - 1; i++) {
            const distance = this._perpendicularDistance(points[i], first, last);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than tolerance, recursively simplify
        if (maxDistance > tolerance) {
            const left = this._douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
            const right = this._douglasPeucker(points.slice(maxIndex), tolerance);
            
            // Combine results (remove duplicate middle point)
            return left.slice(0, -1).concat(right);
        } else {
            return [first, last];
        }
    }

    /**
     * Calculate perpendicular distance from point to line
     * @private
     */
    static _perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        if (dx === 0 && dy === 0) {
            return Math.sqrt(
                Math.pow(point.x - lineStart.x, 2) + 
                Math.pow(point.y - lineStart.y, 2)
            );
        }
        
        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / 
                  (dx * dx + dy * dy);
        
        if (t < 0) {
            return Math.sqrt(
                Math.pow(point.x - lineStart.x, 2) + 
                Math.pow(point.y - lineStart.y, 2)
            );
        } else if (t > 1) {
            return Math.sqrt(
                Math.pow(point.x - lineEnd.x, 2) + 
                Math.pow(point.y - lineEnd.y, 2)
            );
        }
        
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;
        
        return Math.sqrt(
            Math.pow(point.x - projX, 2) + 
            Math.pow(point.y - projY, 2)
        );
    }

    /**
     * Generate SVG markup from paths
     * @private
     * @param {Array<Array<{x: number, y: number}>>} paths - Array of paths
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {string} SVG markup
     */
    static _generateSVG(paths, width, height) {
        let pathData = '';
        
        for (const path of paths) {
            if (path.length === 0) continue;
            
            // Start with M (move to)
            pathData += `M ${path[0].x} ${path[0].y} `;
            
            // Add line segments
            for (let i = 1; i < path.length; i++) {
                pathData += `L ${path[i].x} ${path[i].y} `;
            }
            
            // Close path
            pathData += 'Z ';
        }
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${pathData}" fill="black" stroke="none"/>
</svg>`;
    }
}
