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
        this.margin = { top: 40, right: 200, bottom: 80, left: 60 };
        this.width = 740 - this.margin.left - this.margin.right;
        this.height = 400 - this.margin.top - this.margin.bottom;

        // Chart state
        this.currentAxisMode = 'duration'; // 'timeline' or 'duration'
        this.yAxisTransformed = false;
        this.currentExponent = 1; // 1 = linear, 2.5 = cube root for small probabilities
        
        // Initialize D3 elements
        this.svg = null;
        this.xScale = null;
        this.yScale = null;
        this.splitY = null;
        
        // Validation
        if (typeof d3 === 'undefined') {
            throw new Error('ChartRenderer requires D3.js to be loaded');
        }
        
        this.init();
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
        
        // Create SVG
        this.svg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.setupScales();
        this.createInitialAxes();
    }
    
    /**
     * Set up D3 scales
     */
    setupScales() {
        // Calculate split point for approaches area
        this.splitY = this.height * 0.8; // Could be configurable
        
        // X scale always [0,1] (normalized space)
        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);
        
        // Y scale for approaches area
        this.yScale = d3.scaleLinear()
            .domain([0, 1])
            .range([this.splitY, 0]);
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
            .attr("height", this.splitY);
    }

    // === MAIN RENDERING METHOD ===
    
    /**
     * Render complete chart with provided tables and context
     */
    renderChart(tables, context = {}) {
        console.log('🎨 ChartRenderer.renderChart called with:', Object.keys(tables), context);
        
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
    }
    
    /**
     * Clear all curves and labels (keep axes)
     */
    clearChart() {
        this.svg.selectAll(".s-curve").remove();
        this.svg.selectAll("text:not(.axis text)").remove();
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
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xAxis);
        
        // Create grid lines
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickSize(-this.height)
            .tickFormat("");

        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.splitY})`)
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
        this.addCurveLabel(curveName, index, data);
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
     * Add curve label
     */
    addCurveLabel(text, index, data) {
        const color = this.getColor(index);
        const fontSize = 12;
        
        let x, y;
        
        if (data && data.length > 0) {
            // Position at curve endpoint
            const lastPoint = data[data.length - 1];
            const rightEdgeX = this.xScale(1);
            const baseY = this.yScale(this.transformY(lastPoint.y));
            
            x = rightEdgeX + fontSize * 1.2;
            y = baseY;
            
            // Simple collision avoidance
            const existingLabels = this.svg.selectAll("text:not(.axis text)");
            const minSpacing = fontSize * 1.6;
            
            existingLabels.each(function() {
                const existingY = parseFloat(d3.select(this).attr("y"));
                if (!isNaN(existingY) && Math.abs(y - existingY) < minSpacing) {
                    y = existingY + minSpacing;
                }
            });
            
            y = Math.min(y, this.height - fontSize);
        } else {
            // Fallback positioning
            x = this.width - (fontSize * 8);
            y = fontSize * 2 + (index * fontSize * 1.8);
        }

        this.svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", "0.35em")
            .style("fill", color)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .text(text);
    }

    // === Y-AXIS TRANSFORMATIONS ===
    
    /**
     * Set Y-axis transformation
     */
    setYTransformation(transformType) {
        const newTransformed = transformType !== 'linear';
        
        if (newTransformed !== this.yAxisTransformed) {
            this.yAxisTransformed = newTransformed;
            this.animateYAxisTransformation();
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
    animateYAxisTransformation() {
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

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.currentExponent = endExponent;
                this.updateYAxisWithAnimation();
            }
        };

        requestAnimationFrame(animate);
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