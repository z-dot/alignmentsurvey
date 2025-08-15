/**
 * Survey Coordinator - Main Application Controller  
 * 
 * RESPONSIBILITY: Orchestrates all survey components and manages the UI
 * 
 * CONSTRAINTS:
 * - Owns and coordinates: SurveyState, TableManager, ChartRenderer
 * - Handles ALL user interactions and DOM events
 * - Manages card creation and UI updates
 * - Coordinates data flow: State → Tables → Chart
 * - NEVER directly manipulates data - delegates to appropriate managers
 * 
 * ARCHITECTURE:
 * - SurveyState: "Where are we?" (step tracking)
 * - TableManager: "What data do we have?" (table CRUD)
 * - ChartRenderer: "How do we visualize?" (pure rendering)
 * - SurveyCoordinator: "When do we update what?" (orchestration)
 * 
 * DATA FLOW:
 * User Action → Coordinator → Update State/Tables → Update Chart → Update UI
 * 
 * EVENTS HANDLED:
 * - Navigation button clicks (next/prev)
 * - Table cell edits
 * - Add/remove row buttons
 * - Y-axis toggle button
 * - Mobile modal interactions
 * 
 * EVENTS LISTENED TO:
 * - 'step-changed' from SurveyState
 * - 'table-changed' from TableManager
 * - DOM events from UI elements
 */

class SurveyCoordinator {
    constructor() {
        console.log('🎛️ Initializing SurveyCoordinator');
        
        // Initialize component managers
        this.surveyState = new SurveyState();
        this.tableManager = new TableManager();  
        this.chartRenderer = new ChartRenderer('chart');
        
        // UI state
        this.currentCardsContainer = null;
        
        // Validation
        this.validateDependencies();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize tables from config
        this.initializeDefaultTables();
        
        // Show initial step
        this.showCurrentStep();
        
        // Check for mobile
        this.chartRenderer.checkMobileAndShowModal();
        
        console.log('✅ SurveyCoordinator initialized');
    }

    // === INITIALIZATION ===
    
    /**
     * Validate all dependencies are available
     */
    validateDependencies() {
        const required = [
            'SURVEY_CONFIG', 'SurveyState', 'TableManager', 'ChartRenderer', 'd3'
        ];
        
        for (const dep of required) {
            if (typeof window[dep] === 'undefined' && typeof eval(dep) === 'undefined') {
                throw new Error(`SurveyCoordinator requires ${dep} to be loaded`);
            }
        }
    }
    
    /**
     * Initialize default tables from survey config
     */
    initializeDefaultTables() {
        console.log('📋 Initializing default tables from config');
        
        // Metalog test table
        if (SURVEY_CONFIG.metalogTestCard?.defaultData) {
            this.tableManager.initializeTable('metalog-test', 
                SURVEY_CONFIG.metalogTestCard.defaultData, 
                { mode: 'duration', title: 'Metalog Test' }
            );
        }
        
        // AI Timeline tables
        if (SURVEY_CONFIG.aiTimelinesCard?.tables) {
            for (const tableConfig of SURVEY_CONFIG.aiTimelinesCard.tables) {
                this.tableManager.initializeTable(tableConfig.id,
                    tableConfig.defaultData,
                    { 
                        mode: 'timeline', 
                        title: tableConfig.title,
                        isSurvival: false
                    }
                );
            }
        }
        
        // Doom Assessment tables
        if (SURVEY_CONFIG.doomAssessmentCard?.tables) {
            for (const tableConfig of SURVEY_CONFIG.doomAssessmentCard.tables) {
                this.tableManager.initializeTable(tableConfig.id,
                    tableConfig.defaultData,
                    { 
                        mode: 'duration', 
                        title: tableConfig.title,
                        isSurvival: true
                    }
                );
            }
        }
        
        console.log('📋 Initialized tables:', this.tableManager.getAllTableIds());
    }

    // === EVENT MANAGEMENT ===
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Survey state events
        this.surveyState.addEventListener('step-changed', (e) => {
            this.handleStepChanged(e.detail);
        });
        
