// Core Metalog Functions - Essential metalog mathematics only
// Pure functions for metalog distribution fitting and evaluation

import { checkMetalogFeasibility } from './metalog-feasibility.js';

// =============================================================================
// DATA VALIDATION
// =============================================================================

export function validateMetalogData(data) {
    if (data.length < 2) {
        return { valid: false, error: "Need at least 2 data points" };
    }
    
    // Sort by probability for boundary checks
    const sorted = [...data].sort((a, b) => a.y - b.y);
    
    // Check probabilities are non-decreasing (allow equal values)
    for (let i = 1; i < data.length; i++) {
        if (data[i].y < data[i-1].y) {
            return { valid: false, error: `Probability cannot decrease: ${(data[i-1].y*100).toFixed(1)}% → ${(data[i].y*100).toFixed(1)}%` };
        }
    }
    
    // Check times are non-negative (we're in [0,1] space now)
    for (let i = 0; i < data.length; i++) {
        if (data[i].x < 0) {
            return { valid: false, error: "All times must be non-negative" };
        }
    }
    
    // Check for problematic boundary cases
    const firstPoint = sorted[0];
    const lastPoint = sorted[sorted.length - 1];
    
    // Reject extreme 0% -> 100% cases which are typically infeasible for metalog
    if (firstPoint.y === 0 && lastPoint.y === 1) {
        return { valid: false, error: "0% → 100% probability range is typically infeasible for metalog distributions" };
    }
    
    // Check for very steep gradients near boundaries
    if ((firstPoint.y <= 0.01 || lastPoint.y >= 0.99) && (lastPoint.y - firstPoint.y) > 0.9) {
        return { valid: false, error: "Extreme probability ranges near boundaries may cause numerical instability" };
    }
    
    return { valid: true };
}

// =============================================================================
// METALOG BASIS FUNCTIONS
// =============================================================================

export function getMetalogBasisValue(y, j) {
    const safeY = Math.max(0.001, Math.min(0.999, y));
    
    switch(j) {
        case 1: return 1;
        case 2: return Math.log(safeY / (1 - safeY));
        case 3: return (safeY - 0.5) * Math.log(safeY / (1 - safeY));
        case 4: return safeY - 0.5;
        default:
            if (j % 2 === 1) { // odd j >= 5
                return Math.pow(safeY - 0.5, (j - 1) / 2);
            } else { // even j >= 6
                return Math.log(safeY / (1 - safeY)) * Math.pow(safeY - 0.5, (j / 2) - 1);
            }
    }
}

// =============================================================================
// CORE METALOG FITTING
// =============================================================================

export function fitUnconstrainedMetalog(dataPoints, numTerms) {
    // Sort points (they're already in [0,1] space)
    const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
    const normalizedPoints = sortedPoints; // Already normalized
    
    const n = normalizedPoints.length;
    const k = Math.min(numTerms, n);
    
    // Build the Y matrix and z vector
    const Y = [];
    const z = [];
    
    for (let i = 0; i < n; i++) {
        const y = normalizedPoints[i].y;
        const x = normalizedPoints[i].x;
        
        const row = [];
        for (let j = 1; j <= k; j++) {
            row.push(getMetalogBasisValue(y, j));
        }
        
        Y.push(row);
        z.push(x);
    }
    
    // Solve using least squares with math.js
    const YMatrix = math.matrix(Y);
    const zVector = math.matrix(z);
    
    let coefficients;
    if (n === k) {
        // Exact solution
        coefficients = math.multiply(math.inv(YMatrix), zVector).toArray();
    } else {
        // Least squares: (Y^T Y)^(-1) Y^T z
        const YT = math.transpose(YMatrix);
        const YTY = math.multiply(YT, YMatrix);
        const YTz = math.multiply(YT, zVector);
        coefficients = math.multiply(math.inv(YTY), YTz).toArray();
    }
    
    return {
        coefficients: coefficients,
        numTerms: k,
        dataPoints: normalizedPoints,
        constrainedFit: false
    };
}

// =============================================================================
// METALOG EVALUATION
// =============================================================================

export function evaluateMetalog(metalog, cdfProbability) {
    const y = Math.max(0.001, Math.min(0.999, cdfProbability));
    const coefficients = metalog.coefficients;
    const k = metalog.numTerms;
    
    let result = 0;
    
    for (let j = 1; j <= k; j++) {
        result += coefficients[j-1] * getMetalogBasisValue(y, j);
    }
    
    return result;
}

// =============================================================================
// FIT QUALITY CHECKING
// =============================================================================

export function checkFitQuality(metalog, originalDataPoints) {
    const threshold = 0.025; // ±2.5% in probability space
    
    console.log("🔍 Quality check details:");
    for (const point of originalDataPoints) {
        const targetProbability = point.y;
        const actualTime = point.x; // Already in [0,1] space
        const predictedTime = evaluateMetalog(metalog, targetProbability);
        const timeError = Math.abs(actualTime - predictedTime);
        
        console.log(`   ${(point.y*100).toFixed(0)}%: error=${timeError.toFixed(4)}`);
        
        if (timeError > threshold) {
            console.log(`📊 Quality check failed: time error ${timeError.toFixed(4)} > ${threshold}`);
            return false;
        }
    }
    
    console.log("📊 Quality check passed: all points within tolerance");
    return true;
}

// =============================================================================
// SMART FITTING WITH FALLBACK
// =============================================================================

export function fitMetalogSmart(dataPoints) {
    const validation = validateMetalogData(dataPoints);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const n = dataPoints.length;
    
    // Try k values from n down to 2
    for (let k = n; k >= 2; k--) {
        console.log(`🔍 Trying k=${k}`);
        
        try {
            // Fit unconstrained metalog using least squares
            const metalog = fitUnconstrainedMetalog(dataPoints, k);
            
            // Check feasibility constraints  
            if (!checkMetalogFeasibility(metalog)) {
                console.log(`❌ k=${k} violates feasibility constraints - stepping down`);
                continue; // Try next lower k
            }
            
            console.log(`✅ k=${k} is feasible`);
            
            // Check fit quality (±2.5% in probability space)
            if (checkFitQuality(metalog, dataPoints)) {
                console.log(`🎯 k=${k} has acceptable fit quality`);
                return metalog;
            } else {
                console.log(`💀 k=${k} has poor fit quality - abandoning metalogs`);
                return null; // Trigger linear interpolation fallback
            }
            
        } catch (e) {
            console.log(`⚠️ k=${k} failed: ${e.message}`);
            continue;
        }
    }
    
    console.log("💀 All k values failed feasibility - abandoning metalogs");
    return null;
}