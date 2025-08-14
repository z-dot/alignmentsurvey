// Chart Renderer - Focused on D3 visualization and curve drawing
class ChartRenderer {
    constructor() {
        // Chart configuration
        this.margin = { top: 40, right: 150, bottom: 100, left: 60 };
        this.width = 1000 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;

        // Initialize utilities
        this.metalogUtils = new MetalogUtils();

        // Chart state
        this.approachesHeight = SURVEY_CONFIG.approachesHeight;
        this.yAxisTransformed = false;
        this.currentExponent = 1; // 1 = linear, 3 = cube root for small probabilities

        // Initialize survey logic
        this.surveyLogic = new SurveyLogic(this);

        // Initialize visualization
        this.init();
        this.checkMobileAndShowModal();
        this.setupEventListeners();
    }

    // === INITIALIZATION ===

    init() {
        this.svg = d3.select("#chart")
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr(
                "transform",
                `translate(${this.margin.left},${this.margin.top})`,
            );

        this.setupScalesAndAxes();
    }

    setupScalesAndAxes() {
        // Calculate split point for approaches area
        this.splitY = this.height * this.approachesHeight;

        // Scales
        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);

        this.yScaleApproaches = d3.scaleLinear()
            .domain([0, 1])
            .range([this.splitY, 0]);

