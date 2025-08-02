// Survey Logic and UI Management
// Handles survey flow, step tracking, and UI creation

class SurveyLogic {
    constructor(visualizer) {
        this.visualizer = visualizer; // Reference to main AlignmentLandscape instance
        this.metalogUtils = new MetalogUtils();
        
        // Survey state
        this.currentStep = 0;
        this.totalSteps = 1 + 1 + 1 + 1 +
            SURVEY_CONFIG.predefinedApproaches.length +
            1 + SURVEY_CONFIG.predefinedInterventions.length + 1; // intro + example + metalog test + approaches title + approaches + interventions title + interventions + review
        this.completedSteps = new Set();
        this.hasInteracted = false;
        this.everCompleted = new Set(); // Track items that have been completed at least once
        
        // Store table-based metalog/linear data for export
        this.tableBasedData = null;
    }

    // Survey navigation
    getCurrentItem() {
        if (this.currentStep === 0) {
            return { type: "intro", item: SURVEY_CONFIG.introCard };
        } else if (this.currentStep === 1) {
            return { type: "example", item: SURVEY_CONFIG.exampleCard };
        } else if (this.currentStep === 2) {
            return { type: "metalogTest", item: SURVEY_CONFIG.metalogTestCard };
        } else if (this.currentStep === 3) {
            return { type: "approachesTitle", item: SURVEY_CONFIG.approachesTitle };
        } else if (this.currentStep >= 4 && this.currentStep < 4 + SURVEY_CONFIG.predefinedApproaches.length) {
            const approachIndex = this.currentStep - 4;
            return { type: "approach", item: SURVEY_CONFIG.predefinedApproaches[approachIndex] };
        } else if (this.currentStep === 4 + SURVEY_CONFIG.predefinedApproaches.length) {
            return { type: "interventionsTitle", item: SURVEY_CONFIG.interventionsTitle };
        } else if (this.currentStep > 4 + SURVEY_CONFIG.predefinedApproaches.length && 
                   this.currentStep < 4 + SURVEY_CONFIG.predefinedApproaches.length + 1 + SURVEY_CONFIG.predefinedInterventions.length) {
            const interventionIndex = this.currentStep - (4 + SURVEY_CONFIG.predefinedApproaches.length + 1);
            return { type: "intervention", item: SURVEY_CONFIG.predefinedInterventions[interventionIndex] };
        } else {
            return { type: "review", item: { title: "Review and Submit" } };
        }
    }

    canProceed() {
        const currentItem = this.getCurrentItem();
        
        if (currentItem.type === "approach" || currentItem.type === "intervention") {
            return this.hasInteracted;
        }
        
        return true; // Info cards, example, and metalog test can always proceed
    }

    nextStep() {
        if (this.canProceed() && this.currentStep < this.totalSteps - 1) {
            this.completedSteps.add(this.currentStep);
            this.everCompleted.add(this.currentStep);
            this.currentStep++;
            this.updateProgressDisplay();
            this.showCurrentStep();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateProgressDisplay();
            this.showCurrentStep();
        }
    }

    updateProgressDisplay() {
        document.getElementById("current-step").textContent = this.currentStep + 1;
        document.getElementById("total-steps").textContent = this.totalSteps;
        
        const progressPercent = ((this.currentStep + 1) / this.totalSteps) * 100;
        document.getElementById("progress-fill").style.width = progressPercent + "%";
        
        // Update button states
        document.getElementById("prevStep").disabled = this.currentStep === 0;
        document.getElementById("nextStep").disabled = !this.canProceed() || this.currentStep === this.totalSteps - 1;
        
        // Show/hide survey complete
        if (this.currentStep === this.totalSteps - 1) {
            document.getElementById("survey-complete").style.display = "block";
            document.getElementById("current-item-container").style.display = "none";
        } else {
            document.getElementById("survey-complete").style.display = "none";
            document.getElementById("current-item-container").style.display = "block";
        }
        
        // Update next button tooltip
        this.updateNextButtonTooltip();
    }

    updateNextButtonTooltip() {
        const tooltip = document.getElementById("nextTooltip");
        const button = document.getElementById("nextStep");
        
        if (!this.canProceed()) {
            tooltip.textContent = "Move one of the sliders to proceed";
            tooltip.style.display = "block";
            button.style.cursor = "not-allowed";
        } else {
            tooltip.style.display = "none";
            button.style.cursor = "pointer";
        }
    }

