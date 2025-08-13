// Interpolation Functions - Linear interpolation with logistic boundary extrapolation
// Clean fallback when metalog fitting fails

// =============================================================================
// MAIN INTERPOLATION INTERFACE
// =============================================================================

export function createInterpolation(dataPoints) {
    console.log("🔧 Creating interpolation data for visualization");
    
    // Sort points by CDF probability
    const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
    
    // Add logistic boundary extrapolation
    const extendedPoints = addLogisticBoundaryPoints(sortedPoints);
    
    console.log(`📊 Extended ${sortedPoints.length} points to ${extendedPoints.length} points with logistic boundary extrapolation`);
    
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
    const points = [...normalizedPoints];
    
    if (points.length < 2) {
        console.warn("⚠️ Need at least 2 points for logistic extrapolation");
        return points;
    }
    
    // Select 3 points for logistic fitting
    let fitPoints;
    if (points.length === 2) {
        // Interpolate a middle point
        const midPoint = {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2
        };
        fitPoints = [points[0], midPoint, points[1]];
        console.log("📊 Using interpolated middle point for logistic fit");
    } else if (points.length === 3) {
        fitPoints = points;
    } else {
        // Use first, middle, and last points
        const firstIndex = 0;
        const lastIndex = points.length - 1;
        const middleIndex = Math.floor(points.length / 2);
        fitPoints = [points[firstIndex], points[middleIndex], points[lastIndex]];
        console.log(`📊 Using points at indices 0, ${middleIndex}, ${lastIndex} for logistic fit`);
    }
    
    console.log("📊 Using points for logistic fit:", fitPoints);

    try {
        // Fit logistic curve
        const logistic = fitLogisticCurve(fitPoints);
        
        // Add boundary points if needed with monotonicity constraints
        if (points[0].x > 0.001) {
            const y0Raw = evaluateLogistic(logistic, 0);
            const y0 = Math.min(y0Raw, points[0].y); // Left boundary must be ≤ first point
            points.unshift({ x: 0, y: y0 });
            console.log(`📊 Added logistic boundary: (0, ${y0.toFixed(3)}) [raw: ${y0Raw.toFixed(3)}]`);
        }
        
        const lastPoint = points[points.length - 1];
        if (lastPoint.x < 0.999) {
            const y1Raw = evaluateLogistic(logistic, 1);
            const y1 = Math.max(y1Raw, lastPoint.y); // Right boundary must be ≥ last point
            points.push({ x: 1, y: y1 });
            console.log(`📊 Added logistic boundary: (1, ${y1.toFixed(3)}) [raw: ${y1Raw.toFixed(3)}]`);
        }
        
    } catch (error) {
        console.warn("⚠️ Logistic fitting failed, falling back to flat extrapolation:", error.message);
        // Fallback to flat extrapolation
        if (normalizedPoints[0].x > 0.001) {
            points.unshift({ x: 0, y: normalizedPoints[0].y });
        }
        const lastPoint = normalizedPoints[normalizedPoints.length - 1];
        if (lastPoint.x < 0.999) {
            points.push({ x: 1, y: lastPoint.y });
        }
    }
    
    return points;
}

// =============================================================================
// LOGISTIC CURVE FITTING
// =============================================================================

function fitLogisticCurve(points) {
    console.log("🔧 Fitting logistic curve to points:", points);
    
    if (points.length !== 3) {
        throw new Error("Need exactly 3 points for logistic fitting");
    }
    
    const [p1, p2, p3] = points;
    
    // Estimate L (maximum value) as slightly above the highest y-value
    const L = Math.max(p1.y, p2.y, p3.y) * 1.1;
    
    // Transform to linearized form: ln(L/y - 1) = -k*x + k*x0
    const transformedPoints = points.map(p => {
        const ratio = L / p.y - 1;
        if (ratio <= 0) {
            throw new Error(`Invalid ratio for logistic transform: L=${L}, y=${p.y}`);
        }
        return {
            x: p.x,
            y: Math.log(ratio)
        };
    });
    
    // Linear regression on transformed data: y = mx + b where m = -k and b = k*x0
    const n = transformedPoints.length;
    const sumX = transformedPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = transformedPoints.reduce((sum, p) => sum + p.y, 0);
    const sumXY = transformedPoints.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = transformedPoints.reduce((sum, p) => sum + p.x * p.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const k = -slope;
    const x0 = intercept / k;
    
    console.log(`📊 Logistic parameters: L=${L.toFixed(4)}, k=${k.toFixed(4)}, x0=${x0.toFixed(4)}`);
    
    return { L, k, x0 };
}

function evaluateLogistic(logistic, x) {
    const { L, k, x0 } = logistic;
    const result = L / (1 + Math.exp(-k * (x - x0)));
    
    // Clamp to reasonable probability bounds
    return Math.max(0.001, Math.min(0.999, result));
}