// Interpolation Functions - Linear interpolation with logistic boundary extrapolation
// Clean fallback when metalog fitting fails

// =============================================================================
// MAIN INTERPOLATION INTERFACE
// =============================================================================

export function createInterpolation(dataPoints) {
    console.group("🔧 Creating interpolation data for visualization");
    console.log("📊 Raw input dataPoints:", dataPoints);
    
    // Sort points by CDF probability
    const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
    console.log("📊 Sorted dataPoints by y-value:", sortedPoints);
    
    // Add logistic boundary extrapolation
    const extendedPoints = addLogisticBoundaryPoints(sortedPoints);
    
    console.log(`📊 Extended ${sortedPoints.length} points to ${extendedPoints.length} points with logistic boundary extrapolation`);
    console.log("📊 Final extended points:", extendedPoints);
    console.groupEnd();
    
    return {
        type: 'interpolation',
        points: extendedPoints,
        originalData: dataPoints
    };
}

// Interpolation doesn't have continuous evaluation - just return null
export function evaluateInterpolation(interpolation, y) {
    // Could implement linear interpolation between points if needed
    console.warn("⚠️ Interpolation evaluation not implemented - use discrete points");
    return null;
}

// =============================================================================
// LOGISTIC BOUNDARY EXTRAPOLATION
// =============================================================================

function addLogisticBoundaryPoints(normalizedPoints) {
    console.group("🎯 Logistic boundary extrapolation");
    console.log("📊 Input normalized points:", normalizedPoints);
    
    const points = [...normalizedPoints];
    
    if (points.length < 2) {
        console.warn("⚠️ Need at least 2 points for logistic extrapolation");
        console.groupEnd();
        return points;
    }
    
    console.group("🔍 Point selection for logistic fitting");
    
    // Select 3 points for logistic fitting from ORIGINAL data only
    let fitPoints;
    if (normalizedPoints.length === 2) {
        // Interpolate a middle point
        const midPoint = {
            x: (normalizedPoints[0].x + normalizedPoints[1].x) / 2,
            y: (normalizedPoints[0].y + normalizedPoints[1].y) / 2
        };
        fitPoints = [normalizedPoints[0], midPoint, normalizedPoints[1]];
        console.log("📊 Using interpolated middle point for logistic fit");
    } else if (normalizedPoints.length === 3) {
        fitPoints = normalizedPoints;
        console.log("📊 Using all 3 points for logistic fit");
    } else {
        // Use first, middle, and last points from ORIGINAL data
        const firstIndex = 0;
        const lastIndex = normalizedPoints.length - 1;
        const middleIndex = Math.floor(normalizedPoints.length / 2);
        fitPoints = [normalizedPoints[firstIndex], normalizedPoints[middleIndex], normalizedPoints[lastIndex]];
        console.log(`📊 Using points at indices [${firstIndex}, ${middleIndex}, ${lastIndex}] for logistic fit`);
        console.log(`📊 Selected indices correspond to: first=${firstIndex}, middle=${middleIndex}, last=${lastIndex}`);
    }
    
    console.log("📊 Final points selected for logistic fit:");
    fitPoints.forEach((point, i) => {
        console.log(`  Point ${i}: x=${point.x.toFixed(6)}, y=${point.y.toFixed(3)}`);
    });
    console.groupEnd();

    try {
        // Fit logistic curve
        const logistic = fitLogisticCurve(fitPoints);
        
        console.group("🎯 Boundary point extrapolation");
        
        // Store original boundary points before modifications
        const originalFirstPoint = points[0];
        const originalLastPoint = points[points.length - 1];
        console.log("📊 Original boundary points:", {
            first: `x=${originalFirstPoint.x.toFixed(6)}, y=${originalFirstPoint.y.toFixed(3)}`,
            last: `x=${originalLastPoint.x.toFixed(6)}, y=${originalLastPoint.y.toFixed(3)}`
        });
        
        // Add boundary points if needed with monotonicity constraints
        if (originalFirstPoint.x > 0.001) {
            const y0Raw = evaluateLogistic(logistic, 0);
            const y0 = Math.min(y0Raw, originalFirstPoint.y); // Left boundary must be ≤ first point
            points.unshift({ x: 0, y: y0 });
            console.log(`📊 Added left boundary: (0, ${y0.toFixed(3)}) [raw: ${y0Raw.toFixed(3)}, constrained: ${y0Raw !== y0}]`);
        }
        
        if (originalLastPoint.x < 0.999) {
            const y1Raw = evaluateLogistic(logistic, 1);
            const y1 = Math.max(y1Raw, originalLastPoint.y); // Right boundary must be ≥ last point  
            points.push({ x: 1, y: y1 });
            console.log(`📊 Added right boundary: (1, ${y1.toFixed(3)}) [raw: ${y1Raw.toFixed(3)}, constrained: ${y1Raw !== y1}]`);
            console.log(`📊 Right boundary constraint: original last point y=${originalLastPoint.y.toFixed(3)}`);
        }
        
        console.groupEnd();
        
    } catch (error) {
        console.group("⚠️ Logistic fitting failed - fallback extrapolation");
        console.warn("Error:", error.message);
        
        // Fallback to flat extrapolation
        if (normalizedPoints[0].x > 0.001) {
            points.unshift({ x: 0, y: normalizedPoints[0].y });
            console.log(`📊 Added flat left boundary: (0, ${normalizedPoints[0].y.toFixed(3)})`);
        }
        const lastPoint = normalizedPoints[normalizedPoints.length - 1];
        if (lastPoint.x < 0.999) {
            points.push({ x: 1, y: lastPoint.y });
            console.log(`📊 Added flat right boundary: (1, ${lastPoint.y.toFixed(3)})`);
        }
        console.groupEnd();
    }
    
    console.log("📊 Final extrapolated points:", points);
    console.groupEnd();
    
    return points;
}