        // Table manager events
        this.tableManager.addEventListener('table-changed', (e) => {
            this.handleTableChanged(e.detail);
        });
        
        // Navigation buttons
        const nextBtn = document.getElementById('nextStep');
        const prevBtn = document.getElementById('prevStep');
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
        }
        
        // Y-axis toggle
        const yToggleBtn = document.getElementById('yAxisToggle');
        if (yToggleBtn) {
            yToggleBtn.addEventListener('click', () => this.toggleYAxis());
        }
        
        // Copy to clipboard
        const copyBtn = document.getElementById('copyToClipboard');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyDataToClipboard());
        }
    }

    // === EVENT HANDLERS ===
    
    /**
     * Handle step changes from SurveyState
     */
    handleStepChanged(detail) {
        console.log(`🎯 Step changed to ${detail.newStep}: ${detail.newItem.type}`);
        
        // Update progress display
        this.updateProgressDisplay();
        
        // Show new step content
        this.showCurrentStep();
        
        // Update chart with new context
        this.updateVisualization();
    }
    
    /**
     * Handle table changes from TableManager
     */
    handleTableChanged(detail) {
        console.log(`📊 Table ${detail.tableId} changed`);
        
        // Update chart with new data
        this.updateVisualization();
        
        // Update the specific table display
        this.updateTableDisplay(detail.tableId);
    }

    // === NAVIGATION ===
    
    /**
     * Navigate to next step
     */
    nextStep() {
        return this.surveyState.nextStep();
    }
    
    /**
     * Navigate to previous step  
     */
    prevStep() {
        return this.surveyState.prevStep();
    }
    
    /**
     * Update progress bar and button states
     */
    updateProgressDisplay() {
        const progress = this.surveyState.getProgress();
        
        // Update text
        const currentStepEl = document.getElementById("current-step");
        const totalStepsEl = document.getElementById("total-steps");
        
        if (currentStepEl) currentStepEl.textContent = progress.currentStep + 1;
        if (totalStepsEl) totalStepsEl.textContent = progress.totalSteps;
        
        // Update progress bar
        const progressFill = document.getElementById("progress-fill");
        if (progressFill) {
            progressFill.style.width = progress.progressPercent + "%";
        }
        
        // Update button states
        const prevButton = document.getElementById("prevStep");
        const nextButton = document.getElementById("nextStep");
        const navigationBar = document.querySelector(".navigation-bar");
        
        if (prevButton) prevButton.disabled = progress.currentStep === 0;
        if (nextButton) nextButton.disabled = progress.currentStep === progress.totalSteps - 1;
        
        // Hide navigation on final slide
        if (navigationBar) {
            navigationBar.style.display = this.surveyState.isComplete() ? "none" : "flex";
        }
    }

    // === UI CREATION ===
    
    /**
     * Show content for current step
     */
    showCurrentStep() {
        const currentItem = this.surveyState.getCurrentItem();
        const cardsContainer = document.getElementById("cards-container");
        
        if (!cardsContainer) {
            console.error('Cards container not found');
            return;
        }
        
        this.currentCardsContainer = cardsContainer;
        cardsContainer.innerHTML = ''; // Clear previous cards
        
        console.log(`🎨 Creating UI for step type: ${currentItem.type}`);
        
        switch (currentItem.type) {
            case "intro":
                this.createInfoCards(currentItem.item);
                break;
            case "example":
                this.createExampleCards(currentItem.item);
                break;
            case "metalogTest":
                this.createTableCards(currentItem.item, ['metalog-test']);
                break;
            case "aiTimelines":
                this.createTimelineCards(currentItem.item);
                break;
            case "doomAssessment":
                this.createDoomAssessmentCards(currentItem.item);
                break;
            case "review":
                this.createReviewCards(currentItem.item);
                break;
            case "final":
                this.showSurveyComplete();
                return;
        }
        
        // Ensure cards container is visible
        cardsContainer.style.display = "flex";
        document.getElementById("survey-complete").style.display = "none";
    }
    
    /**
     * Create simple info cards
     */
    createInfoCards(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h4>${item.title}</h4>
            <div>${item.content}</div>
        `;
        this.currentCardsContainer.appendChild(card);
    }
    
    /**
     * Create example cards
     */
    createExampleCards(item) {
        this.createInfoCards(item); // Same as info cards
    }
    
    /**
     * Create cards with tables
     */
    createTableCards(item, tableIds) {
        // Instructions card
        const instructionCard = document.createElement('div');
        instructionCard.className = 'card';
        instructionCard.innerHTML = `
            <h4>${item.title}</h4>
            <div>${item.content || 'Enter time/probability pairs in the table below.'}</div>
        `;
        this.currentCardsContainer.appendChild(instructionCard);
        
        // Create a card for each table
        for (const tableId of tableIds) {
            const tableContext = this.tableManager.getTableContext(tableId);
            const tableCard = document.createElement('div');
            tableCard.className = 'card';
            tableCard.innerHTML = `
                <h4>${tableContext.title || tableId}</h4>
                <div id="table-${tableId}-container"></div>
            `;
            this.currentCardsContainer.appendChild(tableCard);
            
            // Create table structure and populate
            this.createTableStructure(tableId, tableCard.querySelector(`#table-${tableId}-container`));
        }
    }
    
    /**
     * Create timeline cards
     */
    createTimelineCards(item) {
        // Instructions card
        this.createInfoCards(item);
        
        // Get timeline table IDs from config
        const tableIds = item.tables ? item.tables.map(t => t.id) : [];
        
        // Create table cards
        for (const tableId of tableIds) {
            const tableContext = this.tableManager.getTableContext(tableId);
            const tableCard = document.createElement('div');
            tableCard.className = 'card';
            tableCard.innerHTML = `
                <h4>${tableContext.title}</h4>
                <div id="table-${tableId}-container"></div>
            `;
            this.currentCardsContainer.appendChild(tableCard);
            
            this.createTableStructure(tableId, tableCard.querySelector(`#table-${tableId}-container`));
        }
        
        // Comment card if enabled
        if (item.commentBox?.enabled) {
            this.createCommentCard(item.commentBox);
        }
    }
    
    /**
     * Create doom assessment cards
     */
    createDoomAssessmentCards(item) {
        // Instructions card
        this.createInfoCards(item);
        
        // Get doom table IDs from config
        const tableIds = item.tables ? item.tables.map(t => t.id) : [];
        
        // Create table cards
        for (const tableId of tableIds) {
            const tableContext = this.tableManager.getTableContext(tableId);
            const tableCard = document.createElement('div');
            tableCard.className = 'card';
            tableCard.innerHTML = `
                <h4>${tableContext.title}</h4>
                <div id="table-${tableId}-container"></div>
            `;
            this.currentCardsContainer.appendChild(tableCard);
            
            this.createTableStructure(tableId, tableCard.querySelector(`#table-${tableId}-container`));
        }
        
        // Comment card if enabled
        if (item.commentBox?.enabled) {
            this.createCommentCard(item.commentBox);
        }
    }
    
    /**
     * Create review cards
     */
    createReviewCards(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h4>Review Your Responses</h4>
            <p>All your survey responses are displayed in the chart above.</p>
        `;
        this.currentCardsContainer.appendChild(card);
    }
    
    /**
     * Create comment card
     */
    createCommentCard(commentConfig) {
        const commentCard = document.createElement('div');
        commentCard.className = 'card';
        commentCard.innerHTML = `
            <h4>Comments</h4>
            <p class="comment-prompt">${commentConfig.prompt}</p>
            <textarea class="comment-textarea" placeholder="Share your thoughts..." rows="4"></textarea>
        `;
        this.currentCardsContainer.appendChild(commentCard);
    }
    
    /**
     * Show survey complete view
     */
    showSurveyComplete() {
        if (this.currentCardsContainer) {
            this.currentCardsContainer.style.display = "none";
        }
        
        const completeDiv = document.getElementById("survey-complete");
        if (completeDiv) {
            completeDiv.style.display = "block";
        }
    }

    // === TABLE UI MANAGEMENT ===
    
    /**
     * Create HTML table structure for a table ID
     */
    createTableStructure(tableId, container) {
        container.innerHTML = `
            <div class="metalog-table-container">
                <table class="metalog-data-table" id="table-${tableId}">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Probability</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-${tableId}">
                        <!-- Table rows will be populated by updateTableDisplay -->
                    </tbody>
                </table>
                <button class="button" onclick="surveyCoordinator.addRow('${tableId}')">Add Row</button>
                <div class="table-status" id="status-${tableId}" style="font-size: 11px; color: #666; margin-top: 5px;">
                    <!-- Fit status will be displayed here -->
                </div>
            </div>
        `;
        
        // Populate with current data
        this.updateTableDisplay(tableId);
    }
    
    /**
     * Update table DOM display from table manager data
     */
    updateTableDisplay(tableId) {
        const tableData = this.tableManager.getTableState(tableId);
        const tableContext = this.tableManager.getTableContext(tableId);
        const tbody = document.getElementById(`tbody-${tableId}`);
        
        if (!tbody) {
            console.warn(`Table tbody ${tableId} not found`);
            return;
        }
        
        // Clear existing rows
        tbody.innerHTML = "";
        
        // Render rows from state
        tableData.forEach((point, index) => {
            const timeStr = this.tableManager.formatTimeForDisplay(point.x, tableContext);
            const probStr = this.tableManager.formatProbabilityForDisplay(point.y, tableContext);
            
            const row = document.createElement("tr");
            row.dataset.row = index;
            row.innerHTML = `
                <td class="time-cell" contenteditable="true" data-type="time" 
                    onblur="surveyCoordinator.handleCellEdit(this, '${tableId}')">${timeStr}</td>
                <td class="prob-cell" contenteditable="true" data-type="probability" 
                    onblur="surveyCoordinator.handleCellEdit(this, '${tableId}')">${probStr}</td>
                <td><button class="remove-btn" onclick="surveyCoordinator.removeRow('${tableId}', ${index})">×</button></td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // === TABLE INTERACTION HANDLERS ===
    
    /**
     * Handle cell edit completion
     */
    handleCellEdit(cell, tableId) {
        const value = cell.textContent.trim();
        const type = cell.dataset.type;
        const row = cell.closest("tr");
        const rowIndex = parseInt(row.dataset.row);
        
        console.log(`🔧 Cell edit: ${tableId}[${rowIndex}].${type} = "${value}"`);
        
        // Attempt update through table manager
        const success = this.tableManager.updateCell(tableId, rowIndex, type === 'time' ? 'x' : 'y', value);
        
        if (!success) {
            // Revert cell to original value
            const tableData = this.tableManager.getTableState(tableId);
            const tableContext = this.tableManager.getTableContext(tableId);
            
            if (rowIndex >= 0 && rowIndex < tableData.length) {
                if (type === 'time') {
                    cell.textContent = this.tableManager.formatTimeForDisplay(tableData[rowIndex].x, tableContext);
                } else {
                    cell.textContent = this.tableManager.formatProbabilityForDisplay(tableData[rowIndex].y, tableContext);
                }
            }
        }
    }
    
    /**
     * Add row to table
     */
    addRow(tableId) {
        console.log(`➕ Adding row to ${tableId}`);
        this.tableManager.addRow(tableId);
    }
    
    /**
     * Remove row from table
     */
    removeRow(tableId, rowIndex) {
        console.log(`➖ Removing row ${rowIndex} from ${tableId}`);
        this.tableManager.deleteRow(tableId, rowIndex);
    }

    // === CHART MANAGEMENT ===
    
    /**
     * Update chart visualization with current data
     */
    async updateVisualization() {
        const currentItem = this.surveyState.getCurrentItem();
        console.log(`🎨 Updating visualization for ${currentItem.type}`);
        
        // Determine which tables to show based on current step
        const tablesToShow = this.getTablesForCurrentStep(currentItem.type);
        
        // Prepare chart data with fitted curves
        const chartData = {};
        for (const tableId of tablesToShow) {
            const rawData = this.tableManager.getTableState(tableId);
            const tableContext = this.tableManager.getTableContext(tableId);
            
            if (rawData.length >= 2) {
                // Get fitted curve data
                const fittedCurve = await this.tableManager.getFittedCurve(tableId);
                
                if (fittedCurve) {
                    chartData[tableId] = {
                        data: fittedCurve.plotData, // Use fitted curve points
                        context: {
                            ...tableContext,
                            fitStatus: fittedCurve.fitStatus,
                            fitType: fittedCurve.fitType
                        }
                    };
                } else {
                    // Fallback to raw data if fitting fails
                    chartData[tableId] = {
                        data: rawData,
                        context: {
                            ...tableContext,
                            fitStatus: 'No fit available',
                            fitType: 'raw'
                        }
                    };
                }
            }
        }
        
        // Determine axis mode based on step type
        const axisMode = currentItem.type === 'aiTimelines' ? 'timeline' : 'duration';
        
        // Render chart
        this.chartRenderer.renderChart(chartData, { axisMode });
        
        // Update fit status displays in tables
        this.updateFitStatusDisplays(tablesToShow);
    }

    /**
     * Update fit status displays for visible tables
     */
    async updateFitStatusDisplays(tableIds) {
        for (const tableId of tableIds) {
            const statusEl = document.getElementById(`status-${tableId}`);
            if (statusEl) {
                const fittedCurve = await this.tableManager.getFittedCurve(tableId);
                if (fittedCurve) {
                    statusEl.textContent = fittedCurve.fitStatus;
                    statusEl.style.color = fittedCurve.fitType === 'metalog' ? '#666' : '#ff9800';
                } else {
                    statusEl.textContent = 'Fitting curve...';
                    statusEl.style.color = '#999';
                }
            }
        }
    }
    
    /**
     * Get tables to display for current step type
     */
    getTablesForCurrentStep(stepType) {
        const pageMapping = SURVEY_CONFIG.pageTableMapping;
        
        if (!pageMapping[stepType]) {
            return [];
        }
        
        if (pageMapping[stepType] === "all") {
            // Show all tables
            return this.tableManager.getAllTableIds();
        } else {
            // Show specific tables that exist
            return pageMapping[stepType].filter(tableId => 
                this.tableManager.getTableState(tableId).length > 0
            );
        }
    }
    
    /**
     * Toggle Y-axis transformation
     */
    toggleYAxis() {
        this.chartRenderer.setYTransformation(
            this.chartRenderer.yAxisTransformed ? 'linear' : 'cube'
        );
    }

    // === DATA EXPORT ===
    
    /**
     * Copy survey data to clipboard
     */
    async copyDataToClipboard() {
        const allTables = {};
        
        for (const tableId of this.tableManager.getAllTableIds()) {
            allTables[tableId] = {
                data: this.tableManager.getTableState(tableId),
                context: this.tableManager.getTableContext(tableId)
            };
        }
        
        const exportData = {
            surveyProgress: this.surveyState.getProgress(),
            tables: allTables,
            timestamp: new Date().toISOString()
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        
        try {
            await navigator.clipboard.writeText(jsonString);
            this.showCopySuccess();
        } catch (err) {
            console.error('Copy failed:', err);
            this.showCopyFailed();
        }
    }
    
    /**
     * Show copy success feedback
     */
    showCopySuccess() {
        const button = document.getElementById('copyToClipboard');
        if (!button) return;
        
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#2A623D';
        }, 1500);
    }
    
    /**
     * Show copy failed feedback
     */
    showCopyFailed() {
        const button = document.getElementById('copyToClipboard');
        if (!button) return;
        
        const originalText = button.textContent;
        button.textContent = 'Copy Failed';
        button.style.backgroundColor = '#f44336';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#2A623D';
        }, 2000);
    }
}

// Make available globally for onclick handlers
window.SurveyCoordinator = SurveyCoordinator;