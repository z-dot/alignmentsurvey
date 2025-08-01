// Survey Configuration Constants
const SURVEY_CONFIG = {
    approachesHeight: 0.8,
    interventionsHeight: 0.10,
    textSize: 12,

    introCard: {
        title: "Welcome to the AI Alignment Difficulty Survey",
        content: `
            <p>This survey assesses expert opinions on: </p>
            <ol>
                <li> the likelihood that <strong>various alignment approaches succeed within a certain amount of time</strong>, and </li>
                <li> the effectiveness of various <strong>governance interventions in buying time</strong> for alignment. </li>
            </ol>
            <p>We anticipate this survey takes only <strong>5-10 minutes</strong> to complete.</p>
            
            <p><small><strong>Notes on using the interface:</strong> If you refresh or close the page, you will lose your progress. You should have been directed to this web app from a Google Form, which contains more context - if you've stumbled upon this page without being directed to it, please disregard.</small></p>
        `,
    },

    exampleCard: {
        title: "Example: How the Interface Works",
        content: `
            <p>Here's an example of what the graph on the left represents. The graph shows a sample alignment approach and intervention:</p>
            
            <p><strong>"Interpretability"</strong> - The S-curve shows success probability vs. research time. In this example, there's about a 30% chance of success after 10 years of focused research.</p>
            
            <p><strong>"Complete export controls"</strong> - The distribution shows the amount of time you might 'win' by enacting this intervention.</p>
            
            <p>You'll use sliders to shape these curves based on your expert judgment. No controls are shown here - this is just to demonstrate the visualization.</p>
        `,
    },

    approachesTitle: {
        title: "Alignment Approaches",
        content: `
            <p>Now you'll evaluate <strong>technical approaches to AI alignment</strong>.</p>
            <p>For each approach, consider: <em>"What's the probability this approach succeeds in solving alignment, given different amounts of total research effort?"</em></p>
            <p>Use the sliders to shape an S-curve representing success probability vs. research time invested.</p>
        `,
    },

    interventionsTitle: {
        title: "Time-buying Interventions",
        content: `
            <p>Now you'll evaluate <strong>interventions that could buy time for alignment research</strong>.</p>
            <p>For each intervention, consider: <em>"When might this intervention realistically be implemented to slow AI development?"</em></p>
            <p>Use the sliders to shape a probability distribution over implementation timing.</p>
        `,
    },

    reviewCard: {
        title: "Review Your Responses",
        content: `
            <p>Here are all your responses visualized together:</p>
            <ul>
                <li><strong>S-curves above:</strong> Alignment approaches (success probability vs. research time)</li>
                <li><strong>Distributions below:</strong> Time-buying interventions (implementation timing)</li>
            </ul>
            <p>You can click on any approach or intervention name below to go back and adjust your responses.</p>
        `,
    },

    predefinedApproaches: [
        {
            name: "Prosaic alignment",
            description:
                "Alignment techniques that work with current AI paradigms and scaling",
        },
        {
            name: "Human uplift",
            description:
                "Enhancing human intelligence and capabilities to keep pace with AI",
        },
        {
            name: "Alignment theory",
            description:
                "Developing theoretical foundations for AI alignment before implementation",
        },
    ],

    predefinedInterventions: [
        {
            name: "Leading lab pauses",
            description:
                "Major AI labs voluntarily pausing development at critical capability thresholds",
        },
        {
            name: "MAIMing",
            description:
                "Mutually Assured Information Mining - information sharing agreements between AI labs",
        },
        {
            name: "Bilateral treaty",
            description:
                "Government-to-government agreements on AI development and deployment",
        },
        {
            name: "IAEA for AI",
            description:
                "International regulatory body for AI development similar to nuclear oversight",
        },
    ],
};

