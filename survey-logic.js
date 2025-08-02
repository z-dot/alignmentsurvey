// Survey Logic and UI Management
// Handles survey flow, step tracking, and UI creation

class SurveyLogic {
    constructor(visualizer) {
        this.visualizer = visualizer; // Reference to main AlignmentLandscape instance
        this.metalogUtils = new MetalogUtils();
        
        // Survey state
        this.currentStep = 0;
        this.totalSteps = 5; // intro + example + metalog test + review + final
        this.completedSteps = new Set();
        this.hasInteracted = false;
        this.everCompleted = new Set(); // Track items that have been completed at least once
        
        // Centralized table state management
        // Each table's data is stored as array of {x, y} pairs where x,y ∈ [0,1]
        // Invariants: unique x-values, sorted by x, monotonic in y (CDF property)
        this.tableStates = {};
        
        // Initialize default table states
        this.initializeTableStates();
        
        // Store table-based metalog/linear data for export
        this.tableBasedData = null;
    }

    // Initialize table states from default data
    initializeTableStates() {
        // Convert metalog test default data to normalized [0,1]² format
        if (SURVEY_CONFIG.metalogTestCard?.defaultData) {
            this.tableStates['metalog-test'] = SURVEY_CONFIG.metalogTestCard.defaultData.map(item => {
                const timeYears = this.metalogUtils.parseTimeInput(item.time);
                const probability = this.metalogUtils.parseProbabilityInput(item.probability);
                return {
                    x: this.metalogUtils.timeToNormalized(timeYears),
                    y: probability
                };
            }).sort((a, b) => a.x - b.x); // Ensure sorted by x
        } else {
            // Fallback default data
            this.tableStates['metalog-test'] = [
                {x: this.metalogUtils.timeToNormalized(1), y: 0.25},
                {x: this.metalogUtils.timeToNormalized(10), y: 0.50},
                {x: this.metalogUtils.timeToNormalized(50), y: 0.75}
            ];
        }
    }

    // Core table state management methods
    getTableState(tableId) {
        if (!this.tableStates[tableId]) {
            this.tableStates[tableId] = [];
        }
        return [...this.tableStates[tableId]]; // Return copy to prevent accidental mutation
    }

    setTableState(tableId, newData) {
        // Validate and enforce invariants
        const validatedData = this.validateAndCorrectTableData(newData);
        this.tableStates[tableId] = validatedData;
        
        // Trigger UI update for this table
        this.renderTable(tableId);
        this.updateMetalogFromTable(tableId);
    }

    addTableRow(tableId, x, y) {
        const currentData = this.getTableState(tableId);
        
        // Add the new point
        currentData.push({x, y});
        
        // Update state (this will validate and re-render)
        this.setTableState(tableId, currentData);
    }

    removeTableRow(tableId, index) {
        const currentData = this.getTableState(tableId);
        
        if (currentData.length > 2 && index >= 0 && index < currentData.length) {
            currentData.splice(index, 1);
            this.setTableState(tableId, currentData);
        }
    }

    updateTableCell(tableId, rowIndex, field, value) {
        const currentData = this.getTableState(tableId);
        
        if (rowIndex >= 0 && rowIndex < currentData.length) {
            currentData[rowIndex][field] = value;
            this.setTableState(tableId, currentData);
        }
    }

    // Validate and enforce table data invariants
    validateAndCorrectTableData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        // Sort by x
        const sorted = [...data].sort((a, b) => a.x - b.x);
        
        // Remove duplicates (keep first occurrence of each x value)
        const unique = [];
        const seenX = new Set();
        
        for (const point of sorted) {
            if (!seenX.has(point.x)) {
                seenX.add(point.x);
                unique.push({
                    x: Math.max(0, Math.min(1, point.x)), // Clamp to [0,1]
                    y: Math.max(0, Math.min(1, point.y))  // Clamp to [0,1]
                });
            }
        }
        
        // Enforce monotonic y (CDF property)
        for (let i = 1; i < unique.length; i++) {
            if (unique[i].y < unique[i-1].y) {
                unique[i].y = unique[i-1].y; // Make it at least as large as previous
            }
        }
        
