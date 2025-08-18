/**
 * Label Placement using Bounded PAVA (Pool Adjacent Violators Algorithm)
 * 
 * RESPONSIBILITY: Optimal label placement via bounded isotonic regression
 * 
 * PROBLEM: Given n labels with target positions, heights, and importance weights,
 * find positions that minimize total weighted movement squared while avoiding 
 * overlaps and staying within bounds.
 * 
 * ALGORITHM: O(n) bounded isotonic regression using PAVA that respects both
 * monotonicity constraints and per-label interval bounds.
 * 
 * INTERFACE:
 * - solveLabelPlacement(labels, bounds, options): Optimal y-positions
 * - animateToNewPositions(oldPositions, newPositions, duration): Smooth transition
 * 
 * INPUT FORMAT:
 * - labels: [{desiredY, height, weight?, id?}] (sorted by desiredY ascending)
 * - bounds: {top, bottom, gap} (pixel coordinates)
 * - options: {weights?, debug?}
 */

class LabelPlacementPAVA {
    constructor() {
        this.debug = false;
    }

    /**
     * Main solver method - finds optimal label positions
     * 
     * @param {Array} labels - [{desiredY, height, weight?, id?}]
     * @param {Object} bounds - {top, bottom, gap}
     * @param {Object} options - {weights?, debug?}
     * @returns {Array} - [{y, id}] optimal positions
     */
    solveLabelPlacement(labels, bounds, options = {}) {
        if (!labels || labels.length === 0) {
            return [];
        }

        this.debug = options.debug || false;
        
        if (this.debug) {
            console.log('🎯 PAVA solver starting with', labels.length, 'labels');
            console.log('📐 Bounds:', bounds);
            console.log('🏷️ Labels:', labels.map(l => ({id: l.id, desiredY: l.desiredY, height: l.height})));
        }

        // Sort labels by desired Y position (always ascending)
        const sortedLabels = [...labels].sort((a, b) => a.desiredY - b.desiredY);

        if (this.debug) {
            console.log('📊 Sorted labels:', sortedLabels.map(l => ({id: l.id, desiredY: l.desiredY.toFixed(1)})));
        }

        // Extract data arrays
        const n = sortedLabels.length;
        const y = sortedLabels.map(l => l.desiredY);
        const h = sortedLabels.map(l => l.height);
        const w = sortedLabels.map(l => l.weight || 1);
        const p = bounds.gap;
        const yMin = bounds.top;
        const yMax = bounds.bottom;

        // Feasibility check
        const totalHeight = h.reduce((sum, height) => sum + height, 0);
        const totalGaps = (n - 1) * p;
        const availableSpace = yMax - yMin;
        
        if (totalHeight + totalGaps > availableSpace) {
            console.warn('🚨 PAVA: Box too small for labels + padding, using fallback');
            return this._fallbackPlacement(sortedLabels, bounds);
        }

        // Step 1: Precompute separations and transformed data
        const {x, L, U, s} = this._computeTransformedData(y, h, p, yMin, yMax);

        if (this.debug) {
            console.log('🔄 Transformed data:', {x, L, U, s});
        }

        // Step 2: Bounded isotonic regression via PAVA
        const z = this._boundedPAVA(x, L, U, w);

        if (this.debug) {
            console.log('📊 PAVA result z:', z);
        }

        // Step 3: Undo shift to get final positions
        const yHat = z.map((zi, i) => zi + s[i]);

        if (this.debug) {
            console.log('✅ Final positions y_hat:', yHat);
        }

        // Step 4: Create result with original IDs
        const result = yHat.map((y, i) => ({
            y: y,
            id: sortedLabels[i].id || i
        }));

        return result.sort((a, b) => a.y - b.y);
    }

    /**
     * Compute transformed data for isotonic regression
     */
    _computeTransformedData(y, h, p, yMin, yMax) {
        const n = y.length;
        
        // Compute separation requirements a[i] = (h[i] + h[i+1])/2 + p
        const a = [];
        for (let i = 0; i < n - 1; i++) {
            a[i] = (h[i] + h[i + 1]) / 2 + p;
        }
        
        // Compute cumulative separations s[i]
        const s = [0];
        for (let i = 1; i < n; i++) {
            s[i] = s[i - 1] + a[i - 1];
        }
        
        // Transform targets: x[i] = y[i] - s[i]
        const x = y.map((yi, i) => yi - s[i]);
        
        // Compute bounds: L[i] = yMin + h[i]/2 - s[i], U[i] = yMax - h[i]/2 - s[i]
        const L = h.map((hi, i) => yMin + hi / 2 - s[i]);
        const U = h.map((hi, i) => yMax - hi / 2 - s[i]);
        
        return {x, L, U, s};
    }

