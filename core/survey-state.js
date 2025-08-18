/**
 * Survey State Manager
 * 
 * RESPONSIBILITY: Manages survey progression and step tracking
 * 
 * CONSTRAINTS:
 * - ONLY handles currentStep, navigation, and step definitions
 * - NO table data, NO chart rendering, NO UI creation
 * - NO dependencies on other core modules (table-manager, chart-renderer)
 * - ONLY depends on survey-config.js for step definitions
 * 
 * INTERFACE:
 * - getCurrentStep(): number - Current step index
 * - getCurrentItem(): object - Current step configuration 
 * - nextStep(): boolean - Navigate forward, returns success
 * - prevStep(): boolean - Navigate backward, returns success
 * - canProceed(): boolean - Whether next step is allowed
 * - getTotalSteps(): number - Total number of steps
 * 
 * DATA FLOW:
 * - State changes here trigger updates in coordinator
 * - This module NEVER calls other modules directly
 * - Other modules can READ from this but should not write
 * 
 * EVENTS:
 * - Emits 'step-changed' when navigation occurs
 * - Emits 'completion-changed' when step completion status changes
 */

class SurveyState extends EventTarget {
    constructor() {
        super();
        
        // Core state - ONLY step tracking
        this.currentStep = 0;
        this.completedSteps = new Set();
        this.everCompleted = new Set(); // Track steps that have been visited
        
        // Validation
        if (typeof SURVEY_CONFIG === 'undefined') {
            throw new Error('SurveyState requires SURVEY_CONFIG to be loaded');
        }
    }

    // === STEP NAVIGATION ===
    
    /**
     * Get current step index (0-based)
     */
    getCurrentStep() {
        return this.currentStep;
    }
    
    /**
     * Get current step configuration from survey config
     */
    getCurrentItem() {
        return this.getCurrentItemForStep(this.currentStep);
    }
    
    /**
     * Get step configuration for any step index
     */
    getCurrentItemForStep(step) {
        switch (step) {
            case 0:
                return { type: "intro", item: SURVEY_CONFIG.introCard };
            case 1:
                return {
                    type: "aiTimelines", 
                    item: SURVEY_CONFIG.aiTimelinesCard,
                };
            case 2:
                return {
                    type: "doomAssessment",
                    item: SURVEY_CONFIG.doomAssessmentCard,
                };
            case 3:
            default:
                return { type: "final", item: { title: "Survey Complete" } };
        }
    }
    
    /**
     * Calculate total number of steps
     */
    getTotalSteps() {
        // Count by trying each step until we hit the final slide
        let count = 0;
        while (true) {
            const item = this.getCurrentItemForStep(count);
            if (item.type === "final") {
                return count + 1; // Include the final slide
            }
            count++;
            if (count > 20) break; // Safety limit
        }
        return count;
    }
    
    /**
     * Check if we can proceed to next step
     * Currently always true - could be extended for validation
     */
    canProceed() {
        return true;
    }
    
    /**
     * Navigate to next step
     */
    nextStep() {
        if (!this.canProceed() || this.currentStep >= this.getTotalSteps() - 1) {
            return false;
        }
        
        // Mark current step as completed
        this.completedSteps.add(this.currentStep);
        this.everCompleted.add(this.currentStep);
        
        // Move forward
        this.currentStep++;
        
        // Emit events
        this.dispatchEvent(new CustomEvent('step-changed', {
            detail: { 
                newStep: this.currentStep, 
                newItem: this.getCurrentItem(),
                direction: 'forward'
            }
        }));
        
        this.dispatchEvent(new CustomEvent('completion-changed', {
            detail: {
                completedSteps: [...this.completedSteps],
                everCompleted: [...this.everCompleted]
            }
        }));
        
        return true;
    }
    
    /**
     * Navigate to previous step
     */
    prevStep() {
        if (this.currentStep <= 0) {
            return false;
        }
        
        this.currentStep--;
        
        // Emit event
        this.dispatchEvent(new CustomEvent('step-changed', {
            detail: { 
                newStep: this.currentStep, 
                newItem: this.getCurrentItem(),
                direction: 'backward'
            }
        }));
        
        return true;
    }
    
    /**
     * Jump to specific step (for review navigation)
     */
    goToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.getTotalSteps()) {
            return false;
        }
        
        const oldStep = this.currentStep;
        this.currentStep = stepIndex;
        
        const direction = stepIndex > oldStep ? 'forward' : 'backward';
        
        this.dispatchEvent(new CustomEvent('step-changed', {
            detail: { 
                newStep: this.currentStep, 
                newItem: this.getCurrentItem(),
                direction: direction
            }
        }));
        
        return true;
    }
    
    // === STATE QUERIES ===
    
    /**
     * Check if a step has been completed
     */
    isStepCompleted(stepIndex) {
        return this.completedSteps.has(stepIndex);
    }
    
    /**
     * Check if a step has ever been visited
     */
    wasStepVisited(stepIndex) {
        return this.everCompleted.has(stepIndex);
    }
    
    /**
     * Get completion statistics
     */
    getProgress() {
        return {
            currentStep: this.currentStep,
            totalSteps: this.getTotalSteps(),
            completedCount: this.completedSteps.size,
            progressPercent: ((this.currentStep + 1) / this.getTotalSteps()) * 100
        };
    }
    
    /**
     * Check if survey is complete
     */
    isComplete() {
        return this.currentStep === this.getTotalSteps() - 1;
    }
}

// Export for module use
window.SurveyState = SurveyState;