    showCurrentStep() {
        const container = document.getElementById("current-item-container");
        const currentItem = this.getCurrentItem();

        // Reset interaction tracking for slider steps
        if (currentItem.type === "approach" || currentItem.type === "intervention") {
            this.hasInteracted = false;
        }

        if (currentItem.type === "intro" || 
            currentItem.type === "approachesTitle" || 
            currentItem.type === "interventionsTitle") {
            this.createInfoCard(currentItem.item, container);
        } else if (currentItem.type === "example") {
            this.createExampleCard(currentItem.item, container);
        } else if (currentItem.type === "metalogTest") {
            this.createMetalogTestCard(currentItem.item, container);
        } else if (currentItem.type === "review") {
            this.createReviewUI(currentItem.item, container);
        } else if (currentItem.type === "approach") {
            this.createApproachUI(currentItem.item, container);
        } else {
            this.createInterventionUI(currentItem.item, container);
        }

        this.updateProgressDisplay();
        this.visualizer.updateVisualization();
    }

    // UI Creation Methods
    createInfoCard(card, container) {
        container.innerHTML = `
            <div class="info-card">
                <h3>${card.title}</h3>
                ${card.content}
            </div>
        `;
    }

    createExampleCard(card, container) {
        container.innerHTML = `
            <div class="info-card">
                <h3>${card.title}</h3>
                ${card.content}
            </div>
        `;
    }

    createMetalogTestCard(card, container) {
        container.innerHTML = `
            <div class="info-card">
                <h3>${card.title}</h3>
                ${card.content}
                ${card.showTable ? this.createMetalogDataTable(card.defaultData) : ''}
            </div>
        `;
        
        // If we have a table, set up the event listeners
        if (card.showTable) {
            this.setupMetalogTableEvents();
        }
    }

    createMetalogDataTable(defaultData) {
        return `
            <div class="metalog-table-container">
                <h4>Data Points</h4>
                <table class="metalog-data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Probability</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="metalog-table-body">
                        ${defaultData.map((row, index) => `
                            <tr>
                                <td><input type="text" class="table-input time-input" value="${row.time}" data-row="${index}"></td>
                                <td><input type="text" class="table-input prob-input" value="${row.probability}" data-row="${index}"></td>
                                <td><button class="remove-btn" onclick="surveyLogic.removeMetalogRow(${index})">Remove</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="button" onclick="surveyLogic.addMetalogRow()">Add Row</button>
            </div>
        `;
    }

    // Metalog table management
    setupMetalogTableEvents() {
        setTimeout(() => {
            const inputs = document.querySelectorAll('.table-input');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    this.validateTableInput(input);
                    this.updateMetalogFromTable();
                });
                input.addEventListener('blur', () => {
                    this.validateTableInput(input);
                    this.updateMetalogFromTable();
                });
            });
            // Initial validation and metalog rendering
            this.validateAllTableInputs();
            this.updateMetalogFromTable();
        }, 100);
    }

    getMetalogTableData() {
        const inputs = document.querySelectorAll('#metalog-table-body tr');
        const data = [];
        
        inputs.forEach(row => {
            const timeInput = row.querySelector('.time-input');
            const probInput = row.querySelector('.prob-input');
            
            if (timeInput && probInput) {
                const timeYears = this.metalogUtils.parseTimeInput(timeInput.value);
                const probability = this.metalogUtils.parseProbabilityInput(probInput.value);
                
                if (timeYears !== null && probability !== null) {
                    data.push({
                        x: timeYears,
                        y: probability
                    });
                }
            }
        });
        
        return data.sort((a, b) => a.y - b.y); // Sort by probability for metalog fitting
    }

    updateMetalogFromTable() {
        const data = this.getMetalogTableData();
        
        // Log table update with pairs
        const pairs = data.map(d => `(${this.metalogUtils.formatTime(d.x)}, ${(d.y*100).toFixed(0)}%)`).join(', ');
        console.log(`📋 Table updated: ${pairs}`);
        
        // Clear existing curves
        this.visualizer.svg.selectAll(".s-curve").remove();
        
        if (data.length < 2) {
            console.log("⚠️ Need at least 2 valid data points for metalog fitting");
            this.showMetalogError("Need at least 2 valid data points");
            return;
        }
        
        try {
            // Use smart fitting with fallback
            const metalog = this.metalogUtils.fitMetalogSmart(data);
            
            if (metalog) {
                console.log("✅ Metalog updated from table data");
                this.visualizer.drawMetalogCurve(metalog, "Table-based Approach", 0);
                this.tableBasedData = {
                    type: "metalog",
                    originalData: data,
                    metalog: metalog
                };
            } else {
                console.log("✅ Using piecewise linear fallback for table data");
                const linearData = this.metalogUtils.createPiecewiseLinearData(data);
                this.visualizer.drawPiecewiseLinearCurve(linearData, "Table-based Approach", 0);
                this.tableBasedData = {
                    type: "linear_interpolation",
                    originalData: data,
                    interpolatedData: linearData
                };
            }
            this.hideMetalogError();
            
        } catch (error) {
            console.error("❌ Failed to update metalog from table:", error);
            this.showMetalogError(error.message);
        }
    }

    showMetalogError(message) {
        let errorDiv = document.getElementById('metalog-error');
        if (!errorDiv) {
            const container = document.querySelector('.metalog-table-container');
            errorDiv = document.createElement('div');
            errorDiv.id = 'metalog-error';
            errorDiv.style.cssText = 'color: #d32f2f; background: #ffebee; padding: 8px; border-radius: 4px; margin: 10px 0; font-size: 14px;';
            container.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    hideMetalogError() {
        const errorDiv = document.getElementById('metalog-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    addMetalogRow() {
        const tbody = document.getElementById('metalog-table-body');
        const rowCount = tbody.children.length;
        
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="text" class="table-input time-input" value="1 year" data-row="${rowCount}"></td>
            <td><input type="text" class="table-input prob-input" value="50%" data-row="${rowCount}"></td>
            <td><button class="remove-btn" onclick="surveyLogic.removeMetalogRow(${rowCount})">Remove</button></td>
        `;
        
        tbody.appendChild(newRow);
        
        // Set up event listeners for the new inputs
        const newInputs = newRow.querySelectorAll('.table-input');
        newInputs.forEach(input => {
            input.addEventListener('input', () => this.updateMetalogFromTable());
            input.addEventListener('blur', () => this.updateMetalogFromTable());
        });
        
        this.updateMetalogFromTable();
    }

