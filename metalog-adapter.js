// Simple adapter to use new functional modules with existing class interface
// Handles sync/async method calls appropriately

class MetalogUtilsNew extends ConversionUtils {
    constructor() {
        super(); // Get time/probability functions from ConversionUtils
        
        // Cache the imported modules to avoid repeated imports
        this.distributionModule = null;
        this.loadModules();
    }

    async loadModules() {
        try {
            this.distributionModule = await import('./distribution.js');
            console.log("✅ New distribution modules loaded successfully");
        } catch (error) {
            console.error("❌ Failed to load distribution modules:", error);
        }
    }

    // SYNC methods - these must work immediately (inherited from ConversionUtils)
    // parseTimeInput, parseProbabilityInput, formatTime, timeToNormalized, normalizedToTime, etc.

    // ASYNC methods - these need the new modules
    fitMetalogSmart(dataPoints) {
        console.log("🔍 fitMetalogSmart called with:", dataPoints);
        
        if (!this.distributionModule) {
            console.warn("⚠️ Distribution modules not loaded yet, using fallback");
            return null;
        }

        try {
            console.log("🔄 Calling new fitDistribution...");
            const distribution = this.distributionModule.fitDistribution(dataPoints);
            console.log("📊 Distribution result:", distribution);
            
            if (distribution.type === 'metalog') {
                console.log("✅ Returning metalog:", distribution.metalog);
                // Attach dataPoints to maintain compatibility with old chart renderer
                const metalogWithData = {
                    ...distribution.metalog,
                    dataPoints: dataPoints
                };
                return metalogWithData; // Return in old format with dataPoints
            } else {
                console.log("⚠️ Metalog failed, triggering interpolation fallback");
                return null; // Trigger interpolation fallback
            }
        } catch (error) {
            console.error("❌ New fitting system failed:", error);
            return null;
        }
    }

    createPiecewiseLinearData(dataPoints) {
        console.log("🔍 createPiecewiseLinearData called with:", dataPoints);
        
        if (!this.distributionModule) {
            console.warn("⚠️ Distribution modules not loaded yet, using fallback");
            return dataPoints; // Simple fallback
        }

        try {
            console.log("🔄 Calling new fitDistribution for interpolation...");
            const distribution = this.distributionModule.fitDistribution(dataPoints);
            console.log("📊 Interpolation result:", distribution);
            
            if (distribution.type === 'interpolation') {
                console.log("✅ Returning interpolation points:", distribution.points);
                return distribution.points;
            } else {
                // If metalog succeeded, sample it into discrete points
                console.log("📊 Metalog succeeded, sampling into discrete points");
                const plotData = this.distributionModule.getPlotData(distribution, 100);
                console.log("✅ Returning sampled points:", plotData);
                return plotData;
            }
        } catch (error) {
            console.error("❌ New interpolation system failed:", error);
            return dataPoints; // Simple fallback
        }
    }

    // Used by chart-renderer.js
    evaluateMetalog(metalog, y) {
        if (!this.distributionModule) {
            console.warn("⚠️ Distribution modules not loaded yet");
            return 0.5; // Fallback
        }

        try {
            const distribution = { type: 'metalog', metalog };
            return this.distributionModule.evaluate(distribution, y);
        } catch (error) {
            console.error("❌ New evaluation failed:", error);
            return 0.5; // Fallback
        }
    }

    generateMetalogPlotData(metalog) {
        if (!this.distributionModule) {
            console.warn("⚠️ Distribution modules not loaded yet");
            return []; // Fallback
        }

        try {
            const distribution = { type: 'metalog', metalog, dataPoints: metalog.dataPoints || [] };
            return this.distributionModule.getPlotData(distribution, 200);
        } catch (error) {
            console.error("❌ New plot data generation failed:", error);
            return []; // Fallback
        }
    }
}

// Replace the old MetalogUtils with the new one
window.MetalogUtils = MetalogUtilsNew;