/**
 * Table Manager
 * 
 * RESPONSIBILITY: Pure table data management and CRUD operations
 * 
 * CONSTRAINTS:
 * - ONLY handles table state (the tableStates object)
 * - ONLY handles data operations (add/edit/delete rows, parsing, validation)
 * - NO rendering, NO DOM manipulation, NO chart logic
 * - NO survey navigation or step management
 * - Context-aware parsing based on passed-in context (not self-determined)
 * 
 * INTERFACE:
 * - getTableState(tableId): array - Get table data as {x, y} pairs
 * - setTableState(tableId, data): void - Replace entire table
 * - addRow(tableId): boolean - Add new row
 * - deleteRow(tableId, rowIndex): boolean - Remove row
 * - updateCell(tableId, rowIndex, field, value, context): boolean - Update single cell
 * - initializeTable(tableId, defaultData, context): void - Set up new table
 * 
 * DATA FORMAT:
 * - All data stored as normalized [0,1]² space: {x: [0,1], y: [0,1]}
 * - Invariants: unique x-values, sorted by x, monotonic in y (CDF property)
 * - Context determines parsing: 'timeline' vs 'duration' modes
 * 
 * EVENTS:
 * - Emits 'table-changed' when any table data changes
 * - Emits 'table-created' when new table initialized
 * - Emits 'table-deleted' when table removed
 * 
 * CONTEXT MODES:
 * - 'timeline': Parse absolute years (2025, 2030) with linear normalization
 * - 'duration': Parse durations (1 year, 6 months) with log normalization  
 * - 'survival': Special probability handling (decreasing semantics)
 */

class TableManager extends EventTarget {
    constructor() {
        super();
        
        // Core data storage: tableId -> array of {x, y} points
        this.tableStates = {};
        
        // Context information for each table
        this.tableContexts = {}; // tableId -> {mode, isSurvival, etc.}
        
        // Curve fitting cache: tableId -> {distribution, plotData, lastDataHash}
        this.fittedCurveCache = {};
        
        // Distribution module for curve fitting
        this.distributionModule = null;
        this.loadDistributionModule();
        
        // Validation
        if (typeof ConversionUtils === 'undefined') {
            throw new Error('TableManager requires ConversionUtils to be loaded');
        }
        
        this.conversionUtils = new ConversionUtils();
    }

    /**
     * Load distribution module for curve fitting
     */
    async loadDistributionModule() {
        try {
            this.distributionModule = await import('../distributions/distribution.js');
            console.log("✅ Distribution module loaded in TableManager");
        } catch (error) {
            console.error("❌ Failed to load distribution module:", error);
        }
    }

    // === TABLE STATE MANAGEMENT ===
    
    /**
     * Get table data (returns copy to prevent mutation)
     */
    getTableState(tableId) {
        if (!this.tableStates[tableId]) {
            this.tableStates[tableId] = [];
        }
        return [...this.tableStates[tableId]];
    }
    
