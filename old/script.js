class CDFBuilder {
    constructor() {
        this.margin = {top: 20, right: 30, bottom: 60, left: 60};
        this.width = 800 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        
        this.distributions = [];
        this.nextDistributionId = 1;
        this.useSmooth = true;
        this.maxProbability = 1.0;
        
        this.init();
        this.setupEventListeners();
        this.addDistribution(); // Start with one distribution
    }
    
    init() {
        this.svg = d3.select("#chart")
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
        
        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);
        
        this.yScale = d3.scaleLinear()
            .domain([0, 1])
            .range([this.height, 0]);
        
        this.setupAxes();
        this.setupGrid();
        this.updateChart();
    }
    
    setupAxes() {
        const timeTicks = this.getLogTimeTicks();
        
        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickFormat((d, i) => timeTicks[i].label);
        
        const yAxis = d3.axisLeft(this.yScale)
            .ticks(10)
            .tickFormat(d3.format(".0%"));
        
        this.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${this.height})`)
            .call(xAxis);
        
        this.svg.append("g")
            .attr("class", "axis y-axis")
            .call(yAxis);
        
        this.svg.append("text")
            .attr("class", "x-label")
            .attr("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 40)
            .text("Time");
        
        this.svg.append("text")
            .attr("class", "y-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("x", -this.height / 2)
            .text("Cumulative Probability");
    }
    
    setupGrid() {
        const timeTicks = this.getLogTimeTicks();
        
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map(d => d.position))
            .tickSize(-this.height)
            .tickFormat("");
        
        const yGrid = d3.axisLeft(this.yScale)
            .ticks(10)
            .tickSize(-this.width)
            .tickFormat("");
        
        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.height})`)
            .call(xGrid);
        
        this.svg.append("g")
            .attr("class", "grid")
            .call(yGrid);
    }
    
    addDistribution() {
        const id = this.nextDistributionId++;
        const distribution = {
            id: id,
            weight: this.distributions.length === 0 ? 1.0 : 0.0, // First distribution gets full weight
            median: 0.5,
            earlySpread: 0.6,  // 0.6 means 25th percentile is 60% of the way from 0 to median
            lateSpread: 0.6    // 0.6 means 75th percentile is 60% of the way from median to 1
        };
        
        this.distributions.push(distribution);
        this.refreshAllDistributionUI();
        this.updateChart();
    }
    
    removeDistribution(id) {
        if (this.distributions.length <= 1) return; // Prevent removing the last distribution
        this.distributions = this.distributions.filter(d => d.id !== id);
        this.refreshAllDistributionUI();
        this.updateChart();
    }
    
    refreshAllDistributionUI() {
        const container = document.getElementById('distributions-container');
        container.innerHTML = '';
        
        this.distributions.forEach(distribution => {
            this.createDistributionUI(distribution);
        });
        
        this.updateWeightLabels();
    }
    
    createDistributionUI(distribution) {
        const container = document.getElementById('distributions-container');
        
        const distDiv = document.createElement('div');
        distDiv.className = 'distribution';
        distDiv.id = `distribution-${distribution.id}`;
        
        const showWeight = this.distributions.length > 1;
        
        distDiv.innerHTML = `
            <div class="distribution-header">
                <span class="distribution-title"></span>
                <div class="header-controls">
                    ${showWeight ? `
                        <div class="weight-control">
                            <label>Weight:</label>
                            <input type="range" id="weight-${distribution.id}" min="0" max="1" step="0.01" value="${distribution.weight}">
                            <span id="weight-value-${distribution.id}"></span>
                        </div>
                    ` : ''}
                    <button class="remove-btn" onclick="cdfBuilder.removeDistribution(${distribution.id})" ${this.distributions.length <= 1 ? 'style="display: none;"' : ''}>Remove</button>
                </div>
            </div>
            
            <div class="slider-row">
                <div class="slider-group">
                    <label>Early spread</label>
                    <input type="range" id="early-${distribution.id}" min="0" max="1" step="0.01" value="${distribution.earlySpread}">
                </div>
                <div class="slider-group">
                    <label>Median</label>
                    <input type="range" id="median-${distribution.id}" min="0" max="1" step="0.01" value="${distribution.median}">
                </div>
                <div class="slider-group">
                    <label>Late spread</label>
                    <input type="range" id="late-${distribution.id}" min="0" max="1" step="0.01" value="${distribution.lateSpread}">
                </div>
            </div>
        `;
        
        container.appendChild(distDiv);
        this.setupDistributionEventListeners(distribution);
        this.updateWeightLabels();
    }
    
    setupDistributionEventListeners(distribution) {
        const id = distribution.id;
        
        const weightSlider = document.getElementById(`weight-${id}`);
        if (weightSlider) {
            weightSlider.addEventListener('input', (e) => {
                distribution.weight = parseFloat(e.target.value);
                this.updateWeightLabels();
                this.updateChart();
            });
        }
        
        document.getElementById(`median-${id}`).addEventListener('input', (e) => {
            const minGap = 0.02;
            distribution.median = Math.max(minGap, Math.min(parseFloat(e.target.value), 1.0 - minGap));
            e.target.value = distribution.median;
            this.updateChart();
        });
        
        document.getElementById(`early-${id}`).addEventListener('input', (e) => {
            distribution.earlySpread = parseFloat(e.target.value);
            this.updateChart();
        });
        
        document.getElementById(`late-${id}`).addEventListener('input', (e) => {
            distribution.lateSpread = parseFloat(e.target.value);
            this.updateChart();
        });
    }
    
    calculateQuartiles(distribution) {
        // Convert spread parameters to actual quartiles
        const q50 = distribution.median;
        const q25 = distribution.earlySpread * q50;
        const q75 = q50 + distribution.lateSpread * (1.0 - q50);
        
        return { q25, q50, q75 };
    }
    
    updateWeightLabels() {
        if (this.distributions.length === 1) {
            return; // No weight display for single distribution
        }
        
        const totalWeight = this.distributions.reduce((sum, d) => sum + d.weight, 0);
        
        this.distributions.forEach(distribution => {
            const weightValueElement = document.getElementById(`weight-value-${distribution.id}`);
            if (weightValueElement) {
                const normalizedWeight = totalWeight > 0 ? (distribution.weight / totalWeight) : 0;
                const percentage = Math.round(normalizedWeight * 100);
                weightValueElement.textContent = `${percentage}%`;
            }
        });
    }
    
    generateMixtureCDF() {
        if (this.distributions.length === 0) return [];
        
        // Get all unique knot x-positions
        const allKnots = new Set([0, 1]); // Always include start and end
        
        this.distributions.forEach(dist => {
            const quartiles = this.calculateQuartiles(dist);
            allKnots.add(quartiles.q25);
            allKnots.add(quartiles.q50);
            allKnots.add(quartiles.q75);
        });
        
        const sortedKnots = Array.from(allKnots).sort((a, b) => a - b);
        
        // Calculate normalized weights
        const totalWeight = this.distributions.reduce((sum, d) => sum + d.weight, 0);
        const normalizedWeights = this.distributions.map(d => 
            totalWeight > 0 ? d.weight / totalWeight : 1 / this.distributions.length
        );
        
        
        // Calculate mixture CDF at each knot (from distribution knots only)
        const mixtureKnots = sortedKnots.map(x => {
            let mixtureY = 0;
            
            this.distributions.forEach((dist, i) => {
                const cdfValue = this.evaluateSingleCDF(dist, x);
                mixtureY += normalizedWeights[i] * cdfValue;
            });
            
            // Scale by max probability
            mixtureY *= this.maxProbability;
            
            return { x, y: mixtureY };
        });
        
        return mixtureKnots;
    }
    
    evaluateSingleCDF(distribution, x) {
        const quartiles = this.calculateQuartiles(distribution);
        const knots = [
            { x: 0, y: 0 },
            { x: quartiles.q25, y: 0.25 },
            { x: quartiles.q50, y: 0.5 },
            { x: quartiles.q75, y: 0.75 },
            { x: 1, y: 1 }
        ];
        
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        
        // Find the segment containing x and interpolate
        for (let i = 0; i < knots.length - 1; i++) {
            if (x >= knots[i].x && x <= knots[i + 1].x) {
                const t = (x - knots[i].x) / (knots[i + 1].x - knots[i].x);
                return knots[i].y + t * (knots[i + 1].y - knots[i].y);
            }
        }
        
        return 1;
    }
    
    findXForY(data, targetY) {
        if (data.length < 2) return null;
        
        // Find the segment where targetY falls between two y-values
        for (let i = 0; i < data.length - 1; i++) {
            const current = data[i];
            const next = data[i + 1];
            
            if (targetY >= current.y && targetY <= next.y) {
                // Linear interpolation to find x
                if (next.y === current.y) {
                    return current.x; // Avoid division by zero
                }
                const t = (targetY - current.y) / (next.y - current.y);
                return current.x + t * (next.x - current.x);
            }
        }
        
        return null;
    }
    
    updateChart() {
        const data = this.generateMixtureCDF();
        
        this.svg.selectAll(".cdf-line").remove();
        this.svg.selectAll(".cdf-point").remove();
        this.svg.selectAll(".quartile-line").remove();
        
        if (data.length === 0) return;
        
        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y))
            .curve(this.useSmooth ? d3.curveMonotoneX : d3.curveLinear);
        
        this.svg.append("path")
            .datum(data)
            .attr("class", "cdf-line")
            .attr("d", line);
        
        // Show quartile markers (25%, 50%, 75% of max probability)
        const quartileYValues = [0.25, 0.5, 0.75].map(q => q * this.maxProbability);
        const quartileMarkers = quartileYValues.map(yTarget => {
            // Find x-value where mixture CDF equals yTarget
            const xValue = this.findXForY(data, yTarget);
            return { x: xValue, y: yTarget };
        }).filter(d => d.x !== null);
        
        this.svg.selectAll(".cdf-point")
            .data(quartileMarkers)
            .enter()
            .append("circle")
            .attr("class", "cdf-point")
            .attr("cx", d => this.xScale(d.x))
            .attr("cy", d => this.yScale(d.y))
            .attr("r", 4)
            .attr("fill", "#2A623D")
            .attr("stroke", "white")
            .attr("stroke-width", 2);
        
        this.drawQuartileLines();
        this.updateQuartileSummary();
    }
    
    drawQuartileLines() {
        const data = this.generateMixtureCDF();
        const quartileYValues = [0.25, 0.5, 0.75].map(q => q * this.maxProbability);
        
        quartileYValues.forEach(yTarget => {
            const xValue = this.findXForY(data, yTarget);
            if (xValue !== null) {
                this.svg.append("line")
                    .attr("class", "quartile-line")
                    .attr("x1", this.xScale(xValue))
                    .attr("y1", this.yScale(yTarget))
                    .attr("x2", this.xScale(xValue))
                    .attr("y2", this.height);
            }
        });
    }
    
    getLogTimeTicks() {
        const oneWeekInYears = 1/52;
        const oneCenturyInYears = 100;
        
        const logMin = Math.log10(oneWeekInYears);
        const logMax = Math.log10(oneCenturyInYears);
        
        const timePoints = [
            { years: oneWeekInYears, label: '1 week' },
            { years: 1/12, label: '1 month' },
            { years: 1/4, label: '3 months' },
            { years: 1, label: '1 year' },
            { years: 5, label: '5 years' },
            { years: 10, label: '10 years' },
            { years: 25, label: '25 years' },
            { years: oneCenturyInYears, label: '1 century' }
        ];
        
        return timePoints.map(point => {
            const logValue = Math.log10(point.years);
            const position = (logValue - logMin) / (logMax - logMin);
            return {
                position: position,
                label: point.label
            };
        });
    }
    
    setupEventListeners() {
        const smoothToggle = document.getElementById('smoothToggle');
        const addButton = document.getElementById('addDistribution');
        const maxProbSlider = document.getElementById('maxProbability');
        
        smoothToggle.addEventListener('change', (e) => {
            this.useSmooth = e.target.checked;
            this.updateChart();
        });
        
        addButton.addEventListener('click', () => {
            this.addDistribution();
        });
        
        const saveButton = document.getElementById('saveConfig');
        saveButton.addEventListener('click', () => {
            this.saveConfigToClipboard();
        });
        
        maxProbSlider.addEventListener('input', (e) => {
            this.maxProbability = parseFloat(e.target.value);
            document.getElementById('maxProbability-value').textContent = `${Math.round(this.maxProbability * 100)}%`;
            this.updateChart();
        });
    }
    
    formatTimeValue(normalizedValue) {
        const oneWeekInYears = 1/52;
        const oneCenturyInYears = 100;
        
        const logMin = Math.log10(oneWeekInYears);
        const logMax = Math.log10(oneCenturyInYears);
        
        const logValue = logMin + normalizedValue * (logMax - logMin);
        const years = Math.pow(10, logValue);
        
        if (years < 1/12) {
            const weeks = years * 52;
            return weeks < 1 ? `${Math.round(weeks * 7)} days` : `${Math.round(weeks)} weeks`;
        } else if (years < 1) {
            const months = years * 12;
            return `${Math.round(months)} months`;
        } else if (years < 10) {
            return `${Math.round(years * 10) / 10} years`;
        } else {
            return `${Math.round(years)} years`;
        }
    }
    
    saveConfigToClipboard() {
        const config = {
            maxProbability: this.maxProbability,
            distributions: this.distributions.map(dist => {
                const totalWeight = this.distributions.reduce((sum, d) => sum + d.weight, 0);
                const normalizedWeight = this.distributions.length === 1 ? 1 : 
                    (totalWeight > 0 ? dist.weight / totalWeight : 0);
                const quartiles = this.calculateQuartiles(dist);
                
                return {
                    weight: normalizedWeight,
                    q25: quartiles.q25,
                    q50: quartiles.q50,
                    q75: quartiles.q75
                };
            })
        };
        
        const configStr = JSON.stringify(config, null, 2);
        
        const saveButton = document.getElementById('saveConfig');
        const originalText = saveButton.textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(configStr).then(() => {
                saveButton.textContent = 'Copied!';
                setTimeout(() => {
                    saveButton.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
                this.fallbackCopyToClipboard(configStr, saveButton, originalText);
            });
        } else {
            this.fallbackCopyToClipboard(configStr, saveButton, originalText);
        }
    }
    
    fallbackCopyToClipboard(text, saveButton, originalText) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            saveButton.textContent = 'Copied!';
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            saveButton.textContent = 'Copy failed - see console';
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 2000);
            console.log('Configuration:', text);
        }
        document.body.removeChild(textArea);
    }
    
    updateQuartileSummary() {
        const data = this.generateMixtureCDF();
        const quartileYValues = [0.25, 0.5, 0.75].map(q => q * this.maxProbability);
        
        const quartileData = quartileYValues.map((yTarget, index) => {
            const xValue = this.findXForY(data, yTarget);
            const label = ['25th percentile', '50th percentile (median)', '75th percentile'][index];
            return {
                label,
                value: xValue !== null ? this.formatTimeValue(xValue) : 'N/A'
            };
        });
        
        const summaryDiv = document.getElementById('quartile-summary');
        summaryDiv.innerHTML = quartileData.map(q => 
            `<div class="quartile-item">
                <span class="quartile-label">${q.label}:</span> 
                <span class="quartile-value">${q.value}</span>
            </div>`
        ).join('');
    }
}

let cdfBuilder;

document.addEventListener('DOMContentLoaded', function() {
    cdfBuilder = new CDFBuilder();
});