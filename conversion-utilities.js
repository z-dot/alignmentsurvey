// Time and Probability Conversion Utilities
// Pure conversion functions - no metalog logic, no DOM dependencies

class ConversionUtils {
    constructor() {
        // Time scale configuration
        this.minTimeYears = 1/365.25; // 1 day minimum
        this.maxTimeYears = 100;      // 1 century maximum
    }

    // =============================================================================
    // TIME CONVERSION UTILITIES
    // =============================================================================

    timeToNormalized(timeInYears) {
        const logMin = Math.log10(this.minTimeYears);
        const logMax = Math.log10(this.maxTimeYears);
        const logValue = Math.log10(Math.max(this.minTimeYears, Math.min(this.maxTimeYears, timeInYears)));
        return (logValue - logMin) / (logMax - logMin);
    }

    normalizedToTime(normalizedValue) {
        const logMin = Math.log10(this.minTimeYears);
        const logMax = Math.log10(this.maxTimeYears);
        const logValue = logMin + normalizedValue * (logMax - logMin);
        return Math.pow(10, logValue);
    }

    // =============================================================================
    // INPUT PARSING FUNCTIONS
    // =============================================================================

    parseTimeInput(timeStr) {
        const cleaned = timeStr.toLowerCase().trim();
        const number = parseFloat(cleaned);
        
        if (isNaN(number) || number <= 0) return null;
        
        // Handle all plural and singular forms
        if (cleaned.includes('day')) return number / 365.25;
        if (cleaned.includes('week')) return number / 52.18;
        if (cleaned.includes('month')) return number / 12;
        if (cleaned.includes('year')) return number;
        if (cleaned.includes('decade')) return number * 10;
        if (cleaned.includes('centur')) return number * 100; // covers "century" and "centuries"
        
        // Default to years if no unit specified
        return number;
    }

    parseProbabilityInput(probStr) {
        const cleaned = probStr.trim();
        let number = parseFloat(cleaned);
        
        if (isNaN(number)) return null;
        
        // If it contains %, treat as percentage
        if (cleaned.includes('%')) {
            number = number / 100;
        }
        
        // Clamp to valid probability range
        return Math.max(0, Math.min(1, number));
    }

    // =============================================================================
    // FORMATTING FUNCTIONS
    // =============================================================================

    formatTime(years) {
        // Handle very small values
        if (years < 1/365.25) {
            const days = years * 365.25;
            return days === 1 ? "1 day" : `${days.toFixed(1)} days`;
        }
        
        // Less than 1 month - show in days
        if (years < 1/12) {
            const days = Math.round(years * 365.25);
            return days === 1 ? "1 day" : `${days} days`;
        }
        
        // Less than 1 year - show in months (but not exactly 1 year)
        if (years < 0.99) {
            const months = years * 12;
            return months === 1 ? "1 month" : `${months.toFixed(1)} months`;
        }
        
        // Less than 10 years - show with one decimal
        if (years < 10) {
            return years === 1 ? "1 year" : `${years.toFixed(1)} years`;
        }
        
        // Less than 100 years - show as whole numbers
        if (years < 100) {
            return `${years.toFixed(0)} years`;
        }
        
        // 100+ years - show in centuries
        const centuries = years / 100;
        return centuries === 1 ? "1 century" : `${centuries.toFixed(1)} centuries`;
    }

    formatProbability(prob) {
        return `${(prob * 100).toFixed(0)}%`;
    }

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    clipToRange(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

// Export for use in other modules
window.ConversionUtils = ConversionUtils;