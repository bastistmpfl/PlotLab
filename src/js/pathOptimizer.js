/**
 * Optimizes path order for pen plotters using Travelling Salesman Problem algorithms
 * @class
 */
export class PathOptimizer {
    /**
     * Optimize polyline order to minimize pen-up travel distance
     * Uses greedy nearest-neighbor algorithm with optional 2-opt improvement
     * @param {Array<Array<[number, number]>>} polylines - Array of polylines to optimize
     * @param {[number, number]} startPoint - Starting point [x, y], default [0, 0]
     * @param {boolean} use2Opt - Whether to apply 2-opt improvement (slower but better)
     * @returns {Array<Array<[number, number]>>} Optimized polylines array
     */
    static optimize(polylines, startPoint = [0, 0], use2Opt = false) {
        if (!polylines || polylines.length <= 1) {
            return polylines;
        }

        // Build polyline metadata (start/end points)
        const segments = polylines.map((polyline, index) => ({
            index,
            polyline,
            start: polyline[0],
            end: polyline[polyline.length - 1],
            reversed: false
        }));

        // Greedy nearest-neighbor
        const optimized = this._greedyNearestNeighbor(segments, startPoint);

        // Optional 2-opt improvement for smaller sets
        if (use2Opt && optimized.length < 100) {
            return this._twoOptImprovement(optimized, startPoint);
        }

        return optimized.map(seg => seg.reversed ? [...seg.polyline].reverse() : seg.polyline);
    }

    /**
     * Calculate Euclidean distance between two points
     * @private
     * @param {[number, number]} p1 - First point
     * @param {[number, number]} p2 - Second point
     * @returns {number} Distance
     */
    static _distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Greedy nearest-neighbor algorithm
     * @private
     * @param {Array<Object>} segments - Segments with start/end points
     * @param {[number, number]} startPoint - Starting point
     * @returns {Array<Object>} Ordered segments
     */
    static _greedyNearestNeighbor(segments, startPoint) {
        const result = [];
        const remaining = [...segments];
        let currentPoint = startPoint;

        while (remaining.length > 0) {
            let bestIndex = -1;
            let bestDistance = Infinity;
            let bestReversed = false;

            // Find nearest segment (considering both directions)
            for (let i = 0; i < remaining.length; i++) {
                const seg = remaining[i];

                // Distance to start of segment
                const distToStart = this._distance(currentPoint, seg.start);
                if (distToStart < bestDistance) {
                    bestDistance = distToStart;
                    bestIndex = i;
                    bestReversed = false;
                }

                // Distance to end of segment (would require reversal)
                const distToEnd = this._distance(currentPoint, seg.end);
                if (distToEnd < bestDistance) {
                    bestDistance = distToEnd;
                    bestIndex = i;
                    bestReversed = true;
                }
            }

            // Add best segment to result
            const chosen = remaining.splice(bestIndex, 1)[0];
            chosen.reversed = bestReversed;
            result.push(chosen);

            // Update current point to end of chosen segment
            currentPoint = bestReversed ? chosen.start : chosen.end;
        }

        return result;
    }

    /**
     * 2-opt improvement algorithm (swap segments to reduce crossings)
     * @private
     * @param {Array<Object>} segments - Ordered segments
     * @param {[number, number]} startPoint - Starting point
     * @returns {Array<Object>} Improved segments
     */
    static _twoOptImprovement(segments, startPoint) {
        if (segments.length < 4) return segments;

        let improved = true;
        let tour = [...segments];
        let iterations = 0;
        const maxIterations = 100;

        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;

            for (let i = 0; i < tour.length - 1; i++) {
                for (let j = i + 2; j < tour.length; j++) {
                    // Calculate current distance
                    const currentDist = this._getTourSegmentDistance(tour, i, j, startPoint);
                    
                    // Reverse segment i+1 to j
                    const newTour = [
                        ...tour.slice(0, i + 1),
                        ...tour.slice(i + 1, j + 1).reverse(),
                        ...tour.slice(j + 1)
                    ];
                    
                    const newDist = this._getTourSegmentDistance(newTour, i, j, startPoint);

                    // If improvement found, apply it
                    if (newDist < currentDist - 0.01) { // 0.01mm threshold
                        tour = newTour;
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
        }

        return tour;
    }

    /**
     * Calculate distance for a tour segment
     * @private
     * @param {Array<Object>} tour - Current tour
     * @param {number} i - Start index
     * @param {number} j - End index
     * @param {[number, number]} startPoint - Starting point
     * @returns {number} Total distance
     */
    static _getTourSegmentDistance(tour, i, j, startPoint) {
        let dist = 0;
        let currentPoint = i === 0 ? startPoint : (tour[i - 1].reversed ? tour[i - 1].start : tour[i - 1].end);

        for (let k = i; k <= j; k++) {
            const seg = tour[k];
            const segStart = seg.reversed ? seg.end : seg.start;
            const segEnd = seg.reversed ? seg.start : seg.end;
            
            dist += this._distance(currentPoint, segStart);
            currentPoint = segEnd;
        }

        return dist;
    }

    /**
     * Calculate statistics for polylines (before and after optimization)
     * @param {Array<Array<[number, number]>>} polylines - Polylines
     * @param {[number, number]} startPoint - Starting point
     * @returns {Object} Statistics {totalTravel, drawDistance, penMoves}
     */
    static calculateStats(polylines, startPoint = [0, 0]) {
        let totalTravel = 0;
        let drawDistance = 0;
        let currentPoint = startPoint;

        for (const polyline of polylines) {
            if (polyline.length < 2) continue;

            // Travel to start of polyline (pen up)
            totalTravel += this._distance(currentPoint, polyline[0]);

            // Drawing distance (pen down)
            for (let i = 1; i < polyline.length; i++) {
                const dist = this._distance(polyline[i - 1], polyline[i]);
                drawDistance += dist;
            }

            // Update current point
            currentPoint = polyline[polyline.length - 1];
        }

        return {
            totalTravel,
            drawDistance,
            penMoves: polylines.length
        };
    }
}