        this.createAxes();
    }

    createAxes() {
        // Time ticks for x-axis
        const timeTicks = this.getTimeTicks();

        // Axes
        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
            .tickFormat((d, i) => timeTicks[i].label);

        const yAxisApproaches = d3.axisLeft(this.yScaleApproaches)
            .ticks(5)
            .tickFormat(d3.format(".0%"));

        // Draw axes
        this.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xAxis);

        // Y-axis for approaches - will be managed by animation system
        // Initial setup with linear ticks
        this.updateYAxisWithAnimation();

        // Grid lines
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
            .tickSize(-this.height)
            .tickFormat("");

        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xGrid);

        // Clipping path
        this.svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-area")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.splitY);
    }

    getTimeTicks() {
        const oneDayInYears = 1 / 365.25;
        const oneWeekInYears = 7 / 365.25;
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;

        return [
            {
                years: oneDayInYears,
                label: "1 day",
                position: this.metalogUtils.timeToNormalized(oneDayInYears),
            },
            {
                years: oneWeekInYears,
                label: "1 week",
                position: this.metalogUtils.timeToNormalized(oneWeekInYears),
            },
            {
                years: oneMonthInYears,
                label: "1 month",
                position: this.metalogUtils.timeToNormalized(oneMonthInYears),
            },
            {
                years: 0.25,
                label: "3 months",
                position: this.metalogUtils.timeToNormalized(0.25),
            },
            {
                years: 1,
                label: "1 year",
                position: this.metalogUtils.timeToNormalized(1),
            },
            {
                years: 3,
                label: "3 years",
                position: this.metalogUtils.timeToNormalized(3),
            },
            {
                years: 10,
                label: "10 years",
                position: this.metalogUtils.timeToNormalized(10),
            },
            {
                years: 30,
                label: "30 years",
                position: this.metalogUtils.timeToNormalized(30),
            },
            {
                years: oneCenturyInYears,
                label: "1 century",
                position: this.metalogUtils.timeToNormalized(oneCenturyInYears),
            },
        ];
    }

    // === CURVE DRAWING ===

    drawMetalogCurve(data, name, index) {
        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(this.transformY(d.y)))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "s-curve")
            .attr("d", line)
            .attr("clip-path", "url(#chart-area)")
            .style("stroke", this.getColor(index));

        this.addCurveInteractions(curve, name, { dataPoints: data });
        this.addCurveLabel(name, index, data);
    }

    drawPiecewiseLinearCurve(linearData, name, index) {
        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(this.transformY(d.y)))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(linearData)
            .attr("class", "s-curve")
            .attr("d", line)
            .attr("clip-path", "url(#chart-area)")
            .style("stroke", this.getColor(index));

        this.addCurveInteractions(
            curve,
            name + " (smooth interpolation fallback)",
            { dataPoints: linearData },
        );
        this.addCurveLabel(name, index, linearData);
    }

    drawSCurve(approach, index, showTooltip = true) {
        const data = this.generateSCurveData(approach);

        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(this.transformY(d.y)))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "s-curve")
            .attr("d", line)
            .style("stroke", this.getColor(index));

        if (showTooltip) {
            curve.on(
                "mouseover",
                (event) => this.showTooltip(event, approach.title),
            )
                .on("mouseout", () => this.hideTooltip());
        }

        this.addCurveLabel(approach.title, index, data);
    }

    // === DATA GENERATION ===


    generateSCurveData(approach) {
        const data = [];
        for (let i = 0; i <= 100; i++) {
            const x = i / 100;
            const timeInYears = this.metalogUtils.normalizedToTime(x);
            const inflectionTime = this.metalogUtils.normalizedToTime(
                approach.inflection,
            );
            const y = approach.maxProb /
                (1 +
                    Math.exp(
                        -approach.steepness * (timeInYears - inflectionTime),
                    ));
            data.push({ x, y });
        }
        return data;
    }

    findSafePlottingBound(metalog, startY, direction) {
        const targetXRange = direction === "min" ? -0.2 : 1.2;
        const epsilon = 0.001;
        const maxIterations = 20;

        let lowY = direction === "min" ? 0.001 : startY;
        let highY = direction === "min" ? startY : 0.999;

        for (let i = 0; i < maxIterations; i++) {
            const midY = (lowY + highY) / 2;
            const x = this.metalogUtils.evaluateMetalog(metalog, midY);

            if (direction === "min") {
                if (x < targetXRange) {
                    lowY = midY;
                } else {
                    highY = midY;
                }
            } else {
                if (x > targetXRange) {
                    highY = midY;
                } else {
                    lowY = midY;
                }
            }

            if (Math.abs(highY - lowY) < epsilon) break;
        }

        return (lowY + highY) / 2;
    }

    // === INTERACTIONS ===

    addCurveInteractions(curve, name, metalog) {
        curve.on("mouseover", (event) => this.showTooltip(event, name))
            .on(
                "mousemove",
                (event) => this.showCoordinateTooltip(event, metalog),
            )
            .on("mouseout", () => this.hideTooltip());
    }

    showTooltip(event, text) {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.display = "block";
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";

        if (text.includes("smooth interpolation fallback")) {
            const baseName = text.replace(
                " (smooth interpolation fallback)",
                "",
            );
            tooltip.innerHTML = `
                <div style="font-weight: bold;">${baseName}</div>
                <div style="font-size: 11px; color: #ffa726; margin-top: 3px; padding: 2px 4px; background: rgba(255,167,38,0.1); border-radius: 3px;">
                    ⚠️ Metalog fit failed, using smooth interpolation
                </div>
            `;
        } else {
            tooltip.textContent = text;
        }
    }

    hideTooltip() {
        document.getElementById("tooltip").style.display = "none";
    }

    showCoordinateTooltip(event, metalog) {
        const [mouseX, mouseY] = d3.pointer(event);

        const normalizedTime = this.xScale.invert(mouseX);
        const transformedProb = this.yScaleApproaches.invert(mouseY);
        const probability = this.inverseTransformY(transformedProb);
        const timeInYears = this.metalogUtils.normalizedToTime(normalizedTime);
        const timeStr = this.metalogUtils.formatTime(timeInYears);

        const tooltip = document.getElementById("tooltip");
        tooltip.innerHTML = `
            <strong>Coordinates:</strong><br/>
            Time: ${timeStr}<br/>
            Probability: ${(probability * 100).toFixed(1)}%<br/>
            <em>Hover curve for exact values</em>
        `;
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        tooltip.style.display = "block";
    }

    // === VISUALIZATION MANAGEMENT ===

    updateVisualization() {
        // Clear existing curves and labels
        this.svg.selectAll(".s-curve").remove();
        this.svg.selectAll("text:not(.axis text)").remove();

        const currentItem = this.surveyLogic.getCurrentItem();

        switch (currentItem.type) {
            case "example":
                this.drawExampleVisualization();
                break;
            case "metalogTest":
                // Redraw curve if it exists (needed for Y-axis transformations)
                if (this.surveyLogic.tableBasedData) {
                    if (this.surveyLogic.tableBasedData.type === "metalog" && this.surveyLogic.tableBasedData.metalog) {
                        this.drawMetalogCurve(
                            this.surveyLogic.tableBasedData.metalog,
                            "Table-based Approach",
                            0,
                        );
                    } else if (this.surveyLogic.tableBasedData.type === "linear_interpolation" && this.surveyLogic.tableBasedData.interpolatedData) {
                        this.drawPiecewiseLinearCurve(
                            this.surveyLogic.tableBasedData.interpolatedData,
                            "Table-based Approach", 
                            0,
                        );
                    }
                }
                break;
            case "approach":
                this.drawApproachVisualization(currentItem.item);
                break;
        }
    }

    drawExampleVisualization() {
        const exampleApproach = {
            title: "Interpretability",
            maxProb: 0.7,
            steepness: 0.3,
            inflection: this.metalogUtils.timeToNormalized(10),
        };

        this.drawSCurve(exampleApproach, 0, false);
    }

    drawApproachVisualization(approach) {
        this.drawSCurve(approach, 0, true);
    }

    // === Y-AXIS TRANSFORMATION ===

    toggleYAxisTransformation() {
        this.yAxisTransformed = !this.yAxisTransformed;

        // Update button text
        const button = document.getElementById("yAxisToggle");
        button.textContent = "Switch y-axis";

        // Animate the transformation
        this.animateYAxisTransformation();
    }

    // Transform probability value using current exponent
    transformY(probability) {
        const exponent = this.currentExponent || 1;
        return Math.pow(probability, 1 / exponent);
    }

    // Inverse transform for converting back from display to probability
    inverseTransformY(transformedValue) {
        const exponent = this.currentExponent || 1;
        return Math.pow(transformedValue, exponent);
    }

    animateYAxisTransformation() {
        const duration = 1200; // ms - longer for smoother tick animation
        const startExponent = this.currentExponent || 1;
        const endExponent = this.yAxisTransformed ? 2.5 : 1;

        // Start animation
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing function
            const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            // Interpolate the exponent from 1 to 3 (or vice versa)
            this.currentExponent = startExponent +
                (endExponent - startExponent) * eased;

            // Update everything
            this.updateYAxisWithAnimation();
            // Trigger survey logic visualization update for tables
            if (this.surveyLogic && typeof this.surveyLogic.updateVisualization === 'function') {
                this.surveyLogic.updateVisualization();
            } else {
                this.updateVisualization(); // Fallback for non-table visualizations
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                this.currentExponent = endExponent;
                this.updateYAxisWithAnimation();
                // Trigger final update
                if (this.surveyLogic && typeof this.surveyLogic.updateVisualization === 'function') {
                    this.surveyLogic.updateVisualization();
                } else {
                    this.updateVisualization(); // Fallback for non-table visualizations
                }
            }
        };

        requestAnimationFrame(animate);
    }

    updateYAxisWithAnimation() {
        const isTransformed = this.currentExponent > 1.1;

        // Define tick sets
        const linearTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
        const transformedTicks = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0];

        // Calculate positions and opacity for each tick set
        const progress = (this.currentExponent - 1) / 1.5; // 0 to 1 as exponent goes 1 to 2.5

        // Update or create tick groups
        this.updateTickGroup("linear-ticks", linearTicks, 1 - progress);
        this.updateTickGroup("transformed-ticks", transformedTicks, progress);
    }

    updateTickGroup(className, ticks, opacity) {
        // Remove existing group
        this.svg.selectAll(`.${className}`).remove();

        if (opacity < 0.01) return; // Don't draw if nearly invisible

        const tickGroup = this.svg.append("g")
            .attr("class", `axis ${className}`)
            .style("opacity", opacity);

        ticks.forEach((tickValue) => {
            const transformedValue = this.transformY(tickValue);
            const yPos = this.yScaleApproaches(transformedValue);

            // Tick line
            tickGroup.append("line")
                .attr("x1", -6)
                .attr("x2", 0)
                .attr("y1", yPos)
                .attr("y2", yPos)
                .style("stroke", "#666")
                .style("shape-rendering", "crispEdges");

            // Tick label
            tickGroup.append("text")
                .attr("x", -9)
                .attr("y", yPos)
                .attr("dy", "0.32em")
                .style("text-anchor", "end")
                .style(
                    "font-family",
                    "'et-book', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                )
                .style("font-size", "12px")
                .style("fill", "#666")
                .text(d3.format(".0%")(tickValue));
        });
    }

    // === UTILITIES ===

    getColor(index) {
        const colors = [
            "#2A623D",
            "#8B4513",
            "#1E90FF",
            "#FF6347",
            "#32CD32",
            "#FF1493",
            "#FFD700",
            "#9370DB",
        ];
        return colors[index % colors.length];
    }

    addCurveLabel(text, index, data = null) {
        const color = this.getColor(index);
        const fontSize = 12; // Base font size
        const fontSizeEm = fontSize / 16; // Convert to em for calculations
        
        let x, y;
        
        if (data && data.length > 0) {
            // Position label to the right of the chart area (beyond x=1)
            const lastPoint = data[data.length - 1];
            const rightEdgeX = this.xScale(1); // Right edge of chart (x=1)
            const baseY = this.yScaleApproaches(this.transformY(lastPoint.y));
            
            console.log(`📍 Label "${text}": lastPoint=`, lastPoint, `rightEdgeX=${rightEdgeX}, baseY=${baseY}`);
            
            // Dynamic spacing based on font size
            const horizontalPadding = fontSize * 1.5; // Increase padding to push labels further right
            const estimatedCharWidth = fontSize * 0.6;
            const labelWidth = text.length * estimatedCharWidth;
            
            // Position label to the right of the chart with proper spacing
            x = rightEdgeX + horizontalPadding;
            y = baseY;
            
            console.log(`📍 Initial position for "${text}": x=${x}, y=${y}`);
            
            // Simple collision avoidance - stack labels vertically if they would overlap horizontally
            const existingLabels = this.svg.selectAll("text:not(.axis text)");
            const verticalSpacing = fontSize * 2; // Increased spacing
            let yOffset = 0;
            
            existingLabels.each(function() {
                const existingLabel = d3.select(this);
                const existingY = parseFloat(existingLabel.attr("y"));
                const existingX = parseFloat(existingLabel.attr("x"));
                
                // Check if this label would overlap with existing label
                if (Math.abs(existingX - x) < labelWidth && Math.abs(existingY - (y + yOffset)) < verticalSpacing) {
                    yOffset += verticalSpacing; // Stack below
                }
            });
            
            y = y + yOffset;
            console.log(`📍 Final position for "${text}": x=${x}, y=${y} (yOffset=${yOffset})`);
            
            // Ensure doesn't go off bottom of chart
            if (y > this.height - fontSize) {
                y = this.height - fontSize;
            }
        } else {
            // Fallback to stacked positioning if no data provided
            const verticalSpacing = fontSize * 1.5;
            x = this.width - (fontSize * 10); // ~10em from right edge
            y = (fontSize * 2) + (index * verticalSpacing); // Start at 2em from top
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

    // === EVENT HANDLING ===

    setupEventListeners() {
        document.getElementById("nextStep").addEventListener("click", () => {
            this.surveyLogic.nextStep();
        });

        document.getElementById("prevStep").addEventListener("click", () => {
            this.surveyLogic.prevStep();
        });

        document.getElementById("copyToClipboard").addEventListener(
            "click",
            () => {
                this.copyDataToClipboard();
            },
        );

        document.getElementById("yAxisToggle").addEventListener("click", () => {
            this.toggleYAxisTransformation();
        });
    }

    copyDataToClipboard() {
        const data = {
            tableBasedData: this.surveyLogic.tableBasedData,
            timestamp: new Date().toISOString(),
        };

        const jsonString = JSON.stringify(data, null, 2);
        const button = event.target;
        const originalText = button.textContent;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(jsonString).then(() => {
                this.showCopySuccess(button, originalText);
            }).catch(() => {
                this.fallbackCopy(jsonString, button, originalText);
            });
        } else {
            this.fallbackCopy(jsonString, button, originalText);
        }
    }

    showCopySuccess(button, originalText) {
        button.textContent = "Copied!";
        button.style.backgroundColor = "#4CAF50";
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = "#2A623D";
        }, 1500);
    }

    fallbackCopy(jsonString, button, originalText) {
        const textArea = document.createElement("textarea");
        textArea.value = jsonString;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
            this.showCopySuccess(button, originalText);
        } catch (err) {
            console.error("Failed to copy: ", err);
            button.textContent = "Copy failed - see console";
            button.style.backgroundColor = "#f44336";
            console.log("Survey data:", jsonString);
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = "#2A623D";
            }, 2000);
        }

        document.body.removeChild(textArea);
    }

    // === MOBILE SUPPORT ===

    checkMobileAndShowModal() {
        const isMobile = window.innerWidth <= 768 ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
                .test(navigator.userAgent);

        if (isMobile) {
            document.getElementById("mobile-modal").style.display = "flex";
        }
    }

    dismissMobileModal() {
        document.getElementById("mobile-modal").style.display = "none";
    }
}

// Global variables for onclick handlers
let chartRenderer;
let surveyLogic;

window.addEventListener("load", function () {
    chartRenderer = new ChartRenderer();
    surveyLogic = chartRenderer.surveyLogic; // Make available globally for onclick handlers

    // Start the survey
    chartRenderer.surveyLogic.showCurrentStep();
});
