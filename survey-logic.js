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
        
        // Initialize multi-table states for timeline cards
        this.initializeMultiTableStates();

        // Store table-based metalog/linear data for export
        this.tableBasedData = null;
    }

    // Initialize table states from default data
    initializeTableStates() {
        // Convert metalog test default data to normalized [0,1]² format
        if (SURVEY_CONFIG.metalogTestCard?.defaultData) {
            this.tableStates["metalog-test"] = SURVEY_CONFIG.metalogTestCard
                .defaultData.map((item) => {
                    const timeYears = this.metalogUtils.parseTimeInput(
                        item.time,
                    );
                    const probability = this.metalogUtils.parseProbabilityInput(
                        item.probability,
                    );
                    return {
                        x: this.metalogUtils.timeToNormalized(timeYears),
                        y: probability,
                    };
                }).sort((a, b) => a.x - b.x); // Ensure sorted by x
        } else {
            // Fallback default data
            this.tableStates["metalog-test"] = [
                { x: this.metalogUtils.timeToNormalized(1), y: 0.25 },
                { x: this.metalogUtils.timeToNormalized(10), y: 0.50 },
                { x: this.metalogUtils.timeToNormalized(50), y: 0.75 },
            ];
        }
    }

    // Initialize multi-table states for timeline cards
    initializeMultiTableStates() {
        const timelineCard = SURVEY_CONFIG.aiTimelinesCard;
        if (timelineCard && timelineCard.tables) {
            timelineCard.tables.forEach(tableConfig => {
                const normalizedData = tableConfig.defaultData.map(item => ({
                    x: this.metalogUtils.timeToNormalized(this.metalogUtils.parseTimeInput(item.time)),
                    y: this.metalogUtils.parseProbabilityInput(item.probability)
                }));
                this.tableStates[tableConfig.id] = normalizedData;
            });
            console.log("📊 Initialized multi-table states:", Object.keys(this.tableStates).filter(id => id.includes('timeline')));
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
        // Direct assignment - invariants guaranteed by functional operations
        this.tableStates[tableId] = newData;
        
        // Trigger UI update for this table
        this.renderTable(tableId);
        
        // Update visualization for all tables
        this.updateVisualization();
    }

    // Legacy wrapper for addRow (now calls clean implementation)
    addTableRow(tableId, x, y) {
        // Use the clean functional addRow instead
        this.addRow(tableId);
    }

    // Legacy wrapper for deleteRow (now calls clean implementation)
    removeTableRow(tableId, index) {
        // Use the clean functional deleteRow instead
        this.deleteRow(tableId, index);
    }

    // Legacy function - now handled by clean functional operations

    // =============================================================================
    // PURE UTILITY FUNCTIONS (following invariants.md specification)
    // =============================================================================

    // Parse date string to years, return null if invalid
    parseDate(dateStr) {
        const result = this.metalogUtils.parseTimeInput(dateStr?.toString().trim());
        console.log(`🔍 parseDate("${dateStr}") → ${result} years`);
        return result;
    }

    // Parse probability string, return null if invalid  
    parseProb(probStr) {
        return this.metalogUtils.parseProbabilityInput(probStr?.toString().trim());
    }

    // Clip value to [min, max] range
    clipToRange(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Convert years to unit space [0,1]
    convertYearToUnit(years) {
        const result = this.metalogUtils.timeToNormalized(years);
        console.log(`🔍 convertYearToUnit(${years}) → ${result} [0,1]`);
        return result;
    }

    // Revert cell display to match internal state
    revertCellDisplay(cell, tableId, rowIndex, field) {
        const tableData = this.getTableState(tableId);
        if (rowIndex >= 0 && rowIndex < tableData.length) {
            const point = tableData[rowIndex];
            if (field === 'x') {
                const timeYears = this.metalogUtils.normalizedToTime(point.x);
                cell.textContent = this.metalogUtils.formatTime(timeYears);
            } else if (field === 'y') {
                cell.textContent = (point.y * 100).toFixed(0) + '%';
            }
            cell.dataset.originalValue = cell.textContent;
        }
    }

    // Find values immediately preceding and following target x
    findSurroundingValues(tableData, targetX) {
        let precedingIndex = -1;
        let followingIndex = -1;

        for (let i = 0; i < tableData.length; i++) {
            if (tableData[i].x < targetX) {
                precedingIndex = i;
            } else if (tableData[i].x > targetX && followingIndex === -1) {
                followingIndex = i;
                break;
            }
        }

        return {
            precedingIndex,
            followingIndex,
            precedingValue: precedingIndex >= 0 ? tableData[precedingIndex] : null,
            followingValue: followingIndex >= 0 ? tableData[followingIndex] : null
        };
    }

    // Insert row into table maintaining sort order
    insertRowSorted(tableData, newPoint) {
        const result = [...tableData];
        let insertIndex = 0;
        
        // Find insertion point
        while (insertIndex < result.length && result[insertIndex].x < newPoint.x) {
            insertIndex++;
        }
        
        result.splice(insertIndex, 0, newPoint);
        return result;
    }

    // Check if x-value already exists (accounting for precision)
    xValueExists(tableData, targetX, precision = 0.001) {
        return tableData.some(point => Math.abs(point.x - targetX) < precision);
    }

    // Single function that handles all table updates
    handleTableUpdate(tableId) {
        // Trigger UI update and metalog fitting
        this.renderTable(tableId);
        this.updateVisualization();
    }

    // =============================================================================
    // CORE TABLE OPERATIONS (following invariants.md specification)
    // =============================================================================

    // Change date operation (invariants.md: change date)
    changeDate(tableId, rowIndex, newDateStr, cell) {
        // 1. Store row index and old values
        const tableData = this.getTableState(tableId);
        if (rowIndex < 0 || rowIndex >= tableData.length) return;
        
        const oldPoint = tableData[rowIndex];
        const { x: xOld, y: yOld } = oldPoint;

        // 2. Attempt to parse new date
        console.log(`🔍 changeDate() called with: "${newDateStr}"`);
        const newYears = this.parseDate(newDateStr);
        console.log(`🔍 changeDate() parsed result: ${newYears} years`);
        
        // 3. If parse fails, revert and return
        if (newYears === null) {
            console.log(`🔍 changeDate() parse failed, reverting display`);
            this.revertCellDisplay(cell, tableId, rowIndex, 'x');
            return;
        }

        // 4. Clip new date to valid range  
        const minDate = this.metalogUtils.minTimeYears;
        const maxDate = 100; // 1 century
        const clippedYears = this.clipToRange(newYears, minDate, maxDate);

        // 5. Convert to unit space [0,1]
        const xNew = this.convertYearToUnit(clippedYears);

        // 6. Check if new x already exists
        const tableWithoutCurrent = [...tableData];
        tableWithoutCurrent.splice(rowIndex, 1);
        
        if (this.xValueExists(tableWithoutCurrent, xNew)) {
            this.revertCellDisplay(cell, tableId, rowIndex, 'x');
            return;
        }

        // 7-8. Find surrounding values
        const surrounding = this.findSurroundingValues(tableWithoutCurrent, xNew);
        const { precedingValue, followingValue } = surrounding;

        // 9-10. Check y constraints and interpolate if needed
        let yNew = yOld;
        const yMin = precedingValue ? precedingValue.y : 0;
        const yMax = followingValue ? followingValue.y : 1;
        
        if (yOld < yMin || yOld > yMax) {
            yNew = (yMin + yMax) / 2;
        }

        // 11-12. Create new table with updated point
        const updatedTable = this.insertRowSorted(tableWithoutCurrent, { x: xNew, y: yNew });
        this.tableStates[tableId] = updatedTable;

        // 13. Handle everything else
        this.handleTableUpdate(tableId);
    }

    // Change probability operation (invariants.md: change prob)
    changeProb(tableId, rowIndex, newProbStr, cell) {
        // 1. Attempt to parse probability
        const newProb = this.parseProb(newProbStr);

        // 2. If parse fails, revert and return
        if (newProb === null) {
            this.revertCellDisplay(cell, tableId, rowIndex, 'y');
            return;
        }

        const tableData = this.getTableState(tableId);
        if (rowIndex < 0 || rowIndex >= tableData.length) return;

        // 3. Clip probability to valid range based on neighbors
        const prevY = rowIndex > 0 ? tableData[rowIndex - 1].y : 0;
        const nextY = rowIndex < tableData.length - 1 ? tableData[rowIndex + 1].y : 1;
        const clippedProb = this.clipToRange(newProb, prevY, nextY);

        // 4. Replace state with updated table
        const updatedTable = [...tableData];
        updatedTable[rowIndex] = { ...updatedTable[rowIndex], y: clippedProb };
        this.tableStates[tableId] = updatedTable;

        // 5. Handle everything else
        this.handleTableUpdate(tableId);
    }

    // Delete row operation (invariants.md: delete row) 
    deleteRow(tableId, rowIndex) {
        const tableData = this.getTableState(tableId);

        // 1. If < 3 datapoints, do nothing
        if (tableData.length < 3) return;

        // 2. Update state without deleted row
        const updatedTable = [...tableData];
        updatedTable.splice(rowIndex, 1);
        this.tableStates[tableId] = updatedTable;

        // 3. Handle everything else
        this.handleTableUpdate(tableId);
    }

    // Add row operation (invariants.md: add row)
    addRow(tableId) {
        const tableData = this.getTableState(tableId);

        // 1. If no datapoint at x=1, add it
        if (!this.xValueExists(tableData, 1.0)) {
            const updatedTable = this.insertRowSorted(tableData, { x: 1.0, y: 1.0 });
            this.tableStates[tableId] = updatedTable;
            this.handleTableUpdate(tableId);
            return;
        }

        // 2. If no datapoint at x=0, add it  
        if (!this.xValueExists(tableData, 0.0)) {
            const updatedTable = this.insertRowSorted(tableData, { x: 0.0, y: 0.0 });
            this.tableStates[tableId] = updatedTable;
            this.handleTableUpdate(tableId);
            return;
        }

        // 3. Take middle indices
        const n = tableData.length;
        const i = Math.floor(n / 2);
        const j = i + 1;

        if (j >= n) return; // Safety check

        // 4. Insert midpoint
        const pointI = tableData[i];
        const pointJ = tableData[j];
        const newPoint = {
            x: (pointI.x + pointJ.x) / 2,
            y: (pointI.y + pointJ.y) / 2
        };

        const updatedTable = this.insertRowSorted(tableData, newPoint);
        this.tableStates[tableId] = updatedTable;

        // 5. Handle everything else
        this.handleTableUpdate(tableId);
    }

    // Render table DOM from state
    renderTable(tableId) {
        const tableData = this.getTableState(tableId);
        const tbody = document.getElementById(`tbody-${tableId}`);

        if (!tbody) {
            console.warn(`Table tbody with ID tbody-${tableId} not found in DOM`);
            return;
        }

        // Clear existing rows
        tbody.innerHTML = "";

        // Render rows from state
        tableData.forEach((point, index) => {
            const timeYears = this.metalogUtils.normalizedToTime(point.x);
            const timeStr = this.metalogUtils.formatTime(timeYears);
            const probStr = (point.y * 100).toFixed(0) + "%";

            const row = document.createElement("tr");
            row.dataset.row = index;
            row.id = `row-${tableId}-${index}`;
            row.innerHTML = `
                <td class="time-cell" contenteditable="true" data-type="time" id="time-${tableId}-${index}">${timeStr}</td>
                <td class="prob-cell" contenteditable="true" data-type="probability" id="prob-${tableId}-${index}">${probStr}</td>
                <td><button class="remove-btn" onclick="surveyLogic.removeMetalogRow('${tableId}', ${index})">×</button></td>
            `;

            tbody.appendChild(row);
        });

        // Set up event listeners for all cells and title
        this.setupTableEventListeners(tableId);
        this.setupTitleEventListeners(tableId);
    }

    setupTableEventListeners(tableId) {
        const table = document.getElementById(`table-${tableId}`);
        if (!table) {
            console.warn(`⚠️ Table table-${tableId} not found for event setup`);
            return;
        }

        const cells = table.querySelectorAll('[contenteditable="true"]');
        console.log(`🔧 Setting up event listeners for ${cells.length} cells in table ${tableId}`);
        
        cells.forEach((cell) => {
            // Store initial value
            cell.dataset.originalValue = cell.textContent;

            // Remove any existing event listeners
            cell.removeEventListener("focus", this._focusHandler);
            cell.removeEventListener("blur", this._blurHandler);
            cell.removeEventListener("keydown", this._keydownHandler);

            // Create bound handlers for this specific table
            const focusHandler = (e) => {
                e.target.dataset.originalValue = e.target.textContent;
            };

            const blurHandler = (e) => {
                this.handleCellEdit(e.target, tableId);
            };

            const keydownHandler = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.target.blur();
                }
            };

            // Add event listeners
            cell.addEventListener("focus", focusHandler);
            cell.addEventListener("blur", blurHandler);
            cell.addEventListener("keydown", keydownHandler);
        });
    }

    setupTitleEventListeners(tableId) {
        const titleElement = document.getElementById(`title-${tableId}`);
        if (!titleElement) return;

        // Store initial value
        titleElement.dataset.originalValue = titleElement.textContent;

        const focusHandler = (e) => {
            e.target.dataset.originalValue = e.target.textContent;
        };

        const blurHandler = (e) => {
            // Title changes are saved automatically on blur
            console.log(`📝 Title changed to: ${e.target.textContent}`);
            // Redraw visualization to update chart labels immediately
            this.updateVisualization();
        };

        const keydownHandler = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.target.blur(); // This will trigger the save
            }
            if (e.key === "Escape") {
                e.target.textContent = e.target.dataset.originalValue;
                e.target.blur();
            }
        };

        // Add event listeners
        titleElement.addEventListener("focus", focusHandler);
        titleElement.addEventListener("blur", blurHandler);
        titleElement.addEventListener("keydown", keydownHandler);
    }

    // Survey navigation
    getCurrentItem() {
        switch (this.currentStep) {
            case 0:
                return { type: "intro", item: SURVEY_CONFIG.introCard };
            case 1:
                return { type: "example", item: SURVEY_CONFIG.exampleCard };
            case 2:
                return {
                    type: "metalogTest",
                    item: SURVEY_CONFIG.metalogTestCard,
                };
            case 3:
                return {
                    type: "aiTimelines", 
                    item: SURVEY_CONFIG.aiTimelinesCard,
                };
            case 4:
                return {
                    type: "review",
                    item: { title: "Review Your Distribution" },
                };
            case 5:
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
        document.getElementById("current-step").textContent = this.currentStep +
            1;
        document.getElementById("total-steps").textContent = this.totalSteps;

        const progressPercent = ((this.currentStep + 1) / this.totalSteps) *
            100;
        document.getElementById("progress-fill").style.width = progressPercent +
            "%";

        // Update button states
        const prevButton = document.getElementById("prevStep");
        const nextButton = document.getElementById("nextStep");
        const navigationControls = document.querySelector(
            ".navigation-controls",
        );

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
        document.getElementById("current-item-container").style.display =
            "block";
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
            case "aiTimelines":
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
                ${card.showTable ? this.createMetalogDataTable() : ""}
                ${card.showMultipleTables ? this.createMultiTableContainer(card) : ""}
            </div>
        `;

        // If we have tables, initialize them from state
        if (card.showTable) {
            setTimeout(() => {
                this.initializeTables();
                this.updateVisualization();
            }, 100);
        } else if (card.showMultipleTables) {
            setTimeout(() => {
                this.initializeMultiTables(card);
                this.updateVisualization();
            }, 100);
        }
    }

    createMetalogDataTable() {
        return `
            <div class="metalog-tables-container">
                <h4 style="margin: 0 0 15px 0;">Data Tables</h4>
                <div id="tables-list">
                    <!-- Tables will be dynamically added here -->
                </div>
                <button class="button" onclick="surveyLogic.addNewTable()" style="background-color: #2A623D; padding: 8px 16px; margin-top: 15px;">+ Add Table</button>
            </div>
        `;
    }

    createSingleTable(tableId, tableName = "", canDelete = true) {
        const displayName = tableName || `Table ${tableId.split('-').pop()}`;
        return `
            <div class="metalog-table-container" data-table-container="${tableId}" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fafafa;">
                <div class="table-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer;" onclick="surveyLogic.toggleTableCollapse('${tableId}')">
                    <div style="display: flex; align-items: center;">
                        <span class="collapse-indicator" id="collapse-${tableId}" style="margin-right: 8px; font-weight: bold; color: #666;">▼</span>
                        <h4 contenteditable="true" class="table-title" data-table-id="${tableId}" id="title-${tableId}" style="margin: 0;" onclick="event.stopPropagation()">${displayName}</h4>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${canDelete ? `<button class="remove-btn" onclick="event.stopPropagation(); surveyLogic.removeTable('${tableId}')" style="font-size: 16px; background: none; border: none; color: #f44336; cursor: pointer; padding: 4px;">×</button>` : ''}
                    </div>
                </div>
                <div class="table-content" id="content-${tableId}">
                    <table class="metalog-data-table" data-table-id="${tableId}" id="table-${tableId}">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Probability</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-${tableId}">
                            <!-- Rows will be rendered from state -->
                        </tbody>
                    </table>
                    <button class="button" onclick="surveyLogic.addMetalogRow('${tableId}')" style="font-size: 12px; padding: 4px 8px; margin-top: 8px;">Add Row</button>
                    <div class="table-status" style="font-size: 11px; color: #666; margin-top: 5px;"></div>
                </div>
            </div>
        `;
    }

    createMultiTableContainer(card) {
        return `
            <div class="multi-tables-container">
                <h4 style="margin: 20px 0 15px 0;">Timeline Estimates</h4>
                <div id="multi-tables-list">
                    <!-- Multiple tables will be dynamically added here -->
                </div>
            </div>
        `;
    }

    initializeMultiTables(card) {
        const tablesList = document.getElementById('multi-tables-list');
        if (!tablesList) return;
        
        // Clear existing tables
        tablesList.innerHTML = '';
        
        // Add each configured table
        card.tables.forEach((tableConfig, index) => {
            const tableHTML = this.createSingleTable(tableConfig.id, tableConfig.title, false);
            tablesList.insertAdjacentHTML('beforeend', tableHTML);
            this.renderTable(tableConfig.id);
        });
        
        console.log(`📊 Initialized ${card.tables.length} timeline tables`);
    }

    // Multiple table management
    addNewTable() {
        // Get current slide context to determine which tables are relevant
        const currentItem = this.getCurrentItem();
        let relevantTableIds = [];

        if (currentItem.type === "metalogTest") {
            // Only count tables relevant to this slide
            relevantTableIds = Object.keys(this.tableStates).filter(id => 
                id === "metalog-test" || id.startsWith("table-")
            );
        } else {
            // Default behavior for other slides
            relevantTableIds = Object.keys(this.tableStates);
        }

        const tableCount = relevantTableIds.length;
        const newTableId = `table-${tableCount + 1}`;
        
        // Get the most recently added relevant table's data to copy from
        let sourceData;
        
        if (relevantTableIds.length > 0) {
            // Use the last relevant table's data as template
            const lastTableId = relevantTableIds[relevantTableIds.length - 1];
            const lastTableData = this.getTableState(lastTableId);
            
            // Copy data but multiply probabilities by 0.75 to make it visually lower
            sourceData = lastTableData.map(point => ({
                x: point.x, // Keep same time values
                y: Math.min(point.y * 0.75, 0.99) // Reduce probability by 25%, cap at 99%
            }));
            
            console.log(`📊 Creating new table based on ${lastTableId} with probabilities * 0.75`);
        } else {
            // Fallback to default data if no tables exist
            sourceData = [
                { x: this.metalogUtils.timeToNormalized(1), y: 0.25 },
                { x: this.metalogUtils.timeToNormalized(10), y: 0.5 },
                { x: this.metalogUtils.timeToNormalized(50), y: 0.75 }
            ];
        }
        
        // Initialize new table with copied/modified data
        this.tableStates[newTableId] = sourceData;
        
        // Add table to DOM
        const tablesList = document.getElementById('tables-list');
        if (tablesList) {
            const newTableHTML = this.createSingleTable(newTableId);
            tablesList.insertAdjacentHTML('beforeend', newTableHTML);
            this.renderTable(newTableId);
            this.updateVisualization();
        }
    }

    removeTable(tableId) {
        // Don't remove if it's the only table
        if (Object.keys(this.tableStates).length <= 1) {
            alert("Cannot remove the last remaining table.");
            return;
        }
        
        // Remove from state
        delete this.tableStates[tableId];
        
        // Remove from DOM
        const tableContainer = document.querySelector(`[data-table-container="${tableId}"]`);
        if (tableContainer) {
            tableContainer.remove();
        }
        
        this.updateVisualization();
    }

    toggleTableCollapse(tableId) {
        const content = document.getElementById(`content-${tableId}`);
        const indicator = document.getElementById(`collapse-${tableId}`);
        
        if (!content || !indicator) return;
        
        if (content.style.display === 'none') {
            // Expand
            content.style.display = 'block';
            indicator.textContent = '▼';
        } else {
            // Collapse
            content.style.display = 'none';
            indicator.textContent = '►';
        }
    }

    initializeTables() {
        const tablesList = document.getElementById('tables-list');
        if (!tablesList) return;
        
        // Clear existing tables
        tablesList.innerHTML = '';
        
        // Get current slide context to determine which tables to show
        const currentItem = this.getCurrentItem();
        let relevantTableIds = [];

        if (currentItem.type === "metalogTest") {
            // Only show metalog-test and user-added tables
            relevantTableIds = Object.keys(this.tableStates).filter(id => 
                id === "metalog-test" || id.startsWith("table-")
            );
        } else {
            // Default: show all tables
            relevantTableIds = Object.keys(this.tableStates);
        }
        
        // Add only relevant tables from state
        relevantTableIds.forEach((tableId, index) => {
            const canDelete = relevantTableIds.length > 1;
            const tableName = tableId === 'metalog-test' ? 'Main Table' : `Table ${index + 1}`;
            const tableHTML = this.createSingleTable(tableId, tableName, canDelete);
            tablesList.insertAdjacentHTML('beforeend', tableHTML);
            this.renderTable(tableId);
        });
    }

    // Smart cell editing with state management
    // Clean cell editing using new functional approach
    handleCellEdit(cell, tableId) {
        const value = cell.textContent.trim();
        const type = cell.dataset.type;
        const row = cell.closest("tr");
        const rowIndex = parseInt(row.dataset.row);

        // Store original value to detect actual changes
        const originalValue = cell.dataset.originalValue || "";

        console.log(
            `🔧 Cell edit: "${originalValue}" → "${value}" (${type}, row ${rowIndex})`,
        );

        // Only process if value actually changed
        if (value === originalValue) {
            console.log("⚪ No change detected, skipping");
            return;
        }

        // Route to appropriate clean operation
        if (type === "time") {
            this.changeDate(tableId, rowIndex, value, cell);
        } else if (type === "probability") {
            this.changeProb(tableId, rowIndex, value, cell);
        }
    }

    updateTableStatus(message, isError = false) {
        const statusDiv = document.getElementById("table-status");
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = isError ? "#d32f2f" : "#666";
        }
    }

    updateVisualization() {
        // Clear existing curves
        this.visualizer.svg.selectAll(".s-curve").remove();
        this.visualizer.svg.selectAll("text:not(.axis text)").remove();

        // Get current slide context to determine which tables to render
        const currentItem = this.getCurrentItem();
        let tablesToRender = [];

        if (currentItem.type === "metalogTest") {
            // Only render the metalog test table
            tablesToRender = ["metalog-test"];
        } else if (currentItem.type === "aiTimelines") {
            // Only render the timeline tables
            tablesToRender = Object.keys(this.tableStates).filter(id => id.includes('timeline'));
        } else {
            // Default: render all tables (for review or other contexts)
            tablesToRender = Object.keys(this.tableStates);
        }

        console.log(`📊 Rendering tables for ${currentItem.type}:`, tablesToRender);

        // Render only the relevant tables for this slide
        tablesToRender.forEach((tableId, index) => {
            const tableData = this.getTableState(tableId);
            
            if (tableData.length >= 2) {
                this.renderTableCurve(tableId, tableData, index);
            }
        });
    }

    renderTableCurve(tableId, data, index) {
        // Get table display name
        const titleElement = document.querySelector(`[data-table-id="${tableId}"].table-title`);
        const tableName = titleElement ? titleElement.textContent.trim() : `Table ${index + 1}`;

        try {
            console.log(`📈 Rendering curve for ${tableName}:`, data);

            // Use the new modular distribution system directly
            const distribution = this.metalogUtils.distributionModule.fitDistribution(data);
            
            if (distribution.type === 'metalog') {
                console.log(`✅ ${tableName} - Metalog fitting succeeded`);
                const plotData = this.metalogUtils.distributionModule.getPlotData(distribution, 200);
                this.visualizer.drawMetalogCurve(plotData, tableName, index);
                this.updateTableStatus(tableId, `Metalog fit (k=${distribution.metalog.numTerms})`, false);
            } else if (distribution.type === 'interpolation') {
                console.log(`⚠️ ${tableName} - Using interpolation`);
                this.visualizer.drawPiecewiseLinearCurve(distribution.points, tableName, index);
                this.updateTableStatus(tableId, "Linear interpolation", false);
            }

        } catch (error) {
            console.error(`❌ Error rendering ${tableName}:`, error);
            this.updateTableStatus(tableId, `Error: ${error.message}`, true);
        }
    }

    updateTableStatus(tableId, message, isError = false) {
        const statusDiv = document.querySelector(`[data-table-container="${tableId}"] .table-status`);
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = isError ? "#d32f2f" : "#666";
        }
    }

    updateMetalogFromTable(tableId) {
        const tableData = this.getTableState(tableId);

        // Use data directly in [0,1] space - no conversion needed
        const data = tableData;

        // Log table update with pairs (convert only for display)
        const pairs = data.map((d) =>
            `(${this.metalogUtils.formatTime(this.metalogUtils.normalizedToTime(d.x))}, ${(d.y * 100).toFixed(0)}%)`
        ).join(", ");
        console.log(`📋 Table updated: ${pairs}`);
        console.log(`📋 Raw table data [0,1]² space:`, data);

        // Clear existing curves
        this.visualizer.svg.selectAll(".s-curve").remove();

        if (data.length < 2) {
            console.log(
                "⚠️ Need at least 2 valid data points for metalog fitting",
            );
            this.updateTableStatus("Need at least 2 data points", true);
            return;
        }

        try {
            // Use smart fitting with fallback
            const metalog = this.metalogUtils.fitMetalogSmart(data);

            if (metalog) {
                console.log("✅ Metalog updated from table data");
                console.log("📊 Metalog dataPoints for plotting:", metalog.dataPoints);
                this.visualizer.drawMetalogCurve(metalog, "Table-based Approach", 0);
                this.tableBasedData = {
                    type: "metalog",
                    originalData: data,
                    metalog: metalog,
                };
                this.updateTableStatus(
                    `Metalog fitted with ${data.length} points`,
                );
            } else {
                console.log(
                    "✅ Using piecewise linear fallback for table data",
                );
                const linearData = this.metalogUtils.createPiecewiseLinearData(
                    data,
                );
                console.log("📊 Linear interpolation dataPoints for plotting:", linearData);
                this.visualizer.drawPiecewiseLinearCurve(
                    linearData,
                    "Table-based Approach",
                    0,
                );
                this.tableBasedData = {
                    type: "linear_interpolation",
                    originalData: data,
                    interpolatedData: linearData,
                };
                this.updateTableStatus(
                    `Linear interpolation with ${data.length} points`,
                );
            }
            this.hideMetalogError();
        } catch (error) {
            console.error("❌ Failed to update metalog from table:", error);
            this.updateTableStatus(error.message, true);
        }
    }

    showMetalogError(message) {
        let errorDiv = document.getElementById("metalog-error");
        if (!errorDiv) {
            const container = document.querySelector(
                ".metalog-table-container",
            );
            errorDiv = document.createElement("div");
            errorDiv.id = "metalog-error";
            errorDiv.style.cssText =
                "color: #d32f2f; background: #ffebee; padding: 8px; border-radius: 4px; margin: 10px 0; font-size: 14px;";
            container.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
    }

    hideMetalogError() {
        const errorDiv = document.getElementById("metalog-error");
        if (errorDiv) {
            errorDiv.style.display = "none";
        }
    }

    // UI-facing functions (clean implementations following invariants.md)
    addMetalogRow(tableId) {
        this.addRow(tableId);
    }

    removeMetalogRow(tableId, index) {
        this.deleteRow(tableId, index);
    }

    createReviewUI(item, container) {
        const tableData = this.getTableState("metalog-test");
        const dataPoints = tableData.map((point) => {
            const timeYears = this.metalogUtils.normalizedToTime(point.x);
            const timeStr = this.metalogUtils.formatTime(timeYears);
            const probStr = (point.y * 100).toFixed(0) + "%";
            return `${timeStr}: ${probStr}`;
        }).join(", ");

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
