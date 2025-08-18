/**
 * Chart Renderer - Pure Visualization Component
 * 
 * RESPONSIBILITY: Renders charts based on provided data and context
 * 
 * CONSTRAINTS:
 * - ONLY handles D3 visualization and curve drawing
 * - NO survey state management, NO table data storage
 * - NO event handling for survey navigation
 * - Context (axis mode, transformations) passed in as parameters
 * - All chart updates driven by external calls with explicit data
 * 
 * INTERFACE:
 * - renderChart(tables, context): void - Main rendering method
 * - updateAxes(axisMode): void - Switch between linear/log axes
 * - clearChart(): void - Remove all curves and labels
 * - setTransformation(transformType): void - Y-axis transformations
 * 
 * DATA INPUT FORMAT:
 * - tables: {tableId: {data: [{x, y}], context: {mode, title, isSurvival}}}
 * - context: {axisMode: 'timeline'|'duration', yTransform: 'linear'|'cube'}
 * 
 * AXIS MODES:
 * - 'timeline': Linear years (2025, 2030, 2035...)
 * - 'duration': Logarithmic time (1 day, 1 week, 1 month...)
 * 
 * EVENTS:
 * - None (pure rendering component)
 * - Tooltips and interactions handled internally
 * 
 * DEPENDENCIES:
 * - D3.js for visualization
 * - distributions/ modules for curve fitting (passed in data)
 */

class ChartRenderer {
    constructor(containerId = 'chart') {
        // Chart configuration
        this.containerId = containerId;
        // Balanced margins with space for labels on both sides
        this.margin = { top: 30, right: 150, bottom: 50, left: 80 };
        
        // Make SVG responsive to container size
        const container = document.getElementById(containerId);
        const containerWidth = container ? container.clientWidth : 900;
        const totalWidth = Math.max(containerWidth, 900); // Minimum width for labels
        
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = 350 - this.margin.top - this.margin.bottom;

        // Chart state
        this.currentAxisMode = 'duration'; // 'timeline' or 'duration'
        this.yAxisTransformed = false;
        this.currentExponent = 1; // 1 = linear, 2.5 = cube root for small probabilities
        
        // Initialize D3 elements
        this.svg = null;
        this.xScale = null;
        this.yScale = null;
        // splitY removed - using full chart height
        
        // Store chart data for redrawing on resize
        this.currentChartData = null;
        this.currentContext = null;
        
        // Validation
        if (typeof d3 === 'undefined') {
            throw new Error('ChartRenderer requires D3.js to be loaded');
        }
        
        this.init();
        this.setupResizeHandler();
    }

    // === INITIALIZATION ===
    
