// Compatibility Layer - Bridges old MetalogUtils class interface with new functional modules
// This lets us test the new system without breaking existing code

import { fitDistribution, getPlotData, evaluate, getDistributionInfo } from './distribution.js';

// =============================================================================
// COMPATIBILITY CLASS
// =============================================================================

class MetalogUtilsCompat extends ConversionUtils {
    constructor() {
        super(); // Initialize ConversionUtils for time/probability functions
        
        // Cache for current distribution
        this.currentDistribution = null;
    }

    // =============================================================================
    // MAIN INTERFACE METHODS (used by survey-logic.js)
    // =============================================================================

    fitMetalogSmart(dataPoints) {
        // This is the main entry point - returns distribution or null
        this.currentDistribution = fitDistribution(dataPoints);
        
        if (this.currentDistribution.type === 'metalog') {
            // Return metalog in old format for compatibility
            return this.currentDistribution.metalog;
        } else {
            // Return null to trigger interpolation fallback in old code
            return null;
        }
    }

    createPiecewiseLinearData(dataPoints) {
        // Create interpolation and return the points
        const interpolation = fitDistribution(dataPoints);
        this.currentDistribution = interpolation;
        
        if (interpolation.type === 'interpolation') {
            return interpolation.points;
        } else {
            // Fallback: if metalog succeeded, sample it into points
            return getPlotData(interpolation, 100);
        }
    }

    evaluateMetalog(metalog, y) {
        // Direct evaluation for metalog
        const distribution = {
            type: 'metalog',
            metalog: metalog
        };
        return evaluate(distribution, y);
    }

    // =============================================================================
    // COMPATIBILITY METHODS (for chart-renderer.js)
    // =============================================================================

    generateMetalogPlotData(metalog) {
        // Used by chart-renderer for plotting metalog curves
        const distribution = {
            type: 'metalog',
            metalog: metalog,
            dataPoints: metalog.dataPoints || []
        };
        return getPlotData(distribution, 200);
    }

    // =============================================================================
    // LEGACY METHODS (keep for now, might be used somewhere)
    // =============================================================================

    validateMetalogData(data) {
        // Just create a distribution and see if it works
        try {
            fitDistribution(data);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Debugging methods
    getCurrentDistributionInfo() {
        if (this.currentDistribution) {
            return getDistributionInfo(this.currentDistribution);
        }
        return null;
    }
}

// =============================================================================
// EXPORT FOR BACKWARDS COMPATIBILITY
// =============================================================================

// Export the compatibility class as MetalogUtils
window.MetalogUtilsCompat = MetalogUtilsCompat;

// Also export the functional interface for future use
window.DistributionFunctions = { fitDistribution, getPlotData, evaluate, getDistributionInfo };