    removeMetalogRow(index) {
        const tbody = document.getElementById('metalog-table-body');
        const rows = tbody.children;
        
        if (rows.length > 2) { // Keep at least 2 rows
            rows[index].remove();
            this.updateMetalogFromTable();
        }
    }

    createApproachUI(approach, container) {
        container.innerHTML = `
            <h4>${approach.title}</h4>
            <div class="item-description">${approach.description}</div>
            <div class="control-section">
                <div class="slider-group">
                    <div class="slider-header">
                        <label for="maxProb-${approach.id}">Maximum success probability:</label>
                        <span class="slider-value" id="maxProbValue-${approach.id}">${Math.round(approach.maxProb * 100)}%</span>
                    </div>
                    <input type="range" id="maxProb-${approach.id}" min="0.01" max="1" step="0.01" value="${approach.maxProb}">
                </div>
                
                <div class="slider-group">
                    <div class="slider-header">
                        <label for="steepness-${approach.id}">Steepness (how quickly it improves):</label>
                        <span class="slider-value" id="steepnessValue-${approach.id}">${approach.steepness.toFixed(1)}</span>
                    </div>
                    <input type="range" id="steepness-${approach.id}" min="0.1" max="10" step="0.1" value="${approach.steepness}">
                </div>
                
                <div class="slider-group">
                    <div class="slider-header">
                        <label for="inflection-${approach.id}">Time to reach 50% of max probability:</label>
                        <span class="slider-value" id="inflectionValue-${approach.id}">${this.formatInflectionTime(approach.inflection)}</span>
                    </div>
                    <input type="range" id="inflection-${approach.id}" min="0" max="1" step="0.01" value="${approach.inflection}">
                </div>
            </div>
            
            <div class="control-section">
                <h4>Context</h4>
                <table class="context-table">
                    <tr>
                        <th>Time</th>
                        <th>1 year</th>
                        <th>10 years</th>
                        <th>50 years</th>
                    </tr>
                    <tr>
                        <td><strong>Success probability</strong></td>
                        <td id="prob-1y-${approach.id}">${this.formatProbability(this.calculateProbabilityAtTime(approach, 1))}</td>
                        <td id="prob-10y-${approach.id}">${this.formatProbability(this.calculateProbabilityAtTime(approach, 10))}</td>
                        <td id="prob-50y-${approach.id}">${this.formatProbability(this.calculateProbabilityAtTime(approach, 50))}</td>
                    </tr>
                </table>
            </div>
        `;

        this.setupApproachSliders(approach);
    }

    createInterventionUI(intervention, container) {
        container.innerHTML = `
            <h4>${intervention.title}</h4>
            <div class="item-description">${intervention.description}</div>
            <div class="control-section">
                <div class="slider-group">
                    <div class="slider-header">
                        <label for="mean-${intervention.id}">Most likely time gained:</label>
                        <span class="slider-value" id="meanValue-${intervention.id}">${this.formatInflectionTime(intervention.mean)}</span>
                    </div>
                    <input type="range" id="mean-${intervention.id}" min="0" max="1" step="0.01" value="${intervention.mean}">
                </div>
                
                <div class="slider-group">
                    <div class="slider-header">
                        <label for="std-${intervention.id}">Uncertainty (standard deviation):</label>
                        <span class="slider-value" id="stdValue-${intervention.id}">${intervention.std.toFixed(2)}</span>
                    </div>
                    <input type="range" id="std-${intervention.id}" min="0.05" max="0.5" step="0.01" value="${intervention.std}">
                </div>
            </div>
        `;

        this.setupInterventionSliders(intervention);
    }

