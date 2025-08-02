// Main visualization class - focused on D3 rendering and chart management
class AlignmentLandscape {
    constructor() {
        // Chart dimensions and configuration
        this.margin = { top: 40, right: 150, bottom: 100, left: 60 };
        this.width = 1000 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;

        // Initialize utilities
        this.metalogUtils = new MetalogUtils();
        
        // Chart state
        this.approaches = [];
        this.interventions = [];
        this.approachesHeight = SURVEY_CONFIG.approachesHeight;
        this.interventionsHeight = SURVEY_CONFIG.interventionsHeight;
        this.textSize = SURVEY_CONFIG.textSize;

        // Initialize survey logic
        this.surveyLogic = new SurveyLogic(this);

        // Initialize visualization
        this.init();
        this.initializeSurvey();
        this.checkMobileAndShowModal();
        this.setupEventListeners();
    }

    init() {
        this.svg = d3.select("#chart")
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.setupScalesAndAxes();
    }

    setupScalesAndAxes() {
        // Calculate split point
        this.splitY = this.height * this.approachesHeight;

        // X scale (logarithmic time)
        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);

        // Y scales
        this.yScaleApproaches = d3.scaleLinear()
            .domain([0, 1])
            .range([this.splitY, 0]);

        this.yScaleInterventions = d3.scaleLinear()
            .domain([0, 1])
            .range([this.height, this.splitY + 40]);