// =============================================================================
// LOGISTIC CURVE FITTING
// =============================================================================

function fitLogisticCurve(points) {
    console.group("🔧 Logistic curve fitting");
    console.log("📊 Input points for fitting:", points);
    
    if (points.length !== 3) {
        throw new Error("Need exactly 3 points for logistic fitting");
    }
    
    const [p1, p2, p3] = points;
    
    // Estimate L (maximum value) as slightly above the highest y-value
    const maxY = Math.max(p1.y, p2.y, p3.y);
    const L = maxY * 1.1;
    console.log(`📊 L parameter estimate: max(y) * 1.1 = ${maxY.toFixed(4)} * 1.1 = ${L.toFixed(4)}`);
    
    console.group("🔄 Logistic linearization");
    // Transform to linearized form: ln(L/y - 1) = -k*x + k*x0
    const transformedPoints = points.map((p, i) => {
        const ratio = L / p.y - 1;
        if (ratio <= 0) {
            throw new Error(`Invalid ratio for logistic transform: L=${L}, y=${p.y}`);
        }
        const transformed = {
            x: p.x,
            y: Math.log(ratio)
        };
        console.log(`  Point ${i}: (${p.x.toFixed(6)}, ${p.y.toFixed(3)}) → (${transformed.x.toFixed(6)}, ${transformed.y.toFixed(6)})`);
        console.log(`    Ratio: ${L.toFixed(4)}/${p.y.toFixed(3)} - 1 = ${ratio.toFixed(6)}, ln(${ratio.toFixed(6)}) = ${transformed.y.toFixed(6)}`);
        return transformed;
    });
    console.groupEnd();
    
    console.group("📈 Linear regression on transformed data");
    // Linear regression on transformed data: y = mx + b where m = -k and b = k*x0
    const n = transformedPoints.length;
    const sumX = transformedPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = transformedPoints.reduce((sum, p) => sum + p.y, 0);
    const sumXY = transformedPoints.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = transformedPoints.reduce((sum, p) => sum + p.x * p.x, 0);
    
    console.log(`📊 Regression sums: n=${n}, Σx=${sumX.toFixed(6)}, Σy=${sumY.toFixed(6)}, Σxy=${sumXY.toFixed(6)}, Σx²=${sumX2.toFixed(6)}`);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    console.log(`📊 Linear fit: slope=${slope.toFixed(6)}, intercept=${intercept.toFixed(6)}`);
    
    const k = -slope;
    const x0 = intercept / k;
    
    console.log(`📊 Logistic parameters: k=${k.toFixed(4)}, x0=${x0.toFixed(4)}, L=${L.toFixed(4)}`);
    console.groupEnd();
    console.groupEnd();
    
    return { L, k, x0 };
}

function evaluateLogistic(logistic, x) {
    const { L, k, x0 } = logistic;
    const result = L / (1 + Math.exp(-k * (x - x0)));
    
    // Clamp to reasonable probability bounds
    return Math.max(0.001, Math.min(0.999, result));
}