    createReviewUI(item, container) {
        container.innerHTML = `
            <div class="info-card">
                <h3>${item.title}</h3>
                <p>Review your responses below. You can click on any item to return to that step and make changes.</p>
                
                <div class="review-lists">
                    <div class="review-section">
                        <h4>Alignment Approaches</h4>
                        <ul class="review-list" id="approaches-review"></ul>
                    </div>
                    <div class="review-section">
                        <h4>Governance Interventions</h4>
                        <ul class="review-list" id="interventions-review"></ul>
                    </div>
                </div>
            </div>
        `;

        this.populateReviewLists();
    }

    // Helper methods
    formatInflectionTime(normalizedTime) {
        const timeInYears = this.metalogUtils.normalizedToTime(normalizedTime);
        return this.metalogUtils.formatTime(timeInYears);
    }

    formatProbability(prob) {
        return (prob * 100).toFixed(0) + "%";
    }

    calculateProbabilityAtTime(approach, timeInYears) {
        const normalizedTime = this.metalogUtils.timeToNormalized(timeInYears);
        const inflectionTime = this.metalogUtils.normalizedToTime(approach.inflection);
        const prob = approach.maxProb / (1 + Math.exp(-approach.steepness * (timeInYears - inflectionTime)));
        return Math.max(0, Math.min(1, prob));
    }

    setupApproachSliders(approach) {
        const maxProbSlider = document.getElementById(`maxProb-${approach.id}`);
        const steepnessSlider = document.getElementById(`steepness-${approach.id}`);
        const inflectionSlider = document.getElementById(`inflection-${approach.id}`);

        const updateApproach = () => {
            approach.maxProb = parseFloat(maxProbSlider.value);
            approach.steepness = parseFloat(steepnessSlider.value);
            approach.inflection = parseFloat(inflectionSlider.value);

            // Update display values
            document.getElementById(`maxProbValue-${approach.id}`).textContent = Math.round(approach.maxProb * 100) + "%";
            document.getElementById(`steepnessValue-${approach.id}`).textContent = approach.steepness.toFixed(1);
            document.getElementById(`inflectionValue-${approach.id}`).textContent = this.formatInflectionTime(approach.inflection);

            // Update context table
            document.getElementById(`prob-1y-${approach.id}`).textContent = this.formatProbability(this.calculateProbabilityAtTime(approach, 1));
            document.getElementById(`prob-10y-${approach.id}`).textContent = this.formatProbability(this.calculateProbabilityAtTime(approach, 10));
            document.getElementById(`prob-50y-${approach.id}`).textContent = this.formatProbability(this.calculateProbabilityAtTime(approach, 50));

            this.hasInteracted = true;
            this.visualizer.updateVisualization();
            this.updateProgressDisplay();
        };

        maxProbSlider.addEventListener('input', updateApproach);
        steepnessSlider.addEventListener('input', updateApproach);
        inflectionSlider.addEventListener('input', updateApproach);
    }

    setupInterventionSliders(intervention) {
        const meanSlider = document.getElementById(`mean-${intervention.id}`);
        const stdSlider = document.getElementById(`std-${intervention.id}`);

        const updateIntervention = () => {
            intervention.mean = parseFloat(meanSlider.value);
            intervention.std = parseFloat(stdSlider.value);

            // Update display values
            document.getElementById(`meanValue-${intervention.id}`).textContent = this.formatInflectionTime(intervention.mean);
            document.getElementById(`stdValue-${intervention.id}`).textContent = intervention.std.toFixed(2);

            this.hasInteracted = true;
            this.visualizer.updateVisualization();
            this.updateProgressDisplay();
        };

        meanSlider.addEventListener('input', updateIntervention);
        stdSlider.addEventListener('input', updateIntervention);
    }

    populateReviewLists() {
        const approachsList = document.getElementById('approaches-review');
        const interventionsList = document.getElementById('interventions-review');

        // Clear existing content
        approachsList.innerHTML = '';
        interventionsList.innerHTML = '';

        // Add approaches
        SURVEY_CONFIG.predefinedApproaches.forEach((approach, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = approach.title;
            a.onclick = (e) => {
                e.preventDefault();
                this.currentStep = 4 + index;
                this.showCurrentStep();
            };
            li.appendChild(a);
            approachsList.appendChild(li);
        });

        // Add interventions
        SURVEY_CONFIG.predefinedInterventions.forEach((intervention, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = intervention.title;
            a.onclick = (e) => {
                e.preventDefault();
                this.currentStep = 4 + SURVEY_CONFIG.predefinedApproaches.length + 1 + index;
                this.showCurrentStep();
            };
            li.appendChild(a);
            interventionsList.appendChild(li);
        });
    }
}

// Export as global
window.SurveyLogic = SurveyLogic;