        return unique;
    }

    // Render table DOM from state
    renderTable(tableId) {
        const tableData = this.getTableState(tableId);
        const tbody = document.querySelector(`[data-table-id="${tableId}"] tbody`);
        
        if (!tbody) {
            console.warn(`Table with ID ${tableId} not found in DOM`);
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        // Render rows from state
        tableData.forEach((point, index) => {
            const timeYears = this.metalogUtils.normalizedToTime(point.x);
            const timeStr = this.metalogUtils.formatTime(timeYears);
            const probStr = (point.y * 100).toFixed(0) + '%';

            const row = document.createElement('tr');
            row.dataset.row = index;
            row.innerHTML = `
                <td class="time-cell" contenteditable="true" data-type="time">${timeStr}</td>
                <td class="prob-cell" contenteditable="true" data-type="probability">${probStr}</td>
                <td><button class="remove-btn" onclick="surveyLogic.removeMetalogRow('${tableId}', ${index})">×</button></td>
            `;

            tbody.appendChild(row);
        });

        // Set up event listeners for all cells
        this.setupTableEventListeners(tableId);
    }

    setupTableEventListeners(tableId) {
        const table = document.querySelector(`[data-table-id="${tableId}"]`);
        if (!table) return;

        const cells = table.querySelectorAll('[contenteditable="true"]');
        cells.forEach(cell => {
            // Store initial value
            cell.dataset.originalValue = cell.textContent;
            
            cell.addEventListener('focus', (e) => {
                e.target.dataset.originalValue = e.target.textContent;
            });
            
            cell.addEventListener('blur', (e) => {
                this.handleCellEdit(e.target, tableId);
            });
            
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });
    }

    // Survey navigation
    getCurrentItem() {
        switch (this.currentStep) {
            case 0:
                return { type: "intro", item: SURVEY_CONFIG.introCard };
            case 1:
                return { type: "example", item: SURVEY_CONFIG.exampleCard };
            case 2:
                return { type: "metalogTest", item: SURVEY_CONFIG.metalogTestCard };
            case 3:
                return { type: "review", item: { title: "Review Your Distribution" } };
            case 4:
            default:
                return { type: "final", item: { title: "Survey Complete" } };
        }
    }

    canProceed() {
        // All steps can always proceed
        return true;
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
        const prevButton = document.getElementById("prevStep");
        const nextButton = document.getElementById("nextStep");
        const navigationControls = document.querySelector(".navigation-controls");
        
        // Disable/enable buttons
        prevButton.disabled = this.currentStep === 0;
        nextButton.disabled = this.currentStep === this.totalSteps - 1;
        
        // Hide navigation controls entirely on final slide
        if (this.currentStep === this.totalSteps - 1) {
            navigationControls.style.display = "none";
        } else {
            navigationControls.style.display = "block";
        }
        
        // Always show the current item container (no more separate survey-complete div)
        document.getElementById("current-item-container").style.display = "block";
        document.getElementById("survey-complete").style.display = "none";
        
        // Update next button tooltip
        this.updateNextButtonTooltip();
    }

    updateNextButtonTooltip() {
        const tooltip = document.getElementById("nextTooltip");
        const button = document.getElementById("nextStep");
        
        // Hide tooltip since all steps can proceed
        tooltip.style.display = "none";
        button.style.cursor = "pointer";
    }

    showCurrentStep() {
        const container = document.getElementById("current-item-container");
        const currentItem = this.getCurrentItem();

        switch (currentItem.type) {
            case "intro":
                this.createInfoCard(currentItem.item, container);
                break;
            case "example":
                this.createExampleCard(currentItem.item, container);
                break;
            case "metalogTest":
                this.createMetalogTestCard(currentItem.item, container);
                break;
            case "review":
                this.createReviewUI(currentItem.item, container);
                break;
            case "final":
                this.createFinalUI(currentItem.item, container);
                break;
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
                ${card.showTable ? this.createMetalogDataTable() : ''}
            </div>
        `;
        
        // If we have a table, render it from state
        if (card.showTable) {
            setTimeout(() => {
                this.renderTable('metalog-test');
                this.updateMetalogFromTable('metalog-test');
            }, 100);
        }
    }

    createMetalogDataTable() {
        const tableId = 'metalog-test';
        return `
            <div class="metalog-table-container">
                <h4>Data Points</h4>
                <table class="metalog-data-table" id="metalog-table" data-table-id="${tableId}">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Probability</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="metalog-table-body">
                        <!-- Rows will be rendered from state -->
                    </tbody>
                </table>
                <button class="button" onclick="surveyLogic.addMetalogRow('${tableId}')">Add Row</button>
                <div id="table-status" style="font-size: 11px; color: #666; margin-top: 5px;"></div>
            </div>
        `;
    }


    // Smart cell editing with state management
    handleCellEdit(cell, tableId) {
        const value = cell.textContent.trim();
        const type = cell.dataset.type;
        const row = cell.closest('tr');
        const rowIndex = parseInt(row.dataset.row);
        
        // Store original value to detect actual changes
        const originalValue = cell.dataset.originalValue || '';
        
        console.log(`🔧 Cell edit: "${originalValue}" → "${value}" (${type}, row ${rowIndex})`);
        
        // Only process if value actually changed
        if (value === originalValue) {
            console.log('⚪ No change detected, skipping');
            return;
        }
        
        const currentData = this.getTableState(tableId);
        if (rowIndex < 0 || rowIndex >= currentData.length) {
            console.warn('Invalid row index:', rowIndex);
            return;
        }
        
        let newValue;
        
        if (type === 'time') {
            const timeYears = this.metalogUtils.parseTimeInput(value);
            if (timeYears === null) {
                // Invalid format - revert
                cell.textContent = originalValue;
                cell.dataset.originalValue = originalValue;
                return;
            }
            newValue = this.metalogUtils.timeToNormalized(timeYears);
            this.updateTableCell(tableId, rowIndex, 'x', newValue);
        } else if (type === 'probability') {
            const probability = this.metalogUtils.parseProbabilityInput(value);
            if (probability === null) {
                // Invalid format - revert
                cell.textContent = originalValue;
                cell.dataset.originalValue = originalValue;
                return;
            }
            newValue = probability;
            this.updateTableCell(tableId, rowIndex, 'y', newValue);
        }
        
        console.log(`🔄 Updated state: ${type} = ${newValue}`);
    }
    
    
    updateTableStatus(message, isError = false) {
        const statusDiv = document.getElementById('table-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = isError ? '#d32f2f' : '#666';
        }
    }


    updateMetalogFromTable(tableId) {
        const tableData = this.getTableState(tableId);
        
        // Convert normalized data to the format needed for metalog fitting
        const data = tableData.map(point => ({
            x: this.metalogUtils.normalizedToTime(point.x), // Convert back to years for metalog
            y: point.y
        }));
        
        // Log table update with pairs
        const pairs = data.map(d => `(${this.metalogUtils.formatTime(d.x)}, ${(d.y*100).toFixed(0)}%)`).join(', ');
        console.log(`📋 Table updated: ${pairs}`);
        
        // Clear existing curves
        this.visualizer.svg.selectAll(".s-curve").remove();
        
        if (data.length < 2) {
            console.log("⚠️ Need at least 2 valid data points for metalog fitting");
            this.updateTableStatus("Need at least 2 data points", true);
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
                this.updateTableStatus(`Metalog fitted with ${data.length} points`);
            } else {
                console.log("✅ Using piecewise linear fallback for table data");
                const linearData = this.metalogUtils.createPiecewiseLinearData(data);
                this.visualizer.drawPiecewiseLinearCurve(linearData, "Table-based Approach", 0);
                this.tableBasedData = {
                    type: "linear_interpolation",
                    originalData: data,
                    interpolatedData: linearData
                };
                this.updateTableStatus(`Linear interpolation with ${data.length} points`);
            }
            this.hideMetalogError();
            
        } catch (error) {
            console.error("❌ Failed to update metalog from table:", error);
            this.updateTableStatus(error.message, true);
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

    addMetalogRow(tableId) {
        const currentData = this.getTableState(tableId);
        
        if (currentData.length === 0) {
            // First row - start at reasonable point
            const newX = this.metalogUtils.timeToNormalized(1); // 1 year
            const newY = 0.5; // 50%
            
            this.addTableRow(tableId, newX, newY);
            return;
        }
        
        // Check if there's a point at x=1
        const hasPointAtOne = currentData.some(d => Math.abs(d.x - 1.0) < 0.001);
        
        let newX, newY;
        
        if (hasPointAtOne) {
            // Case 1: Point exists at x=1, interpolate between last two points
            // ((x_{n-1} + x_{n}) / 2, (y_{n-1} + y_{n}) / 2)
            if (currentData.length >= 2) {
                const last = currentData[currentData.length - 1];
                const secondLast = currentData[currentData.length - 2];
                
                newX = (secondLast.x + last.x) / 2;
                newY = (secondLast.y + last.y) / 2;
            } else {
                // Only one point at x=1, add at middle of range
                newX = 0.5;
                newY = 0.5;
            }
        } else {
            // Case 2: No point at x=1, add point at (1, y) where y is from fitted logistic curve
            newX = 1.0;
            
            if (currentData.length >= 2) {
                // Use first and last points to fit logistic curve
                const first = currentData[0];
                const last = currentData[currentData.length - 1];
                newY = this.evaluateLogisticCurve(first, last, newX);
            } else {
                // Only one point - simple extrapolation
                const single = currentData[0];
                newY = Math.min(0.99, single.y + (1.0 - single.x) * 0.3);
            }
        }
        
        this.addTableRow(tableId, newX, newY);
    }
    
    // Fit and evaluate logistic curve: 1/(1 + exp(-s*(x-i)))
    evaluateLogisticCurve(firstPoint, lastPoint, targetX) {
        const x1 = firstPoint.x;
        const y1 = firstPoint.y;
        const x2 = lastPoint.x;
        const y2 = lastPoint.y;
        
        // Prevent division by zero and handle edge cases
        if (Math.abs(x2 - x1) < 0.001) {
            return (y1 + y2) / 2;
        }
        
        // Convert probabilities to logit space for fitting
        const logit1 = Math.log(y1 / (1 - y1));
        const logit2 = Math.log(y2 / (1 - y2));
        
        // Fit linear relationship in logit space: logit = s*x + c
        const s = (logit2 - logit1) / (x2 - x1);
        const c = logit1 - s * x1;
        
        // Evaluate at target point
        const targetLogit = s * targetX + c;
        const targetY = 1 / (1 + Math.exp(-targetLogit));
        
        // Clamp to valid probability range
        return Math.max(0.01, Math.min(0.99, targetY));
    }
    

    removeMetalogRow(tableId, index) {
        this.removeTableRow(tableId, index);
    }


    createReviewUI(item, container) {
        const tableData = this.getTableState('metalog-test');
        const dataPoints = tableData.map(point => {
            const timeYears = this.metalogUtils.normalizedToTime(point.x);
            const timeStr = this.metalogUtils.formatTime(timeYears);
            const probStr = (point.y * 100).toFixed(0) + '%';
            return `${timeStr}: ${probStr}`;
        }).join(', ');

        container.innerHTML = `
            <div class="info-card">
                <h3>${item.title}</h3>
                <p>Here's the distribution you created:</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <strong>Your Data Points:</strong><br>
                    ${dataPoints}
                </div>
                
                <p>The chart shows your fitted curve. You can go back to adjust the data if needed, or proceed to finish.</p>
            </div>
        `;
    }

    createFinalUI(item, container) {
        container.innerHTML = `
            <div class="info-card">
                <h3>${item.title}</h3>
                <p>Thank you for completing the distribution builder!</p>
                <p>Your data has been processed and can be copied below for further analysis.</p>
                
                <div style="text-align: center; margin: 20px 0;">
                    <button class="button" onclick="chartRenderer.copyDataToClipboard()">
                        Copy Distribution Data
                    </button>
                </div>
                
                <p style="font-size: 0.9em; color: #666;">
                    The copied data includes your data points, fitted curves, and metadata.
                </p>
            </div>
        `;
    }

}

// Export as global
window.SurveyLogic = SurveyLogic;