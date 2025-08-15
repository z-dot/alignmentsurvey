// Distribution Coordination - Main interface for fitting and visualization
// Tries metalog first, falls back to interpolation

import { fitMetalogSmart, evaluateMetalog } from './metalog-core.js';
import { createInterpolation, evaluateInterpolation } from './interpolation.js';

// =============================================================================
// MAIN DISTRIBUTION INTERFACE
// =============================================================================

export function fitDistribution(dataPoints) {
    console.log(`📊 Fitting distribution to ${dataPoints.length} points in [0,1]² space:`, dataPoints);

    try {
        // Try metalog first
        const metalog = fitMetalogSmart(dataPoints);
        
        if (metalog) {
            console.log("✅ Metalog fitting successful");
            return {
                type: 'metalog',
                metalog: metalog,
                dataPoints: dataPoints
            };
        } else {
            console.log("✅ Using interpolation fallback");
            const interpolation = createInterpolation(dataPoints);
            return interpolation;
        }
    } catch (error) {
        console.warn("⚠️ Fitting failed, using simple interpolation:", error.message);
        const interpolation = createInterpolation(dataPoints);
        return interpolation;
    }
}

// =============================================================================
// UNIFIED EVALUATION INTERFACE
// =============================================================================

export function evaluate(distribution, y) {
    if (distribution.type === 'metalog') {
        return evaluateMetalog(distribution.metalog, y);
    } else if (distribution.type === 'interpolation') {
        return evaluateInterpolation(distribution, y);
    }
    
    throw new Error(`Unknown distribution type: ${distribution.type}`);
}

// =============================================================================
// PLOT DATA GENERATION
// =============================================================================

export function getPlotData(distribution, numPoints = 200) {
    if (distribution.type === 'metalog') {
        return sampleMetalog(distribution, numPoints);
    } else if (distribution.type === 'interpolation') {
        return distribution.points; // Already discrete points
    }
    
    throw new Error(`Unknown distribution type: ${distribution.type}`);
}

function sampleMetalog(distribution, numPoints) {
    const data = [];
    const metalog = distribution.metalog;
    
    // Sample points evenly across probability space
    for (let i = 0; i <= numPoints; i++) {
        const y = 0.001 + (0.999 - 0.001) * (i / numPoints);
        const x = evaluateMetalog(metalog, y);
        
        // Skip invalid points
        if (isFinite(x) && x >= 0 && x <= 1) {
            data.push({ x, y });
        }
    }
    
    // Extend curve to reach x-axis boundaries (0 and 1)
    // This fixes the issue where metalog curves don't span the full time range
    
    if (data.length > 0) {
        // Extend toward x=0 (early times)
        const firstPoint = data[0];
        let y_extend = firstPoint.y;
        
        while (y_extend > 1e-10) { // Avoid numerical issues at y=0
            y_extend = y_extend / 2;
            const x_extend = evaluateMetalog(metalog, y_extend);
            
            if (isFinite(x_extend)) {
                data.unshift({ x: x_extend, y: y_extend }); // Add to beginning
            } else {
                break; // Hit invalid region
            }
        }
        
        // Extend toward x=1 (late times)
        const lastPoint = data[data.length - 1];
        let y_extend2 = lastPoint.y;
        
        while (y_extend2 < 0.999999) { // Avoid numerical issues at y=1
            y_extend2 = (1 + y_extend2) / 2;
            const x_extend = evaluateMetalog(metalog, y_extend2);
            
            if (isFinite(x_extend)) {
                data.push({ x: x_extend, y: y_extend2 }); // Add to end
            } else {
                break; // Hit invalid region
            }
        }
    }
    
    return data;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function getDistributionInfo(distribution) {
    if (distribution.type === 'metalog') {
        return {
            type: 'metalog',
            numTerms: distribution.metalog.numTerms,
            numDataPoints: distribution.dataPoints.length,
            coefficients: distribution.metalog.coefficients
        };
    } else if (distribution.type === 'interpolation') {
        return {
            type: 'interpolation',
            numPoints: distribution.points.length,
            numDataPoints: distribution.originalData.length
        };
    }
    
    return { type: 'unknown' };
}