    /**
     * Bounded Pool Adjacent Violators Algorithm (PAVA)
     * 
     * Solves: min Σ w[i] * (z[i] - x[i])²
     * subject to: z[1] ≤ z[2] ≤ ... ≤ z[n], L[i] ≤ z[i] ≤ U[i]
     */
    _boundedPAVA(x, L, U, w) {
        const n = x.length;
        const stack = [];

        // Process each point
        for (let i = 0; i < n; i++) {
            // Start a new singleton block
            let W = w[i];
            let WX = w[i] * x[i];
            let lo = L[i];
            let hi = U[i];
            
            // Best unconstrained mean for this block
            let zbar = WX / W;
            // Clamp to this block's interval
            zbar = Math.min(Math.max(zbar, lo), hi);
            
            // Add to stack
            stack.push({
                W: W,
                WX: WX,
                lo: lo,
                hi: hi,
                zbar: zbar,
                size: 1
            });

            // Pool while order is violated
            while (stack.length >= 2 && stack[stack.length - 2].zbar > stack[stack.length - 1].zbar) {
                const block1 = stack.pop();
                const block0 = stack.pop();
                
                // Merge blocks
                const Wn = block0.W + block1.W;
                const WXn = block0.WX + block1.WX;
                const lon = Math.max(block0.lo, block1.lo);
                const hin = Math.min(block0.hi, block1.hi);
                
                // Compute pooled mean and clamp to pooled interval
                let zn = WXn / Wn;
                zn = Math.min(Math.max(zn, lon), hin);
                
                stack.push({
                    W: Wn,
                    WX: WXn,
                    lo: lon,
                    hi: hin,
                    zbar: zn,
                    size: block0.size + block1.size
                });
            }
        }

        if (this.debug) {
            console.log('📚 PAVA stack:', stack.map(b => ({zbar: b.zbar, size: b.size})));
        }

        // Expand blocks back to points
        const z = new Array(n);
        let k = 0;
        for (const block of stack) {
            for (let t = 0; t < block.size; t++) {
                z[k] = block.zbar;
                k++;
            }
        }

        return z;
    }

    /**
     * Animate smooth transition between label positions
     */
    async animateToNewPositions(oldPositions, newPositions, duration = 600) {
        if (!oldPositions || !newPositions) return;

        const startTime = performance.now();
        const positionMap = new Map(oldPositions.map(p => [p.id, p.y]));
        const targetMap = new Map(newPositions.map(p => [p.id, p.y]));

        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Smooth easing function
                const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

                // Interpolate positions
                const currentPositions = [];
                for (const [id, oldY] of positionMap) {
                    const newY = targetMap.get(id) || oldY;
                    const currentY = oldY + (newY - oldY) * eased;
                    currentPositions.push({id, y: currentY});
                }

                // Apply positions to DOM
                this._notifyPositionUpdate(currentPositions, progress);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Fallback placement when constraints can't be satisfied
     */
    _fallbackPlacement(labels, bounds) {
        console.warn('Using fallback label placement');
        
        const actualBounds = bounds || {top: 8, bottom: 240, gap: 2};
        const positions = [];
        let currentY = actualBounds.top + (labels[0]?.height || 12) / 2;
        
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const height = label.height || 12;
            
            // Ensure we don't exceed bounds
            currentY = Math.max(currentY, actualBounds.top + height/2);
            currentY = Math.min(currentY, actualBounds.bottom - height/2);
            
            positions.push({
                y: currentY,
                id: label.id || i
            });
            
            // Move to next position
            if (i < labels.length - 1) {
                const nextHeight = labels[i + 1]?.height || 12;
                currentY += (height + nextHeight) / 2 + actualBounds.gap;
            }
        }
        
        return positions;
    }

    /**
     * Notify external system of position updates during animation
     */
    _notifyPositionUpdate(positions, progress) {
        // Update DOM elements directly for better performance
        if (typeof d3 !== 'undefined') {
            d3.selectAll(".curve-label").each((_, i, nodes) => {
                const element = d3.select(nodes[i]);
                const labelId = element.attr("data-label-id");
                
                const position = positions.find(p => p.id === labelId);
                if (position) {
                    if (element.node().tagName === 'text') {
                        // Single text element
                        element.attr("y", position.y);
                    } else if (element.node().tagName === 'g') {
                        // Group of text elements - move all children
                        const texts = element.selectAll("text");
                        if (texts.size() > 0) {
                            // Get current offset of first text element
                            const firstText = d3.select(texts.nodes()[0]);
                            const currentY = parseFloat(firstText.attr("y"));
                            const targetY = position.y;
                            const offset = targetY - currentY;
                            
                            // Apply offset to all text elements
                            texts.attr("y", function() {
                                const currentYValue = parseFloat(d3.select(this).attr("y"));
                                return currentYValue + offset;
                            });
                        }
                    }
                }
            });
        }
        
        // Also emit custom event for additional listeners
        const event = new CustomEvent('labelPositionUpdate', {
            detail: {positions, progress}
        });
        window.dispatchEvent(event);
    }
}

// Export for module use
window.LabelPlacementPAVA = LabelPlacementPAVA;