    /**
     * Set entire table state (validates and sorts)
     */
    setTableState(tableId, newData) {
        // Validate data format
        if (!Array.isArray(newData)) {
            throw new Error('Table data must be an array');
        }
        
        for (const point of newData) {
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                throw new Error('Table points must have numeric x and y properties');
            }
            if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
                throw new Error('Table points must be in [0,1] space');
            }
        }
        
        // Sort by x and ensure uniqueness
        const sortedData = this._ensureInvariants(newData);
        
        // Store
        this.tableStates[tableId] = sortedData;
        
        // Clear fitted curve cache since data changed
        this._clearCurveCache(tableId);
        
        // Emit event
        this.dispatchEvent(new CustomEvent('table-changed', {
            detail: { tableId, data: [...sortedData] }
        }));
    }
    
    /**
     * Initialize table with default data and context
     */
    initializeTable(tableId, defaultData, context = {}) {
        // Store context information
        this.tableContexts[tableId] = {
            mode: context.mode || 'duration', // 'timeline' or 'duration'
            isSurvival: context.isSurvival || false,
            title: context.title || tableId,
            ...context
        };
        
        // Convert default data to normalized format
        const normalizedData = this._normalizeDefaultData(defaultData, context);
        
        // Set state
        this.setTableState(tableId, normalizedData);
        
        // Emit creation event
        this.dispatchEvent(new CustomEvent('table-created', {
            detail: { tableId, context: this.tableContexts[tableId] }
        }));
    }
    
    /**
     * Remove table entirely
     */
    removeTable(tableId) {
        if (!this.tableStates[tableId]) {
            return false;
        }
        
        delete this.tableStates[tableId];
        delete this.tableContexts[tableId];
        
        this.dispatchEvent(new CustomEvent('table-deleted', {
            detail: { tableId }
        }));
        
        return true;
    }
    
    /**
     * Get table context information
     */
    getTableContext(tableId) {
        return this.tableContexts[tableId] || {};
    }
    
    /**
     * Get all table IDs
     */
    getAllTableIds() {
        return Object.keys(this.tableStates);
    }

    // === CURVE FITTING ===

    /**
     * Get fitted curve data for visualization
     * Returns both the curve points and fit metadata
     */
    async getFittedCurve(tableId) {
        if (!this.distributionModule) {
            console.warn('Distribution module not loaded yet');
            return null;
        }

        const tableData = this.getTableState(tableId);
        if (tableData.length < 2) {
            return null;
        }

        // Create hash of current data for caching
        const dataHash = this._hashData(tableData);
        const cached = this.fittedCurveCache[tableId];

        // Return cached result if data hasn't changed
        if (cached && cached.lastDataHash === dataHash) {
            return cached;
        }

        try {
            console.log(`📊 Fitting curve for ${tableId}:`, tableData);

            // Fit distribution using existing function
            const distribution = this.distributionModule.fitDistribution(tableData);
            
            // Get plot data using existing function
            const plotData = this.distributionModule.getPlotData(distribution, 200);
            
            // Transform back for survival functions if needed
            const tableContext = this.getTableContext(tableId);
            let displayPlotData = plotData;
            if (tableContext.isSurvival) {
                displayPlotData = plotData.map(point => ({ 
                    x: point.x, 
                    y: 1 - point.y 
                }));
            }

            // Create result object
            const result = {
                plotData: displayPlotData,
                distribution: distribution,
                fitType: distribution.type, // 'metalog' or 'interpolation'
                fitStatus: this._getFitStatusMessage(distribution),
                lastDataHash: dataHash
            };

            // Cache the result
            this.fittedCurveCache[tableId] = result;

            console.log(`✅ Fitted ${result.fitType} curve for ${tableId}: ${result.fitStatus}`);
            return result;

        } catch (error) {
            console.error(`❌ Failed to fit curve for ${tableId}:`, error);
            return null;
        }
    }

    /**
     * Clear fitted curve cache for a table (called when data changes)
     */
    _clearCurveCache(tableId) {
        delete this.fittedCurveCache[tableId];
    }

    /**
     * Create simple hash of data for caching
     */
    _hashData(data) {
        return JSON.stringify(data.map(p => [Math.round(p.x * 1000), Math.round(p.y * 1000)]));
    }

    /**
     * Get human-readable fit status message
     */
    _getFitStatusMessage(distribution) {
        if (distribution.type === 'metalog') {
            const numTerms = distribution.metalog?.numTerms || distribution.metalog?.k || 'unknown';
            return `Metalog fit (k=${numTerms})`;
        } else if (distribution.type === 'interpolation') {
            return 'Interpolation';
        } else {
            return 'Unknown fit';
        }
    }

    // === ROW OPERATIONS ===
    
    /**
     * Add new row to table
     */
    addRow(tableId) {
        const tableData = this.getTableState(tableId);
        
        // Implementation from invariants.md: add row operation
        let newPoint;
        
        // 1. If no datapoint at x=1, add it
        if (!this._xValueExists(tableData, 1.0)) {
            newPoint = { x: 1.0, y: 1.0 };
        }
        // 2. If no datapoint at x=0, add it  
        else if (!this._xValueExists(tableData, 0.0)) {
            newPoint = { x: 0.0, y: 0.0 };
        }
        // 3. Find midpoint between middle two points
        else {
            const n = tableData.length;
            const i = Math.floor(n / 2);
            const j = i + 1;
            
            if (j >= n) {
                return false; // Can't add more rows
            }
            
            const pointI = tableData[i];
            const pointJ = tableData[j];
            newPoint = {
                x: (pointI.x + pointJ.x) / 2,
                y: (pointI.y + pointJ.y) / 2
            };
        }
        
        // Insert maintaining sort order
        const updatedTable = this._insertRowSorted(tableData, newPoint);
        this.setTableState(tableId, updatedTable);
        
        return true;
    }
    
    /**
     * Delete row from table
     */
    deleteRow(tableId, rowIndex) {
        const tableData = this.getTableState(tableId);
        
        // Don't delete if < 3 datapoints (from invariants.md)
        if (tableData.length < 3) {
            return false;
        }
        
        if (rowIndex < 0 || rowIndex >= tableData.length) {
            return false;
        }
        
        // Remove row
        const updatedTable = [...tableData];
        updatedTable.splice(rowIndex, 1);
        
        this.setTableState(tableId, updatedTable);
        return true;
    }
    
    /**
     * Update single cell value
     */
    updateCell(tableId, rowIndex, field, value, context = null) {
        const tableData = this.getTableState(tableId);
        const tableContext = context || this.getTableContext(tableId);
        
        if (rowIndex < 0 || rowIndex >= tableData.length) {
            return false;
        }
        
        if (field === 'x') {
            return this._updateTimeCell(tableId, rowIndex, value, tableContext);
        } else if (field === 'y') {
            return this._updateProbabilityCell(tableId, rowIndex, value, tableContext);
        }
        
        return false;
    }

    // === CELL UPDATE IMPLEMENTATIONS ===
    
    /**
     * Update time/x-axis cell (implements invariants.md change date operation)
     */
    _updateTimeCell(tableId, rowIndex, newDateStr, context) {
        const tableData = this.getTableState(tableId);
        const oldPoint = tableData[rowIndex];
        const { x: xOld, y: yOld } = oldPoint;
        
        // Parse new date based on context
        let newYears;
        if (context.mode === 'timeline') {
            newYears = this.conversionUtils.parseAbsoluteYear(newDateStr);
        } else {
            newYears = this.conversionUtils.parseDuration(newDateStr);
        }
        
        if (newYears === null) {
            return false; // Parse failed
        }
        
        // Clip to valid range and convert to normalized space
        const clippedYears = this._clipTimeValue(newYears, context);
        const xNew = this._convertToNormalizedX(clippedYears, context);
        
        // Check if new x already exists (excluding current row)
        const tableWithoutCurrent = [...tableData];
        tableWithoutCurrent.splice(rowIndex, 1);
        
        if (this._xValueExists(tableWithoutCurrent, xNew)) {
            return false; // X value collision
        }
        
        // Find surrounding values and constrain Y
        const surrounding = this._findSurroundingValues(tableWithoutCurrent, xNew);
        const { precedingValue, followingValue } = surrounding;
        
        let yNew = yOld;
        const yMin = precedingValue ? precedingValue.y : 0;
        const yMax = followingValue ? followingValue.y : 1;
        
        if (yOld < yMin || yOld > yMax) {
            yNew = (yMin + yMax) / 2;
        }
        
        // Create updated table
        const updatedTable = this._insertRowSorted(tableWithoutCurrent, { x: xNew, y: yNew });
        this.setTableState(tableId, updatedTable);
        
        return true;
    }
    
    /**
     * Update probability/y-axis cell (implements invariants.md change prob operation)
     */
    _updateProbabilityCell(tableId, rowIndex, newProbStr, context) {
        const tableData = this.getTableState(tableId);
        
        // Parse probability
        let newProb = this.conversionUtils.parseProbabilityInput(newProbStr);
        if (newProb === null) {
            return false; // Parse failed
        }
        
        // Transform survival functions before validation/storage
        if (context.isSurvival) {
            newProb = 1 - newProb;  // Convert survival → CDF for storage
        }
        
        // Clip probability to valid range based on neighbors
        const prevY = rowIndex > 0 ? tableData[rowIndex - 1].y : 0;
        const nextY = rowIndex < tableData.length - 1 ? tableData[rowIndex + 1].y : 1;
        const clippedProb = Math.max(prevY, Math.min(nextY, newProb));
        
        // Update table
        const updatedTable = [...tableData];
        updatedTable[rowIndex] = { ...updatedTable[rowIndex], y: clippedProb };
        
        this.setTableState(tableId, updatedTable);
        return true;
    }

    // === HELPER FUNCTIONS ===
    
    /**
     * Convert default data to normalized [0,1]² format
     */
    _normalizeDefaultData(defaultData, context) {
        return defaultData.map(item => {
            let timeYears, normalizedX;
            
            if (context.mode === 'timeline') {
                // Timeline mode: parse absolute years
                timeYears = this.conversionUtils.parseAbsoluteYear(item.time);
                normalizedX = this._yearToNormalized(timeYears);
            } else {
                // Duration mode: parse durations  
                timeYears = this.conversionUtils.parseDuration(item.time);
                normalizedX = this._timeToNormalized(timeYears);
            }
            
            let probabilityValue = this.conversionUtils.parseProbabilityInput(item.probability);
            
            // Transform survival functions: store as CDF (1-survival) for fitting
            if (context.isSurvival) {
                probabilityValue = 1 - probabilityValue;
            }
            
            return {
                x: normalizedX,
                y: probabilityValue
            };
        }).sort((a, b) => a.x - b.x);
    }
    
    /**
     * Ensure data maintains invariants (sorted, unique x-values, monotonic y)
     */
    _ensureInvariants(data) {
        // Sort by x
        const sorted = [...data].sort((a, b) => a.x - b.x);
        
        // Remove duplicates by x (keep first occurrence)
        const unique = [];
        let lastX = -1;
        
        for (const point of sorted) {
            if (point.x !== lastX) {
                unique.push(point);
                lastX = point.x;
            }
        }
        
        // Ensure monotonic y (this is more complex, for now just return sorted unique)
        return unique;
    }
    
    /**
     * Check if x-value already exists
     */
    _xValueExists(tableData, targetX, precision = 0.001) {
        return tableData.some(point => Math.abs(point.x - targetX) < precision);
    }
    
    /**
     * Insert row maintaining sort order
     */
    _insertRowSorted(tableData, newPoint) {
        const result = [...tableData];
        let insertIndex = 0;
        
        while (insertIndex < result.length && result[insertIndex].x < newPoint.x) {
            insertIndex++;
        }
        
        result.splice(insertIndex, 0, newPoint);
        return result;
    }
    
    /**
     * Find values immediately preceding and following target x
     */
    _findSurroundingValues(tableData, targetX) {
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
    
    /**
     * Clip time value to valid range
     */
    _clipTimeValue(years, context) {
        if (context.mode === 'timeline') {
            return Math.max(2025, Math.min(2065, years));
        } else {
            const minTime = 1 / 365.25; // 1 day
            const maxTime = 100; // 1 century
            return Math.max(minTime, Math.min(maxTime, years));
        }
    }
    
    /**
     * Convert time to normalized X coordinate
     */
    _convertToNormalizedX(years, context) {
        if (context.mode === 'timeline') {
            return this._yearToNormalized(years);
        } else {
            return this._timeToNormalized(years);
        }
    }
    
    /**
     * Linear year normalization (2025-2065 → 0-1)
     */
    _yearToNormalized(year) {
        const currentYear = 2025;
        const maxYear = 2065;
        return Math.max(0, Math.min(1, (year - currentYear) / (maxYear - currentYear)));
    }
    
    /**
     * Logarithmic time normalization (uses existing MetalogUtils if available)
     */
    _timeToNormalized(years) {
        // This would need to use the distributions/metalog-core.js functions
        // For now, use a simple log scale as placeholder
        const minLog = Math.log(1 / 365.25); // 1 day
        const maxLog = Math.log(100); // 1 century
        const currentLog = Math.log(years);
        
        return Math.max(0, Math.min(1, (currentLog - minLog) / (maxLog - minLog)));
    }

    // === DISPLAY HELPERS ===
    
    /**
     * Format time value for display based on context
     */
    formatTimeForDisplay(normalizedX, context) {
        if (context.mode === 'timeline') {
            // Convert back to year
            const year = 2025 + normalizedX * (2065 - 2025);
            const quarterRounded = Math.round(year * 4) / 4;
            return quarterRounded.toString();
        } else {
            // Convert back to duration and format
            // This would use distributions/metalog-core.js functions
            // Placeholder implementation
            const years = Math.exp(Math.log(1/365.25) + normalizedX * (Math.log(100) - Math.log(1/365.25)));
            return this.conversionUtils.formatTime(years);
        }
    }
    
    /**
     * Format probability for display based on context
     */
    formatProbabilityForDisplay(normalizedY, context) {
        let displayY = normalizedY;
        
        // Transform back for survival functions
        if (context.isSurvival) {
            displayY = 1 - normalizedY;
        }
        
        return (displayY * 100).toFixed(0) + '%';
    }
}

// Export for module use
window.TableManager = TableManager;