    /**
     * Initialize D3 SVG and base elements
     */
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Chart container '${this.containerId}' not found`);
        }
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Create SVG that fills container width
        const totalWidth = this.width + this.margin.left + this.margin.right;
        const totalHeight = this.height + this.margin.top + this.margin.bottom;
        
        this.svg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", totalWidth)
            .attr("height", totalHeight)
            .style("max-width", "100%")
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.setupScales();
        this.createInitialAxes();
    }

    /**
     * Set up window resize handler
     */
    setupResizeHandler() {
        // Debounced resize handler
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250); // 250ms debounce
        };

        window.addEventListener('resize', handleResize);
        
        // Store reference for cleanup if needed
        this.resizeHandler = handleResize;
    }

    /**
     * Handle window resize by redrawing chart
     */
    handleResize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const newContainerWidth = container.clientWidth;
        const currentTotalWidth = this.width + this.margin.left + this.margin.right;
        
        // Only resize if width changed significantly
        if (Math.abs(newContainerWidth - currentTotalWidth) > 50) {
            console.log('📏 Resizing chart due to container width change');
            
            // Update dimensions
            const totalWidth = Math.max(newContainerWidth, 900);
            this.width = totalWidth - this.margin.left - this.margin.right;
            
            // Reinitialize
            this.init();
            
            // Redraw with current data if available
            if (this.currentChartData && this.currentContext) {
                this.renderChart(this.currentChartData, this.currentContext);
            }
        }
    }
    
    /**
     * Set up D3 scales
     */
    setupScales() {
        // Use full height for the main chart area
        this.chartHeight = this.height;
        
        // X scale always [0,1] (normalized space)
        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);
        
        // Y scale for full chart area
        this.yScale = d3.scaleLinear()
            .domain([0, 1])
            .range([this.chartHeight, 0]);
    }
    
    /**
     * Create initial axes (will be updated based on context)
     */
    createInitialAxes() {
        // Start with duration axes as default
        this.updateAxes('duration');
        
        // Create clipping path for chart area
        this.svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-area")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.chartHeight);
    }

    // === MAIN RENDERING METHOD ===
    
    /**
     * Render complete chart with provided tables and context
     */
    renderChart(tables, context = {}) {
        console.log('🎨 ChartRenderer.renderChart called with:', Object.keys(tables), context);
        
        // Store data for potential redraw on resize
        this.currentChartData = tables;
        this.currentContext = context;
        
        // Clear existing content
        this.clearChart();
        
        // Update axes if mode changed
        if (context.axisMode && context.axisMode !== this.currentAxisMode) {
            this.updateAxes(context.axisMode);
        }
        
        // Update Y-axis transformation if needed
        if (context.yTransform !== undefined) {
            this.setYTransformation(context.yTransform);
        }
        
        // Render each table's curve
        let curveIndex = 0;
        for (const [tableId, tableInfo] of Object.entries(tables)) {
            if (tableInfo.data && tableInfo.data.length >= 2) {
                this.renderTableCurve(
                    tableInfo.data,
                    tableInfo.context || {},
                    curveIndex
                );
                curveIndex++;
            }
        }
        
        // After all curves are rendered, optimize label placement
        this.optimizeLabelPlacement();
    }
    
    /**
     * Clear all curves and labels (keep axes)
     */
    clearChart() {
        this.svg.selectAll(".s-curve").remove();
        this.svg.selectAll(".curve-label").remove(); // This handles both text and g elements
        
        // Clear pending labels and positions
        this.pendingLabels = [];
        this.currentLabelPositions = [];
        this.transformedLabelPositions = [];
    }

    // === AXIS MANAGEMENT ===
    
    /**
     * Update axes based on mode
     */
    updateAxes(axisMode) {
        console.log(`🎯 ChartRenderer updating axes to: ${axisMode}`);
        
        this.currentAxisMode = axisMode;
        
        // Remove existing axes
        this.svg.selectAll(".x-axis").remove();
        this.svg.selectAll(".grid").remove();
        
        // Get appropriate ticks
        const timeTicks = this.getTimeTicks(axisMode);
        
        // Create new x-axis
        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickFormat((d, i) => timeTicks[i].label);

        this.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${this.chartHeight})`)
            .call(xAxis);
        
        // Create grid lines
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickSize(-this.height)
            .tickFormat("");

        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.chartHeight})`)
            .call(xGrid);
        
        // Update Y-axis (redraws with current transformation)
        this.updateYAxisWithAnimation();
    }
    
    /**
     * Get tick marks based on axis mode
     */
    getTimeTicks(axisMode) {
        if (axisMode === 'timeline') {
            return this.getLinearYearTicks();
        } else {
            return this.getLogDurationTicks();
        }
    }
    
    /**
     * Linear year ticks for timeline slides (2025-2065)
     */
    getLinearYearTicks() {
        const years = [2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065];
        const currentYear = 2025;
        const maxYear = 2065;
        const yearRange = maxYear - currentYear;
        
        return years.map(year => ({
            years: year - currentYear,
            label: year.toString(),
            position: (year - currentYear) / yearRange // Linear position [0,1]
        }));
    }
    
    /**
     * Logarithmic duration ticks for other slides
     */
    getLogDurationTicks() {
        const oneDayInYears = 1 / 365.25;
        const oneWeekInYears = 7 / 365.25;
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;

        // Use simple log scale for now (would use distributions/metalog-core.js)
        const timeToNormalized = (years) => {
            const minLog = Math.log(oneDayInYears);
            const maxLog = Math.log(oneCenturyInYears);
            const currentLog = Math.log(years);
            return Math.max(0, Math.min(1, (currentLog - minLog) / (maxLog - minLog)));
        };

        return [
            {
                years: oneDayInYears,
                label: "1 day",
                position: timeToNormalized(oneDayInYears),
            },
            {
                years: oneWeekInYears,
                label: "1 week",
                position: timeToNormalized(oneWeekInYears),
            },
            {
                years: oneMonthInYears,
                label: "1 month",
                position: timeToNormalized(oneMonthInYears),
            },
            {
                years: 0.25,
                label: "3 months",
                position: timeToNormalized(0.25),
            },
            {
                years: 1,
                label: "1 year",
                position: timeToNormalized(1),
            },
            {
                years: 3,
                label: "3 years",
                position: timeToNormalized(3),
            },
            {
                years: 10,
                label: "10 years",
                position: timeToNormalized(10),
            },
            {
                years: 30,
                label: "30 years",
                position: timeToNormalized(30),
            },
            {
                years: oneCenturyInYears,
                label: "1 century",
                position: timeToNormalized(oneCenturyInYears),
            },
        ];
    }

    // === CURVE RENDERING ===
    
    /**
     * Render curve for a single table
     */
    renderTableCurve(data, tableContext, index) {
        const curveName = tableContext.title || `Table ${index + 1}`;
        console.log(`📈 Rendering curve for ${curveName}:`, data);
        
        // Create line generator
        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(this.transformY(d.y)))
            .curve(d3.curveMonotoneX);
        
        // Draw curve
        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "s-curve")
            .attr("d", line)
            .attr("clip-path", "url(#chart-area)")
            .style("stroke", this.getColor(index));
        
        // Add interactions
        this.addCurveInteractions(curve, curveName, tableContext);
        
        // Add label
        this.addCurveLabel(curveName, index, data, tableContext);
    }
    
    /**
     * Add mouse interactions to curve
     */
    addCurveInteractions(curve, name, tableContext) {
        curve.on("mouseover", (event) => this.showTooltip(event, name))
            .on("mousemove", (event) => this.showCoordinateTooltip(event, tableContext))
            .on("mouseout", () => this.hideTooltip());
    }
    
    /**
     * Add curve label with sophisticated LP-based placement
     */
    addCurveLabel(text, index, data, tableContext = {}) {
        const color = this.getColor(index);
        const fontSize = 12;
        const labelHeight = fontSize * 1.4; // Including line height
        
        // Calculate desired position at curve endpoint
        let desiredY;
        if (data && data.length > 0) {
            const lastPoint = data[data.length - 1];
            const rawY = this.yScale(this.transformY(lastPoint.y));
            
            // We'll clamp this later using the same bounds passed to PAVA
            desiredY = rawY;
            
            console.log(`🎯 ${text}: lastPoint.y=${lastPoint.y.toFixed(3)}, rawY=${rawY.toFixed(1)}, clampedY=${desiredY.toFixed(1)}`);
            
            // Add small offset for curves that end at exactly the same Y to preserve visual ordering
            if (tableContext.fitType === 'interpolation') {
                desiredY += index * 0.1; // Tiny offset to break ties
            }
        } else {
            desiredY = fontSize * 2 + (index * fontSize * 1.8);
        }
        
        // Store label info for batch LP optimization
        if (!this.pendingLabels) {
            this.pendingLabels = [];
        }
        
        // Calculate actual height considering potential text wrapping
        const availableWidth = this.margin.right - 20; // Same as used in placement
        const actualHeight = this._calculateWrappedTextHeight(text, fontSize, availableWidth);
        
        this.pendingLabels.push({
            text,
            color,
            fontSize,
            desiredY,
            height: actualHeight, // Use actual wrapped height
            weight: 1, // Could be based on importance
            id: `label-${index}`,
            index,
            isSurvival: tableContext.isSurvival || false // Store survival flag
        });
        
        // If this is the last label in the batch, solve placement
        // (We'll trigger this after all curves are added)
    }

    /**
     * Optimize and place all pending labels using LP solver
     */
    optimizeLabelPlacement() {
        if (!this.pendingLabels || this.pendingLabels.length === 0) {
            return;
        }

        const fontSize = 12;
        
        // Bounds for label placement (much tighter spacing)
        // Account for X-axis space at bottom (~30px for axis and labels)
        const xAxisSpace = 30;
        const bounds = {
            top: fontSize * 0.7,
            bottom: this.chartHeight - xAxisSpace - fontSize * 0.7,
            gap: 2 // Fixed 2px gap between labels
        };
        
        // Place all labels on the right side
        const rightEdgeX = this.xScale(1);
        const labelX = rightEdgeX + fontSize * 0.8;
        
        console.log('🏷️ About to place labels:', {
            pendingLabelsLength: this.pendingLabels?.length || 0,
            rightEdgeX: rightEdgeX,
            labelX: labelX,
            bounds: bounds
        });
        
        this._placeLabelsSingleSide(this.pendingLabels, labelX, bounds);
        
        // Pre-calculate transformed positions before clearing pending labels
        this._precalculateTransformedLabelPositions();
        
        // Clear pending labels
        this.pendingLabels = [];
    }


    /**
     * Place labels on one side using LP optimization
     */
    _placeLabelsSingleSide(labels, x, bounds, side = 'right') {
        console.log('🔧 _placeLabelsSingleSide called with:', {
            labelsLength: labels.length,
            x: x,
            bounds: bounds,
            side: side,
            hasPAVA: !!window.LabelPlacementPAVA
        });
        
        if (labels.length === 0) {
            console.log('⚠️ No labels to place');
            return;
        }
        
        // Initialize PAVA solver if available
        if (window.LabelPlacementPAVA) {
            try {
                const solver = new LabelPlacementPAVA();
                
                console.log('🔧 Running PAVA solver with', labels.length, 'labels');
                
                // Step 1: Convert labels to pixel coordinates based on actual curve endpoints
                const pixelLabels = labels.map(label => {
                    // Extract the actual probability from curve data
                    let storedProbability = 0.5; // Default fallback
                    let isSurvival = false;
                    
                    if (label.text && this.currentChartData) {
                        for (const [tableId, tableData] of Object.entries(this.currentChartData)) {
                            if (tableData.context && tableData.context.title === label.text && tableData.data) {
                                const lastPoint = tableData.data[tableData.data.length - 1];
                                if (lastPoint) {
                                    isSurvival = tableData.context.isSurvival || false;
                                    storedProbability = lastPoint.y;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Use stored probability directly for positioning (yScale already handles survival display)
                    const pixelY = this.yScale(storedProbability);
                    
                    console.log(`📊 ${label.text}: stored=${storedProbability.toFixed(3)}, pixelY=${pixelY.toFixed(1)}, survival=${isSurvival}`);
                    
                    return {
                        id: label.id,
                        desiredY: pixelY, // Pixel Y coordinate
                        height: label.height, // Pixel height
                        weight: label.weight || 1,
                        text: label.text,
                        color: label.color,
                        isSurvival: isSurvival
                    };
                });
                
                // Step 2: Set up pixel bounds (chart area)
                const chartTop = this.yScale(1);    // Top of chart (100%)
                const chartBottom = this.yScale(0); // Bottom of chart (0%)
                const pixelBounds = {
                    top: chartTop,
                    bottom: chartBottom,
                    gap: 2 // 2 pixel gap between labels
                };
                
                console.log('🎯 Pixel labels:', pixelLabels);
                console.log('🎯 Pixel bounds:', pixelBounds);
                
                // Step 3: Run PAVA in pixel space
                const pixelSolution = solver.solveLabelPlacement(
                    pixelLabels,
                    pixelBounds,
                    { debug: false }
                );
                
                console.log('📊 PAVA solution (pixels):', pixelSolution);
                
                console.log('🎯 Using PAVA pixel solution!');
                this._placeLabelsSolution(pixelSolution, x, side);
                
            } catch (error) {
                console.error('🚨 PAVA solver error:', error);
                throw error; // Let it crash to see what's wrong
            }
            
        } else {
            // Fallback to simple placement
            console.warn('LP solver not available, using simple placement');
            this._placeLabelsSimple(x, bounds, side);
        }
    }

    /**
     * Place labels using LP solution
     */
    _placeLabelsSolution(solution, x, side = 'right') {
        console.log('🎨 _placeLabelsSolution called with:', {
            solutionLength: solution.length,
            solution: solution,
            x: x,
            side: side
        });
        
        // Create a map for quick lookup
        const positionMap = new Map(solution.map(s => [s.id, s.y]));
        
        // Determine which labels to place (filter by current batch)
        const labelsToPlace = solution.map(s => 
            this.pendingLabels.find(l => l.id === s.id)
        ).filter(Boolean);
        
        console.log('🏷️ Labels to place:', labelsToPlace.length);
        
        for (const label of labelsToPlace) {
            const y = positionMap.get(label.id) || label.desiredY;
            console.log(`📍 Placing ${label.text} at y=${y}`);
            
            // Calculate available width for text
            const availableWidth = this.margin.right - 20; // 20px padding from edge
            
            // Create text element and wrap if necessary
            this._createWrappedLabel({
                text: label.text,
                x: x,
                y: y,
                maxWidth: availableWidth,
                fontSize: label.fontSize,
                color: label.color,
                id: label.id,
                anchor: side === 'left' ? 'end' : 'start'
            });
        }
    }

    /**
     * Calculate the actual height needed for text with wrapping
     */
    _calculateWrappedTextHeight(text, fontSize, maxWidth) {
        // Create a temporary text element to measure width
        const tempText = this.svg.append("text")
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .style("opacity", 0)
            .text(text);
            
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        if (textWidth <= maxWidth) {
            // Single line
            return fontSize * 1.4; // Standard line height
        } else {
            // Multi-line - calculate number of lines needed
            const words = text.split(/\s+/);
            const lineHeight = fontSize * 1.1;
            
            let currentLine = "";
            let lineCount = 1;
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                
                // Test if this line fits
                const testText = this.svg.append("text")
                    .style("font-size", `${fontSize}px`)
                    .style("font-weight", "bold")
                    .style("opacity", 0)
                    .text(testLine);
                    
                const testWidth = testText.node().getBBox().width;
                testText.remove();
                
                if (testWidth <= maxWidth || !currentLine) {
                    currentLine = testLine;
                } else {
                    // Start new line
                    lineCount++;
                    currentLine = word;
                }
            }
            
            return lineCount * lineHeight;
        }
    }

    /**
     * Create a text label with automatic wrapping
     */
    _createWrappedLabel(options) {
        const {text, x, y, maxWidth, fontSize, color, id, anchor} = options;
        
        // Create a temporary text element to measure width
        const tempText = this.svg.append("text")
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .style("opacity", 0)
            .text(text);
            
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        if (textWidth <= maxWidth) {
            // Single line - no wrapping needed
            this.svg.append("text")
                .attr("class", "curve-label")
                .attr("data-label-id", id)
                .attr("x", x)
                .attr("y", y)
                .attr("dy", "0.35em")
                .style("fill", color)
                .style("font-size", `${fontSize}px`)
                .style("font-weight", "bold")
                .style("text-anchor", anchor)
                .text(text);
        } else {
            // Multi-line - wrap text
            const words = text.split(/\s+/);
            const lineHeight = fontSize * 1.1;
            
            const textGroup = this.svg.append("g")
                .attr("class", "curve-label")
                .attr("data-label-id", id);
                
            let currentLine = "";
            let lineNumber = 0;
            const lines = [];
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                
                // Test if this line fits
                const testText = this.svg.append("text")
                    .style("font-size", `${fontSize}px`)
                    .style("font-weight", "bold")
                    .style("opacity", 0)
                    .text(testLine);
                    
                const testWidth = testText.node().getBBox().width;
                testText.remove();
                
                if (testWidth <= maxWidth || !currentLine) {
                    currentLine = testLine;
                } else {
                    // Start new line
                    lines.push(currentLine);
                    currentLine = word;
                    lineNumber++;
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
            
            // Center the text block vertically
            const totalHeight = lines.length * lineHeight;
            const startY = y - (totalHeight / 2) + (fontSize / 2);
            
            // Create text elements for each line
            lines.forEach((line, i) => {
                textGroup.append("text")
                    .attr("x", x)
                    .attr("y", startY + (i * lineHeight))
                    .attr("dy", "0.35em")
                    .style("fill", color)
                    .style("font-size", `${fontSize}px`)
                    .style("font-weight", "bold")
                    .style("text-anchor", anchor)
                    .text(line);
            });
        }
    }

    /**
     * Fallback simple label placement
     */
    _placeLabelsSimple(x, bounds, side = 'right') {
        // Sort by desired Y position
        const sortedLabels = [...this.pendingLabels].sort((a, b) => a.desiredY - b.desiredY);
        
        let currentY = bounds.top + sortedLabels[0]?.height / 2 || bounds.top;
        const availableWidth = this.margin.right - 20; // 20px padding from edge
        
        for (const label of sortedLabels) {
            // Ensure we don't go below bounds
            currentY = Math.max(currentY, bounds.top + label.height / 2);
            currentY = Math.min(currentY, bounds.bottom - label.height / 2);
            
            // Create wrapped label
            this._createWrappedLabel({
                text: label.text,
                x: x,
                y: currentY,
                maxWidth: availableWidth,
                fontSize: label.fontSize,
                color: label.color,
                id: label.id,
                anchor: side === 'left' ? 'end' : 'start'
            });
                
            // Move to next position using actual label height
            currentY += label.height + bounds.gap;
        }
    }

    /**
     * Animate labels to new positions (for Y-axis transformations)
     */
    animateLabelsToNewPositions() {
        if (!this.currentLabelPositions || !window.LabelPlacementPAVA) {
            return;
        }
        
        // Recalculate desired positions with current transformation
        const updatedLabels = this.pendingLabels ? [...this.pendingLabels] : [];
        if (updatedLabels.length === 0) {
            // Reconstruct from DOM if needed
            this.svg.selectAll(".curve-label").each((d, i, nodes) => {
                const element = d3.select(nodes[i]);
                const labelId = element.attr("data-label-id");
                const currentY = parseFloat(element.attr("y"));
                
                // Find corresponding curve data to recalculate desired position
                // For now, use current position as desired
                updatedLabels.push({
                    id: labelId,
                    desiredY: currentY,
                    height: 12 * 1.4,
                    weight: 1
                });
            });
        }
        
        if (updatedLabels.length === 0) return;
        
        const bounds = {
            top: 6,
            bottom: this.chartHeight - 30 - 6, // Account for X-axis space
            gap: 3 // Tighter gap
        };
        
        const solver = new LabelPlacementPAVA();
        const newSolution = solver.solveLabelPlacement(updatedLabels, bounds, {
            debug: false
        });
        
        const newPositions = newSolution.map(s => ({id: s.id, y: s.y}));
        
        // Animate transition
        solver.animateToNewPositions(this.currentLabelPositions, newPositions, 400)
            .then(() => {
                this.currentLabelPositions = newPositions;
            });
    }

    // === Y-AXIS TRANSFORMATIONS ===
    
    /**
     * Set Y-axis transformation
     */
    setYTransformation(transformType, onTransformCallback = null) {
        const newTransformed = transformType !== 'linear';
        
        if (newTransformed !== this.yAxisTransformed) {
            this.yAxisTransformed = newTransformed;
            this.animateYAxisTransformation(onTransformCallback);
        }
    }
    
    /**
     * Transform Y value based on current exponent
     */
    transformY(probability) {
        return Math.pow(probability, 1 / this.currentExponent);
    }
    
    /**
     * Animate Y-axis transformation
     */
    animateYAxisTransformation(onTransformCallback = null) {
        const duration = 1200;
        const startExponent = this.currentExponent;
        const endExponent = this.yAxisTransformed ? 2.5 : 1;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            this.currentExponent = startExponent + (endExponent - startExponent) * eased;
            this.updateYAxisWithAnimation();
            
            // Update existing curves in place with new transformation
            this._updateCurveTransformations();
            
            // Update label positions to match new curve positions
            this._updateLabelPositionsForTransformation();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.currentExponent = endExponent;
                this.updateYAxisWithAnimation();
                
                // Final update of curve transformations
                this._updateCurveTransformations();
                
                // Final update of label positions
                this._updateLabelPositionsForTransformation();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Update existing curve transformations in place (no redraw)
     */
    _updateCurveTransformations() {
        // Update all existing curves with current transformation
        this.svg.selectAll(".s-curve").each((d, i, nodes) => {
            const curve = d3.select(nodes[i]);
            const originalData = curve.datum();
            
            if (originalData && Array.isArray(originalData)) {
                // Create line generator with current transformation
                const line = d3.line()
                    .x(d => this.xScale(d.x))
                    .y(d => this.yScale(this.transformY(d.y)))
                    .curve(d3.curveMonotoneX);
                
                // Update the path with new transformation
                curve.attr("d", line);
            }
        });
    }

    /**
     * Pre-calculate label positions for transformed Y-axis
     */
    _precalculateTransformedLabelPositions() {
        if (!this.pendingLabels || this.pendingLabels.length === 0) {
            return;
        }

        // Calculate desired positions with cube root transformation
        // We need to recalculate based on the current stored chart data
        const transformedLabels = [];
        
        for (const label of this.pendingLabels) {
            const labelIndex = parseInt(label.id.replace('label-', ''));
            
            // Find the corresponding table data from stored chart data
            if (this.currentChartData) {
                const tableEntries = Object.entries(this.currentChartData);
                if (labelIndex < tableEntries.length) {
                    const [tableId, tableInfo] = tableEntries[labelIndex];
                    
                    if (tableInfo.data && tableInfo.data.length > 0) {
                        const lastPoint = tableInfo.data[tableInfo.data.length - 1];
                        // Use cube root transformation (exponent 2.5)
                        const transformedY = Math.pow(lastPoint.y, 1 / 2.5);
                        const desiredY = this.yScale(transformedY);
                        
                        transformedLabels.push({
                            ...label,
                            desiredY: desiredY,
                            isSurvival: label.isSurvival // Preserve survival flag
                        });
                        continue;
                    }
                }
            }
            
            // Fallback to original if data not found
            transformedLabels.push(label);
        }

        // Run LP solver for transformed positions
        const bounds = {
            top: 12 * 0.7,
            bottom: this.chartHeight - 30 - 12 * 0.7,
            gap: 2
        };

        if (window.LabelPlacementPAVA) {
            const solver = new LabelPlacementPAVA();
            const transformedSolution = solver.solveLabelPlacement(
                transformedLabels, 
                bounds, 
                { 
                    debug: false
                }
            );
            
            // Store transformed positions
            this.transformedLabelPositions = transformedSolution.map(s => ({
                id: s.id, 
                y: s.y
            }));
            
            console.log('🔄 Pre-calculated transformed label positions:', this.transformedLabelPositions.length);
            console.log('📍 Normal positions:', this.currentLabelPositions);
            console.log('📍 Transformed positions:', this.transformedLabelPositions);
        }
    }

    /**
     * Update label positions during Y-axis transformations
     */
    _updateLabelPositionsForTransformation() {
        console.log('🔄 _updateLabelPositionsForTransformation called');
        
        console.log('📊 Current positions:', this.currentLabelPositions?.length);
        console.log('📊 Transformed positions:', this.transformedLabelPositions?.length);
        console.log('📊 Y-axis transformed:', this.yAxisTransformed);
        
        if (!this.currentLabelPositions || !this.transformedLabelPositions || 
            this.currentLabelPositions.length === 0 || this.transformedLabelPositions.length === 0) {
            console.log('❌ Missing label positions, skipping animation');
            return;
        }

        // Determine which set of positions to interpolate toward
        const targetPositions = this.yAxisTransformed ? this.transformedLabelPositions : this.currentLabelPositions;
        const targetMap = new Map(targetPositions.map(p => [p.id, p.y]));

        // Smoothly animate labels toward their target positions
        this.svg.selectAll(".curve-label").each((d, i, nodes) => {
            const element = d3.select(nodes[i]);
            const labelId = element.attr("data-label-id");
            const targetY = targetMap.get(labelId);
            
            if (targetY !== undefined) {
                if (element.node().tagName === 'text') {
                    // Single text element
                    const currentY = parseFloat(element.attr("y"));
                    const newY = currentY + (targetY - currentY) * 0.15; // Smooth interpolation
                    element.attr("y", newY);
                } else if (element.node().tagName === 'g') {
                    // Group of text elements - move the whole group
                    const texts = element.selectAll("text");
                    if (texts.size() > 0) {
                        const firstText = d3.select(texts.nodes()[0]);
                        const currentY = parseFloat(firstText.attr("y"));
                        const newY = currentY + (targetY - currentY) * 0.15;
                        const offset = newY - currentY;
                        
                        texts.attr("y", function() {
                            const currentYValue = parseFloat(d3.select(this).attr("y"));
                            return currentYValue + offset;
                        });
                    }
                }
            }
        });
    }
    
    /**
     * Update Y-axis with current transformation
     */
    updateYAxisWithAnimation() {
        const isTransformed = this.currentExponent > 1.1;
        const linearTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
        const transformedTicks = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0];
        const progress = (this.currentExponent - 1) / 1.5;

        this.updateTickGroup("linear-ticks", linearTicks, 1 - progress);
        this.updateTickGroup("transformed-ticks", transformedTicks, progress);
    }
    
    /**
     * Update or create tick group
     */
    updateTickGroup(className, ticks, opacity) {
        this.svg.selectAll(`.${className}`).remove();
        
        if (opacity < 0.01) return;

        const tickGroup = this.svg.append("g")
            .attr("class", `axis ${className}`)
            .style("opacity", opacity);

        ticks.forEach(tickValue => {
            const transformedValue = this.transformY(tickValue);
            const yPos = this.yScale(transformedValue);

            tickGroup.append("line")
                .attr("x1", -6)
                .attr("x2", 0)
                .attr("y1", yPos)
                .attr("y2", yPos)
                .style("stroke", "#666");

            tickGroup.append("text")
                .attr("x", -9)
                .attr("y", yPos)
                .attr("dy", "0.32em")
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .style("fill", "#666")
                .text(d3.format(".0%")(tickValue));
        });
    }

    // === TOOLTIP SYSTEM ===
    
    /**
     * Show basic tooltip
     */
    showTooltip(event, text) {
        const tooltip = document.getElementById("tooltip");
        if (!tooltip) return;
        
        tooltip.style.display = "block";
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        tooltip.textContent = text;
    }
    
    /**
     * Show coordinate tooltip with context awareness
     */
    showCoordinateTooltip(event, tableContext) {
        const tooltip = document.getElementById("tooltip");
        if (!tooltip) return;
        
        const [mouseX, mouseY] = d3.pointer(event);
        const normalizedTime = this.xScale.invert(mouseX);
        const transformedProb = this.yScale.invert(mouseY);
        let probability = Math.pow(transformedProb, this.currentExponent);
        
        // Format time based on current axis mode
        let timeStr;
        if (this.currentAxisMode === 'timeline') {
            const year = 2025 + normalizedTime * (2065 - 2025);
            const quarterRounded = Math.round(year * 4) / 4;
            timeStr = quarterRounded.toString();
        } else {
            // Convert back from normalized to duration (placeholder)
            const years = Math.exp(Math.log(1/365.25) + normalizedTime * (Math.log(100) - Math.log(1/365.25)));
            timeStr = this._formatDuration(years);
        }
        
        // Handle survival functions
        if (tableContext.isSurvival) {
            probability = 1 - probability;
        }
        
        const tableName = tableContext.title || "Chart";
        const probabilityLabel = tableContext.isSurvival ? 
            (tableContext.tableId?.includes('doom') ? 'P(doom)' : 'P(misalignment)') : 
            'Probability';

        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${tableName}</div>
            <div>Time: <strong>${timeStr}</strong></div>
            <div>${probabilityLabel}: <strong>${(probability * 100).toFixed(1)}%</strong></div>
        `;
        
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        tooltip.style.display = "block";
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById("tooltip");
        if (tooltip) {
            tooltip.style.display = "none";
        }
    }

    // === UTILITIES ===
    
    /**
     * Get color for curve by index
     */
    getColor(index) {
        const colors = [
            "#2A623D", "#8B4513", "#1E90FF", "#FF6347",
            "#32CD32", "#FF1493", "#FFD700", "#9370DB"
        ];
        return colors[index % colors.length];
    }
    
    /**
     * Format duration for display (placeholder)
     */
    _formatDuration(years) {
        if (years < 1/365) return "< 1 day";
        if (years < 1/12) return `${Math.round(years * 365)} days`;
        if (years < 1) return `${Math.round(years * 12)} months`;
        if (years < 2) return "1 year";
        if (years < 100) return `${Math.round(years)} years`;
        return `${Math.round(years/100)} centuries`;
    }
    
    /**
     * Check for mobile and show modal if needed
     */
    checkMobileAndShowModal() {
        const isMobile = window.innerWidth <= 768 ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            const modal = document.getElementById("mobile-modal");
            if (modal) {
                modal.style.display = "flex";
            }
        }
    }
    
    /**
     * Dismiss mobile modal
     */
    dismissMobileModal() {
        const modal = document.getElementById("mobile-modal");
        if (modal) {
            modal.style.display = "none";
        }
    }
}

// Export for module use
window.ChartRenderer = ChartRenderer;