        // Create axes
        this.createAxes();
    }

    createAxes() {
        // Get time ticks for x-axis
        const timeTicks = this.getLogTimeTicks();
        
        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickFormat((d, i) => timeTicks[i].label);

        const yAxisApproaches = d3.axisLeft(this.yScaleApproaches)
            .ticks(5)
            .tickFormat(d3.format(".0%"));

        // X-axis at the split
        this.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xAxis);

        // Y-axis for approaches only
        this.svg.append("g")
            .attr("class", "axis y-axis-approaches")
            .call(yAxisApproaches);

        // Grid lines
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
            .tickSize(-this.height)
            .tickFormat("");

        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xGrid);

        // Add clipping path to constrain curves to chart area
        this.svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-area")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.splitY);
    }

    getLogTimeTicks() {
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;
        
        return [
            { years: oneMonthInYears, label: "1 month", position: this.metalogUtils.timeToNormalized(oneMonthInYears) },
            { years: 0.25, label: "3 months", position: this.metalogUtils.timeToNormalized(0.25) },
            { years: 1, label: "1 year", position: this.metalogUtils.timeToNormalized(1) },
            { years: 2, label: "2 years", position: this.metalogUtils.timeToNormalized(2) },
            { years: 5, label: "5 years", position: this.metalogUtils.timeToNormalized(5) },
            { years: 10, label: "10 years", position: this.metalogUtils.timeToNormalized(10) },
            { years: 20, label: "20 years", position: this.metalogUtils.timeToNormalized(20) },
            { years: 50, label: "50 years", position: this.metalogUtils.timeToNormalized(50) },
            { years: oneCenturyInYears, label: "1 century", position: this.metalogUtils.timeToNormalized(oneCenturyInYears) }
        ];
    }

    // Drawing methods
    drawMetalogCurve(metalog, name, index) {
        const numPoints = 200;
        const data = [];

        // Find reasonable plotting bounds using binary search
        const dataPoints = metalog.dataPoints;
        const minDataY = dataPoints[0].y;
        const maxDataY = dataPoints[dataPoints.length - 1].y;
        
        // Find y values that give x values just outside [0, 1] range
        const minPlotY = this.findSafePlottingBound(metalog, minDataY, 'min');
        const maxPlotY = this.findSafePlottingBound(metalog, maxDataY, 'max');
        
        console.log(`📊 Plotting metalog from y=${minPlotY.toFixed(4)} to y=${maxPlotY.toFixed(4)}`);
        
        // Sample points within the safe range
        for (let i = 0; i <= numPoints; i++) {
            const cdfProb = minPlotY + (maxPlotY - minPlotY) * (i / numPoints);
            const normalizedTime = this.metalogUtils.evaluateMetalog(metalog, cdfProb);
            
            data.push({ x: normalizedTime, y: cdfProb });
        }
        
        // Debug: dump all the data being plotted
        console.log("📊 All plotting data:", data);

        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(d.y))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "s-curve")
            .attr("d", line)
            .attr("clip-path", "url(#chart-area)")
            .style("stroke", this.getColor(index))
            .on("mouseover", (event, d) => {
                this.showTooltip(event, name);
            })
            .on("mousemove", (event) => {
                this.showCoordinateTooltip(event, metalog);
            })
            .on("mouseout", () => {
                this.hideTooltip();
            });

        this.addCurveLabel(name, index);
    }

    // Binary search to find safe plotting bounds
    findSafePlottingBound(metalog, startY, direction) {
        const targetXRange = direction === 'min' ? -0.2 : 1.2; // Allow some extrapolation beyond [0,1]
        const epsilon = 0.001;
        const maxIterations = 20;
        
        let lowY = direction === 'min' ? 0.001 : startY;
        let highY = direction === 'min' ? startY : 0.999;
        
        console.log(`🔍 Binary search for ${direction} bound, target x=${targetXRange}, startY=${startY.toFixed(4)}`);
        
        for (let i = 0; i < maxIterations; i++) {
            const midY = (lowY + highY) / 2;
            const x = this.metalogUtils.evaluateMetalog(metalog, midY);
            
            console.log(`   Iteration ${i}: y=${midY.toFixed(4)} → x=${x.toFixed(4)} (target: ${targetXRange})`);
            
            if (direction === 'min') {
                if (x < targetXRange) {
                    lowY = midY; // Go higher in y to get larger x
                } else {
                    highY = midY; // Go lower in y to get smaller x
                }
            } else {
                if (x > targetXRange) {
                    highY = midY; // Go lower in y to get smaller x
                } else {
                    lowY = midY; // Go higher in y to get larger x
                }
            }
            
            console.log(`   Updated range: [${lowY.toFixed(4)}, ${highY.toFixed(4)}]`);
            
            if (Math.abs(highY - lowY) < epsilon) break;
        }
        
        const result = (lowY + highY) / 2;
        console.log(`🎯 Binary search result: y=${result.toFixed(4)}`);
        return result;
    }

    drawPiecewiseLinearCurve(linearData, name, index) {
        console.log("📊 Drawing piecewise linear curve with", linearData.length, "points");
        
        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(d.y))
            .curve(d3.curveMonotoneX); // Still use D3's monotonic smoothing for visual appeal
            
        this.svg.append("path")
            .datum(linearData)
            .attr("class", "s-curve")
            .attr("d", line)
            .attr("clip-path", "url(#chart-area)")
            .style("stroke", this.getColor(index))
            .on("mouseover", (event) => {
                this.showTooltip(event, name + " (smooth interpolation fallback)");
            })
            .on("mousemove", (event) => {
                this.showCoordinateTooltip(event, { dataPoints: linearData });
            })
            .on("mouseout", () => {
                this.hideTooltip();
            });

        // Add label
        this.addCurveLabel(name, index);
    }

    drawSCurve(approach, index, showTooltip = true) {
        const data = [];
        for (let i = 0; i <= 100; i++) {
            const x = i / 100;
            const timeInYears = this.metalogUtils.normalizedToTime(x);
            const inflectionTime = this.metalogUtils.normalizedToTime(approach.inflection);
            const y = approach.maxProb / (1 + Math.exp(-approach.steepness * (timeInYears - inflectionTime)));
            data.push({ x, y });
        }

        const line = d3.line()
            .x((d) => this.xScale(d.x))
            .y((d) => this.yScaleApproaches(d.y))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "s-curve")
            .attr("d", line)
            .style("stroke", this.getColor(index));

        if (showTooltip) {
            curve.on("mouseover", (event) => {
                this.showTooltip(event, approach.title);
            }).on("mouseout", () => {
                this.hideTooltip();
            });
        }

        this.addCurveLabel(approach.title, index);
    }

    // Tooltip methods
    showTooltip(event, text) {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.display = "block";
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        
        // Check if this is a fallback tooltip
        if (text.includes("smooth interpolation fallback")) {
            const baseName = text.replace(" (smooth interpolation fallback)", "");
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
        
        // Convert mouse position back to data coordinates
        const normalizedTime = this.xScale.invert(mouseX);
        const probability = this.yScaleApproaches.invert(mouseY);
        
        // Convert to actual time units
        const timeInYears = this.metalogUtils.normalizedToTime(normalizedTime);
        const timeStr = this.metalogUtils.formatTime(timeInYears);
        
        const tooltip = document.getElementById("tooltip");
        tooltip.innerHTML = `
            <strong>Coordinates:</strong><br/>
            Time: ${timeStr} (norm: ${normalizedTime.toFixed(3)})<br/>
            Probability: ${(probability * 100).toFixed(1)}%<br/>
            <em>Hover to see values along curve</em>
        `;
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        tooltip.style.display = "block";
    }

    // Utility methods
    getColor(index) {
        const colors = ["#2A623D", "#8B4513", "#1E90FF", "#FF6347", "#32CD32", "#FF1493", "#FFD700", "#9370DB"];
        return colors[index % colors.length];
    }

    addCurveLabel(text, index) {
        const color = this.getColor(index);
        const x = this.width - 140;
        const y = 20 + index * 20;
        
        this.svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", "0.35em")
            .style("fill", color)
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .text(text);
    }

    // Main update method
    updateVisualization() {
        // Clear existing curves and labels
        this.svg.selectAll(".s-curve").remove();
        this.svg.selectAll("text:not(.axis text)").remove();

        const currentItem = this.surveyLogic.getCurrentItem();

        if (currentItem.type === "example") {
            this.drawExampleVisualization();
        } else if (currentItem.type === "metalogTest") {
            // Metalog curves are drawn by the survey logic when table updates
        } else if (currentItem.type === "approach") {
            this.drawApproachVisualization(currentItem.item);
        }
        // Add more visualization types as needed
    }

    drawExampleVisualization() {
        const exampleApproach = {
            title: "Interpretability",
            maxProb: 0.7,
            steepness: 0.3,
            inflection: this.metalogUtils.timeToNormalized(10)
        };
        
        this.drawSCurve(exampleApproach, 0, false);
    }

    drawApproachVisualization(approach) {
        this.drawSCurve(approach, 0, true);
    }

    // Survey initialization and event handling
    initializeSurvey() {
        this.approaches = SURVEY_CONFIG.predefinedApproaches.map(a => ({ ...a }));
        this.interventions = SURVEY_CONFIG.predefinedInterventions.map(i => ({ ...i }));
    }

    setupEventListeners() {
        document.getElementById("nextStep").addEventListener("click", () => {
            this.surveyLogic.nextStep();
        });

        document.getElementById("prevStep").addEventListener("click", () => {
            this.surveyLogic.prevStep();
        });

        document.getElementById("copyToClipboard").addEventListener("click", () => {
            this.copyDataToClipboard();
        });
    }

    copyDataToClipboard() {
        const data = {
            approaches: this.approaches,
            interventions: this.interventions,
            tableBasedData: this.surveyLogic.tableBasedData,
            timestamp: new Date().toISOString()
        };

        const jsonString = JSON.stringify(data, null, 2);
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(jsonString).then(() => {
                alert("Survey data copied to clipboard!");
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = jsonString;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                alert("Survey data copied to clipboard!");
            } catch (err) {
                console.error('Failed to copy: ', err);
                alert("Failed to copy data. Please copy manually from console.");
                console.log("Survey data:", jsonString);
            }
            
            document.body.removeChild(textArea);
        }
    }

    // Mobile detection and modal
    checkMobileAndShowModal() {
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            document.getElementById("mobile-modal").style.display = "flex";
        }
    }

    dismissMobileModal() {
        document.getElementById("mobile-modal").style.display = "none";
    }
}

// Global variables for onclick handlers
let alignmentLandscape;
let surveyLogic;

window.addEventListener("load", function () {
    alignmentLandscape = new AlignmentLandscape();
    surveyLogic = alignmentLandscape.surveyLogic; // Make available globally for onclick handlers
    
    // Start the survey
    alignmentLandscape.surveyLogic.showCurrentStep();
});