class AlignmentLandscape {
    constructor() {
        this.margin = { top: 40, right: 150, bottom: 100, left: 60 };
        this.width = 1000 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        // splitY will be calculated based on approachesHeight

        this.approaches = [];
        this.interventions = [];
        this.approachesHeight = SURVEY_CONFIG.approachesHeight;
        this.interventionsHeight = SURVEY_CONFIG.interventionsHeight;
        this.textSize = SURVEY_CONFIG.textSize;

        // Step-through state
        this.currentStep = 0;
        this.totalSteps = 1 + 1 + 1 +
            SURVEY_CONFIG.predefinedApproaches.length +
            1 + SURVEY_CONFIG.predefinedInterventions.length + 1; // intro + example + approaches title + approaches + interventions title + interventions + review
        this.completedSteps = new Set();
        this.hasInteracted = false;
        this.everCompleted = new Set(); // Track items that have been completed at least once

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
            .attr(
                "transform",
                `translate(${this.margin.left},${this.margin.top})`,
            );

        this.xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, this.width]);

        this.calculateSplit();

        this.yScaleApproaches = d3.scaleLinear()
            .domain([0, 1])
            .range([this.splitY, 0]); // No gap above x-axis

        this.yScaleInterventions = d3.scaleLinear()
            .domain([0, 1])
            .range([this.splitY, this.height]);

        this.setupAxes();
        this.updateChart();
    }

    setupAxes() {
        const timeTicks = this.getLogTimeTicks();

        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
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
    }

    getLogTimeTicks() {
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;

        const logMin = Math.log10(oneMonthInYears);
        const logMax = Math.log10(oneCenturyInYears);

        const timePoints = [
            { years: 1 / 12, label: "1 month" },
            { years: 1 / 4, label: "3 months" },
            { years: 1, label: "1 year" },
            { years: 2, label: "2 years" },
            { years: 5, label: "5 years" },
            { years: 10, label: "10 years" },
            { years: 20, label: "20 years" },
            { years: 50, label: "50 years" },
            { years: oneCenturyInYears, label: "1 century" },
        ];

        return timePoints.map((point) => {
            const logValue = Math.log10(point.years);
            const position = (logValue - logMin) / (logMax - logMin);
            return {
                position: position,
                label: point.label,
            };
        });
    }

    initializeSurvey() {
        // Initialize all approaches and interventions with default values
        SURVEY_CONFIG.predefinedApproaches.forEach((config, index) => {
            const approach = {
                id: index + 1,
                name: config.name,
                description: config.description,
                inflection: 0.5,
                steepness: 5,
                maxProb: 0.8,
            };
            this.approaches.push(approach);
        });

        SURVEY_CONFIG.predefinedInterventions.forEach((config, index) => {
            const intervention = {
                id: index + 1,
                name: config.name,
                description: config.description,
                mean: 0.4,
                stdDev: 0.1,
            };
            this.interventions.push(intervention);
        });

        this.updateProgress();
        this.showCurrentStep();
    }

    getCurrentItem() {
        if (this.currentStep === 0) {
            return { type: "intro", item: SURVEY_CONFIG.introCard };
        } else if (this.currentStep === 1) {
            return { type: "example", item: SURVEY_CONFIG.exampleCard };
        } else if (this.currentStep === 2) {
            return {
                type: "approachesTitle",
                item: SURVEY_CONFIG.approachesTitle,
            };
        } else if (
            this.currentStep <= 2 + SURVEY_CONFIG.predefinedApproaches.length
        ) {
            const approachIndex = this.currentStep - 3;
            return { type: "approach", item: this.approaches[approachIndex] };
        } else if (
            this.currentStep === 3 + SURVEY_CONFIG.predefinedApproaches.length
        ) {
            return {
                type: "interventionsTitle",
                item: SURVEY_CONFIG.interventionsTitle,
            };
        } else if (
            this.currentStep ===
                4 + SURVEY_CONFIG.predefinedApproaches.length +
                    SURVEY_CONFIG.predefinedInterventions.length
        ) {
            return { type: "review", item: SURVEY_CONFIG.reviewCard };
        } else {
            const interventionIndex = this.currentStep - 4 -
                SURVEY_CONFIG.predefinedApproaches.length;
            return {
                type: "intervention",
                item: this.interventions[interventionIndex],
            };
        }
    }

    showCurrentStep() {
        const container = document.getElementById("current-item-container");
        const currentItem = this.getCurrentItem();

        // Reset interaction tracking for slider steps
        if (
            currentItem.type === "approach" ||
            currentItem.type === "intervention"
        ) {
            this.hasInteracted = false;
        }

        if (
            currentItem.type === "intro" ||
            currentItem.type === "approachesTitle" ||
            currentItem.type === "interventionsTitle"
        ) {
            this.createInfoCard(currentItem.item, container);
        } else if (currentItem.type === "example") {
            this.createExampleCard(currentItem.item, container);
        } else if (currentItem.type === "review") {
            this.createReviewUI(currentItem.item, container);
        } else if (currentItem.type === "approach") {
            this.createApproachUI(currentItem.item, container);
        } else {
            this.createInterventionUI(currentItem.item, container);
        }

        this.updateChart();
        this.updateNavigationButtons();
    }

    nextStep() {
        if (this.currentStep < this.totalSteps - 1) {
            this.completedSteps.add(this.currentStep);
            this.everCompleted.add(this.currentStep);
            this.currentStep++;
            this.updateProgress();
            this.showCurrentStep();
            this.updateNavigationButtons();
        } else {
            this.completeSurvey();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateProgress();
            this.showCurrentStep();
            this.updateNavigationButtons();
        }
    }

    updateProgress() {
        document.getElementById("current-step").textContent = this.currentStep +
            1;
        document.getElementById("total-steps").textContent = this.totalSteps;
        const progressPercent = ((this.currentStep + 1) / this.totalSteps) *
            100;
        document.getElementById("progress-fill").style.width = progressPercent +
            "%";
    }

    updateNavigationButtons() {
        const currentItem = this.getCurrentItem();
        const requiresInteraction = currentItem.type === "approach" ||
            currentItem.type === "intervention";

        const nextButton = document.getElementById("nextStep");
        const tooltip = document.getElementById("nextTooltip");

        // Check if this step was ever completed before (allows skipping interaction requirement)
        const wasEverCompleted = this.everCompleted.has(this.currentStep);
        const isDisabled = requiresInteraction && !this.hasInteracted &&
            !wasEverCompleted;

        document.getElementById("prevStep").disabled = this.currentStep === 0;
        document.getElementById("prevStep").style.opacity =
            this.currentStep === 0 ? "0.6" : "1";
        nextButton.disabled = isDisabled;

        // Show tooltip only when button is disabled, style button accordingly
        if (isDisabled) {
            nextButton.style.opacity = "0.6";
            tooltip.style.display = "block";
        } else {
            nextButton.style.opacity = "1";
            tooltip.style.display = "none";
        }

        nextButton.textContent = this.currentStep === this.totalSteps - 1
            ? "Complete Survey"
            : "Next";
    }

    completeSurvey() {
        document.getElementById("current-item-container").style.display =
            "none";
        document.getElementById("progress-indicator").style.display = "none";
        document.querySelector(".navigation-controls").style.display = "none";
        document.getElementById("survey-complete").style.display = "block";
    }

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

    createReviewUI(card, container) {
        let approachesList = this.approaches.map((approach) =>
            `<li><a href="#" onclick="alignmentLandscape.goToItem('approach', ${approach.id})">${approach.name}</a></li>`
        ).join("");

        let interventionsList = this.interventions.map((intervention) =>
            `<li><a href="#" onclick="alignmentLandscape.goToItem('intervention', ${intervention.id})">${intervention.name}</a></li>`
        ).join("");

        container.innerHTML = `
            <div class="info-card">
                <h3>${card.title}</h3>
                ${card.content}
                
                <div class="review-lists">
                    <div class="review-section">
                        <h4>Alignment Approaches:</h4>
                        <ul class="review-list">
                            ${approachesList}
                        </ul>
                    </div>
                    
                    <div class="review-section">
                        <h4>Time-buying Interventions:</h4>
                        <ul class="review-list">
                            ${interventionsList}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    goToItem(type, id) {
        // Find the step number for this item
        let targetStep = 0;

        if (type === "approach") {
            // intro(0) + approachesTitle(1) + approaches(2 to 1+approaches.length)
            targetStep = 1 + id; // id is 1-based, so approach 1 is at step 2
        } else if (type === "intervention") {
            // intro + approachesTitle + approaches + interventionsTitle + interventions
            targetStep = 2 + SURVEY_CONFIG.predefinedApproaches.length + id; // id is 1-based
        }

        this.currentStep = targetStep;
        this.updateProgress();
        this.showCurrentStep();
        this.updateNavigationButtons();
    }

    createApproachUI(approach, container) {
        const div = document.createElement("div");
        div.className = "item-controls";
        div.id = `approach-${approach.id}`;

        div.innerHTML = `
            <h4>${approach.name}</h4>
            <p class="item-description">${approach.description}</p>
            
            <div class="slider-group">
                <div class="slider-header">
                    <label>Inflection</label>
                    <span class="slider-value" id="inflection-value-${approach.id}"></span>
                </div>
                <input type="range" id="inflection-${approach.id}" min="0" max="1" step="0.01" value="${approach.inflection}">
            </div>
            
            <div class="slider-group">
                <div class="slider-header">
                    <label>Steepness</label>
                    <span class="slider-value" id="steepness-value-${approach.id}"></span>
                </div>
                <input type="range" id="steepness-${approach.id}" min="1" max="40" step="0.1" value="${approach.steepness}">
            </div>
            
            <div class="slider-group">
                <div class="slider-header">
                    <label>Max Probability</label>
                    <span class="slider-value" id="maxprob-value-${approach.id}"></span>
                </div>
                <input type="range" id="maxprob-${approach.id}" min="0" max="1" step="0.01" value="${approach.maxProb}">
            </div>
            
            <table class="context-table" id="approach-table-${approach.id}">
                <tr>
                    <th>1 year</th>
                    <th>10 years</th>
                    <th>50 years</th>
                </tr>
                <tr>
                    <td id="approach-1yr-${approach.id}">-</td>
                    <td id="approach-10yr-${approach.id}">-</td>
                    <td id="approach-50yr-${approach.id}">-</td>
                </tr>
            </table>
        `;

        container.innerHTML = "";
        container.appendChild(div);
        this.setupApproachEventListeners(approach);
        this.updateApproachLabels(approach);
        this.updateApproachTable(approach);
    }

    updateApproachTable(approach) {
        const id = approach.id;

        // Calculate probabilities at 1, 10, and 50 years
        // Convert years to normalized time position (0-1 scale)
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;
        const logMin = Math.log10(oneMonthInYears);
        const logMax = Math.log10(oneCenturyInYears);

        const yearToNormalized = (years) => {
            const logValue = Math.log10(years);
            return (logValue - logMin) / (logMax - logMin);
        };

        const calculateProbability = (normalizedX) => {
            return approach.maxProb /
                (1 +
                    Math.exp(
                        -approach.steepness *
                            (normalizedX - approach.inflection),
                    ));
        };

        const oneYearNorm = yearToNormalized(1);
        const tenYearNorm = yearToNormalized(10);
        const fiftyYearNorm = yearToNormalized(50);

        const oneYearProb = calculateProbability(oneYearNorm);
        const tenYearProb = calculateProbability(tenYearNorm);
        const fiftyYearProb = calculateProbability(fiftyYearNorm);

        document.getElementById(`approach-1yr-${id}`).textContent = `${
            Math.round(oneYearProb * 100)
        }%`;
        document.getElementById(`approach-10yr-${id}`).textContent = `${
            Math.round(tenYearProb * 100)
        }%`;
        document.getElementById(`approach-50yr-${id}`).textContent = `${
            Math.round(fiftyYearProb * 100)
        }%`;
    }

    createInterventionUI(intervention, container) {
        const div = document.createElement("div");
        div.className = "item-controls";
        div.id = `intervention-${intervention.id}`;

        div.innerHTML = `
            <h4>${intervention.name}</h4>
            <p class="item-description">${intervention.description}</p>
            
            <div class="slider-group">
                <div class="slider-header">
                    <label>Mean</label>
                    <span class="slider-value" id="mean-value-${intervention.id}"></span>
                </div>
                <input type="range" id="mean-${intervention.id}" min="0" max="1" step="0.01" value="${intervention.mean}">
            </div>
            
            <div class="slider-group">
                <div class="slider-header">
                    <label>Standard Deviation</label>
                    <span class="slider-value" id="stddev-value-${intervention.id}"></span>
                </div>
                <input type="range" id="stddev-${intervention.id}" min="0.03" max="0.25" step="0.01" value="${intervention.stdDev}">
            </div>
            
            <table class="context-table" id="intervention-table-${intervention.id}">
                <tr>
                    <th>-2σ</th>
                    <th>-1σ</th>
                    <th>Mean</th>
                    <th>+1σ</th>
                    <th>+2σ</th>
                </tr>
                <tr>
                    <td id="intervention-m2s-${intervention.id}">-</td>
                    <td id="intervention-m1s-${intervention.id}">-</td>
                    <td id="intervention-mean-${intervention.id}">-</td>
                    <td id="intervention-p1s-${intervention.id}">-</td>
                    <td id="intervention-p2s-${intervention.id}">-</td>
                </tr>
            </table>
        `;

        container.innerHTML = "";
        container.appendChild(div);
        this.setupInterventionEventListeners(intervention);
        this.updateInterventionLabels(intervention);
        this.updateInterventionTable(intervention);
    }

    setupApproachEventListeners(approach) {
        const id = approach.id;

        document.getElementById(`inflection-${id}`).addEventListener(
            "input",
            (e) => {
                approach.inflection = parseFloat(e.target.value);
                this.hasInteracted = true;
                this.updateApproachLabels(approach);
                this.updateApproachTable(approach);
                this.updateChart();
                this.updateNavigationButtons();
            },
        );

        document.getElementById(`steepness-${id}`).addEventListener(
            "input",
            (e) => {
                approach.steepness = parseFloat(e.target.value);
                this.hasInteracted = true;
                this.updateApproachLabels(approach);
                this.updateApproachTable(approach);
                this.updateChart();
                this.updateNavigationButtons();
            },
        );

        document.getElementById(`maxprob-${id}`).addEventListener(
            "input",
            (e) => {
                approach.maxProb = parseFloat(e.target.value);
                this.hasInteracted = true;
                this.updateApproachLabels(approach);
                this.updateApproachTable(approach);
                this.updateChart();
                this.updateNavigationButtons();
            },
        );
    }

    setupInterventionEventListeners(intervention) {
        const id = intervention.id;

        document.getElementById(`mean-${id}`).addEventListener("input", (e) => {
            intervention.mean = parseFloat(e.target.value);
            this.hasInteracted = true;
            this.updateInterventionLabels(intervention);
            this.updateInterventionTable(intervention);
            this.updateChart();
            this.updateNavigationButtons();
        });

        document.getElementById(`stddev-${id}`).addEventListener(
            "input",
            (e) => {
                intervention.stdDev = parseFloat(e.target.value);
                this.hasInteracted = true;
                this.updateInterventionLabels(intervention);
                this.updateInterventionTable(intervention);
                this.updateChart();
                this.updateNavigationButtons();
            },
        );
    }

    updateApproachLabels(approach) {
        const id = approach.id;
        document.getElementById(`inflection-value-${id}`).textContent = this
            .formatTimeValue(approach.inflection);
        document.getElementById(`steepness-value-${id}`).textContent = approach
            .steepness.toFixed(1);
        document.getElementById(`maxprob-value-${id}`).textContent = `${
            Math.round(approach.maxProb * 100)
        }%`;
    }

    updateInterventionLabels(intervention) {
        const id = intervention.id;
        document.getElementById(`mean-value-${id}`).textContent = this
            .formatTimeValue(intervention.mean);
        document.getElementById(`stddev-value-${id}`).textContent = intervention
            .stdDev.toFixed(2);
    }

    updateInterventionTable(intervention) {
        const id = intervention.id;

        // Calculate values at -2σ, -1σ, mean, +1σ, +2σ in normalized space
        const meanNorm = intervention.mean;
        const stdDevNorm = intervention.stdDev;

        const minus2sigma = meanNorm - 2 * stdDevNorm;
        const minus1sigma = meanNorm - 1 * stdDevNorm;
        const mean = meanNorm;
        const plus1sigma = meanNorm + 1 * stdDevNorm;
        const plus2sigma = meanNorm + 2 * stdDevNorm;

        // Convert to time values and format
        document.getElementById(`intervention-m2s-${id}`).textContent = this
            .formatTimeValue(Math.max(0, minus2sigma));
        document.getElementById(`intervention-m1s-${id}`).textContent = this
            .formatTimeValue(Math.max(0, minus1sigma));
        document.getElementById(`intervention-mean-${id}`).textContent = this
            .formatTimeValue(mean);
        document.getElementById(`intervention-p1s-${id}`).textContent = this
            .formatTimeValue(Math.min(1, plus1sigma));
        document.getElementById(`intervention-p2s-${id}`).textContent = this
            .formatTimeValue(Math.min(1, plus2sigma));
    }

    formatTimeValue(normalizedValue) {
        const oneMonthInYears = 1 / 12;
        const oneCenturyInYears = 100;

        const logMin = Math.log10(oneMonthInYears);
        const logMax = Math.log10(oneCenturyInYears);

        const logValue = logMin + normalizedValue * (logMax - logMin);
        const years = Math.pow(10, logValue);

        if (years < 1 / 12) {
            const weeks = years * 52;
            return weeks < 1
                ? `${Math.round(weeks * 7)} days`
                : `${Math.round(weeks)} weeks`;
        } else if (years < 1) {
            const months = years * 12;
            return `${Math.round(months)} months`;
        } else if (years < 10) {
            return `${Math.round(years * 10) / 10} years`;
        } else {
            return `${Math.round(years)} years`;
        }
    }

    calculateSplit() {
        // Calculate where to split based on approachesHeight (0.2 to 1.0 maps to 20% to 80% of total height)
        const minSplit = 0.2;
        const maxSplit = 0.8;
        const splitRatio = minSplit +
            (maxSplit - minSplit) * this.approachesHeight;
        this.splitY = this.height * splitRatio;
    }

    updateScales() {
        // Recalculate split position
        this.calculateSplit();

        // Update scale ranges
        this.yScaleApproaches.range([this.splitY, 0]);
        this.yScaleInterventions.range([this.splitY, this.height]);

        // Remove and recreate axes
        this.svg.select(".y-axis-approaches").remove();
        this.svg.select(".x-axis").remove();

        const timeTicks = this.getLogTimeTicks();
        const xAxis = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
            .tickFormat((d, i) => timeTicks[i].label);

        const yAxisApproaches = d3.axisLeft(this.yScaleApproaches)
            .ticks(5)
            .tickFormat(d3.format(".0%"));

        // X-axis at the new split position
        this.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xAxis);

        // Y-axis for approaches
        this.svg.append("g")
            .attr("class", "axis y-axis-approaches")
            .call(yAxisApproaches);

        // Update grid
        this.svg.select(".grid").remove();
        const xGrid = d3.axisBottom(this.xScale)
            .tickValues(timeTicks.map((d) => d.position))
            .tickSize(-this.height)
            .tickFormat("");

        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${this.splitY})`)
            .call(xGrid);
    }

    updateChart() {
        // Clear existing curves and labels
        this.svg.selectAll(".s-curve").remove();
        this.svg.selectAll(".normal-curve").remove();
        this.svg.selectAll(".approach-label").remove();
        this.svg.selectAll(".intervention-label").remove();

        const currentItem = this.getCurrentItem();

        if (currentItem.type === "review") {
            // Show all curves together in review mode
            this.approaches.forEach((approach, index) => {
                this.drawSCurve(approach, index, true); // Skip individual labels
            });

            // Draw non-overlapping labels for approaches
            this.drawApproachLabels();

            this.interventions.forEach((intervention, index) => {
                this.drawNormalCurve(intervention, index);
            });
        } else if (currentItem.type === "approach") {
            // Only draw the current approach's curve
            this.drawSCurve(currentItem.item, 0, false); // Include label
        } else if (currentItem.type === "intervention") {
            // Only draw the current intervention's distribution
            this.drawNormalCurve(currentItem.item, 0);
        } else if (currentItem.type === "example") {
            // Show example curves without interaction
            this.drawExampleVisualization();
        }
        // For intro/title cards, show no curves (cleared above)
    }

    drawExampleVisualization() {
        // Create example approach: "Interpretability"
        const exampleApproach = {
            id: "example-approach",
            name: "Interpretability",
            inflection: 0.7,
            steepness: 10.0,
            maxProb: 0.7,
        };

        // Create example intervention: "Export controls"
        const exampleIntervention = {
            id: "example-intervention",
            name: "Total export controls",
            mean: 0.35,
            stdDev: 0.10,
        };

        // Draw the example curves
        this.drawSCurve(exampleApproach, 0, false);
        this.drawNormalCurve(exampleIntervention, 0);
    }

    drawSCurve(approach, index, skipLabel = false) {
        const numPoints = 100;
        const data = [];

        for (let i = 0; i <= numPoints; i++) {
            const x = i / numPoints;
            const y = approach.maxProb /
                (1 + Math.exp(-approach.steepness * (x - approach.inflection)));
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
            .style("stroke", this.getColor(index))
            .on("mouseover", (event) => {
                this.showTooltip(event, approach.name);
            })
            .on("mouseout", () => {
                this.hideTooltip();
            });

        // Add label at the right edge (unless in review mode where we handle labels separately)
        if (!skipLabel) {
            const finalY = approach.maxProb /
                (1 + Math.exp(-approach.steepness * (1 - approach.inflection)));
            this.svg.append("text")
                .attr("class", "approach-label")
                .attr("x", this.width + 10)
                .attr("y", this.yScaleApproaches(finalY))
                .attr("dy", "0.35em")
                .style("font-size", `${this.textSize}px`)
                .style("fill", this.getColor(index))
                .text(approach.name);
        }
    }

    drawApproachLabels() {
        // Calculate final probability at x=1 (1 century) for each approach
        const approachesWithData = this.approaches.map((approach, index) => {
            const finalY = approach.maxProb /
                (1 + Math.exp(-approach.steepness * (1 - approach.inflection)));
            return {
                approach,
                originalIndex: index, // Keep track of original index for color
                finalY,
                yPosition: this.yScaleApproaches(finalY),
            };
        });

        // Sort by final probability (highest first)
        approachesWithData.sort((a, b) => b.finalY - a.finalY);

        // Calculate non-overlapping positions
        const minSpacing = 20; // Minimum pixels between labels

        // Start with the first item at its natural position
        approachesWithData[0].adjustedY = approachesWithData[0].yPosition;

        // Adjust subsequent positions to avoid overlap (moving down)
        for (let i = 1; i < approachesWithData.length; i++) {
            const current = approachesWithData[i];
            const previous = approachesWithData[i - 1];

            // Minimum Y position is previous label position + spacing
            const minAllowedY = previous.adjustedY + minSpacing;

            // Use natural position if it's far enough down, otherwise push down
            current.adjustedY = Math.max(current.yPosition, minAllowedY);
        }

        // Draw labels at adjusted positions
        approachesWithData.forEach(({ approach, originalIndex, adjustedY }) => {
            this.svg.append("text")
                .attr("class", "approach-label")
                .attr("x", this.width + 10)
                .attr("y", adjustedY)
                .attr("dy", "0.35em")
                .style("font-size", `${this.textSize}px`)
                .style("fill", this.getColor(originalIndex))
                .text(approach.name);
        });
    }

    drawNormalCurve(intervention, index) {
        const numPoints = 100;
        const data = [];
        const xMin = Math.max(0, intervention.mean - 4 * intervention.stdDev);
        const xMax = Math.min(1, intervention.mean + 4 * intervention.stdDev);

        for (let i = 0; i <= numPoints; i++) {
            const x = xMin + (xMax - xMin) * (i / numPoints);
            const y = this.interventionsHeight *
                this.normalPDF(x, intervention.mean, intervention.stdDev);
            data.push({ x, y });
        }

        const area = d3.area()
            .x((d) => this.xScale(d.x))
            .y0(this.yScaleInterventions(0))
            .y1((d) => this.yScaleInterventions(d.y))
            .curve(d3.curveMonotoneX);

        const curve = this.svg.append("path")
            .datum(data)
            .attr("class", "normal-curve")
            .attr("id", `intervention-curve-${intervention.id}`)
            .attr("d", area)
            .on("mouseover", (event) => {
                this.showTooltip(event, intervention.name);
                this.highlightIntervention(intervention.id);
            })
            .on("mouseout", () => {
                this.hideTooltip();
                this.resetInterventionHighlight();
            });

        // Add label below the curve at the mean
        const peakHeight = this.interventionsHeight *
            this.normalPDF(
                intervention.mean,
                intervention.mean,
                intervention.stdDev,
            );
        this.svg.append("text")
            .attr("class", "intervention-label")
            .attr("x", this.xScale(intervention.mean))
            .attr("y", this.yScaleInterventions(peakHeight) + 15)
            .attr("text-anchor", "middle")
            .style("font-size", `${this.textSize}px`)
            .style("fill", "#666")
            .text(intervention.name);
    }

    normalPDF(x, mean, stdDev) {
        const variance = stdDev * stdDev;
        const coefficient = 1 / Math.sqrt(2 * Math.PI * variance);
        const exponent = -Math.pow(x - mean, 2) / (2 * variance);
        return coefficient * Math.exp(exponent);
    }

    getColor(index) {
        const colors = [
            "#2A623D",
            "#8B4513",
            "#4682B4",
            "#DC143C",
            "#FF8C00",
            "#9932CC",
            "#228B22",
            "#FF1493",
        ];
        return colors[index % colors.length];
    }

    showTooltip(event, text) {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.display = "block";
        tooltip.style.left = (event.pageX + 10) + "px";
        tooltip.style.top = (event.pageY - 10) + "px";
        tooltip.textContent = text;
    }

    hideTooltip() {
        document.getElementById("tooltip").style.display = "none";
    }

    highlightIntervention(activeId) {
        this.interventions.forEach((intervention) => {
            const curve = this.svg.select(
                `#intervention-curve-${intervention.id}`,
            );
            if (intervention.id === activeId) {
                curve.style("opacity", 0.8);
            } else {
                curve.style("opacity", 0.1);
            }
        });
    }

    resetInterventionHighlight() {
        this.svg.selectAll(".normal-curve").style("opacity", 0.3);
    }

    updateTextSize() {
        // Update axis text size
        this.svg.selectAll(".axis text")
            .style("font-size", `${this.textSize}px`);

        // Update label text sizes
        this.svg.selectAll(".approach-label")
            .style("font-size", `${this.textSize}px`);

        this.svg.selectAll(".intervention-label")
            .style("font-size", `${this.textSize}px`);
    }

    setupEventListeners() {
        document.getElementById("nextStep").addEventListener("click", () => {
            this.nextStep();
        });

        document.getElementById("prevStep").addEventListener("click", () => {
            this.prevStep();
        });

        document.getElementById("copyToClipboard").addEventListener(
            "click",
            () => {
                this.copyToClipboard();
            },
        );

        this.updateNavigationButtons();
    }

    copyToClipboard() {
        const surveyData = {
            approaches: this.approaches.map((approach) => ({
                name: approach.name,
                inflection: approach.inflection,
                steepness: approach.steepness,
                maxProb: approach.maxProb,
            })),
            interventions: this.interventions.map((intervention) => ({
                name: intervention.name,
                mean: intervention.mean,
                stdDev: intervention.stdDev,
            })),
        };

        const jsonString = JSON.stringify(surveyData, null, 2);

        const button = document.getElementById("copyToClipboard");
        const originalText = button.textContent;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(jsonString).then(() => {
                button.textContent = "Copied!";
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }).catch((err) => {
                console.error("Failed to copy to clipboard:", err);
                this.fallbackCopyToClipboard(jsonString, button, originalText);
            });
        } else {
            this.fallbackCopyToClipboard(jsonString, button, originalText);
        }
    }

    fallbackCopyToClipboard(text, button, originalText) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand("copy");
            button.textContent = "Copied!";
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error("Fallback copy failed:", err);
            button.textContent = "Copy failed - see console";
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
            console.log("Survey Data:", text);
        }
        document.body.removeChild(textArea);
    }

    checkMobileAndShowModal() {
        // Check if screen width is less than 1200px (same as our CSS breakpoint)
        if (window.innerWidth < 1200) {
            document.getElementById("mobile-modal").style.display = "flex";
        }
    }

    dismissMobileModal() {
        document.getElementById("mobile-modal").style.display = "none";
    }
}

let alignmentLandscape;

document.addEventListener("DOMContentLoaded", function () {
    alignmentLandscape = new AlignmentLandscape();
});
