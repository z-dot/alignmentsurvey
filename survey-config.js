// Survey Configuration Constants
const SURVEY_CONFIG = {
    approachesHeight: 0.8,
    interventionsHeight: 0.10,
    textSize: 12,

    introCard: {
        title: "Welcome to the AI Alignment Difficulty Survey",
        content: `
            <p>This survey assesses opinions on the likelihood that <strong>alignment approaches succeed after a certain period of burning an AI lead.</p>

            <p>We anticipate this portion of the survey takes only <strong>5-10 minutes</strong> to complete.</p>
            
            <p><small><strong>Notes on using the interface:</strong> If you refresh or close the page, you will lose your progress. You should have been directed to this web app from a Google Form, which contains more context - if you've stumbled upon this page without being directed to it, please disregard.</small></p>
        `,
    },

    aiTimelinesCard: {
        title: "AI Capability Timelines",
        content: `
            <p>For each AI capability milestone below (the same as used in <a href="AI 2027">https://ai-2027.com/research/takeoff-forecast</a>), estimate the probability of its development by various time horizons.</p>
            
            <p><strong>Consider:</strong> What is the cumulative probability that each capability will be achieved by the specified time?</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
                <h4 style="margin-top: 0;">Capability Definitions:</h4>
                <p><strong>Superhuman coder (SC):</strong> An AI system that can do the job of the best human coder on tasks involved in AI research but faster, and cheaply enough to run lots of copies.</p>
                <p><strong>Superhuman AI researcher (SAR):</strong> An AI system that can do the job of the best human AI researcher but faster, and cheaply enough to run lots of copies.</p>
                <p><strong>Superintelligent AI researcher (SIAR):</strong> An AI system that is vastly better than the best human researcher at AI research.</p>
                <p><strong>Artificial superintelligence (ASI):</strong> An AI system that is much better than the best human at every cognitive task.</p>
            </div>
        `,
        showMultipleTables: true,
        commentBox: {
            enabled: true,
            prompt:
                "Please share any assumptions, reasoning, or additional context concerning your timeline predictions:",
        },
        tables: [
            {
                id: "sc-timeline",
                title: "Superhuman Coder (SC)",
                titleEditable: false,
                defaultData: [
                    { time: "2028", probability: "10%" },
                    { time: "2035", probability: "30%" },
                    { time: "2050", probability: "60%" },
                    { time: "2065", probability: "80%" },
                ],
            },
            {
                id: "sar-timeline",
                title: "Superhuman AI Researcher (SAR)",
                titleEditable: false,
                defaultData: [
                    { time: "2030", probability: "10%" },
                    { time: "2040", probability: "30%" },
                    { time: "2055", probability: "60%" },
                    { time: "2065", probability: "80%" },
                ],
            },
            {
                id: "siar-timeline",
                title: "Superintelligent AI Researcher (SIAR)",
                titleEditable: false,
                defaultData: [
                    { time: "2035", probability: "10%" },
                    { time: "2045", probability: "30%" },
                    { time: "2060", probability: "60%" },
                    { time: "2065", probability: "80%" },
                ],
            },
            {
                id: "asi-timeline",
                title: "Artificial Superintelligence (ASI)",
                titleEditable: false,
                defaultData: [
                    { time: "2040", probability: "10%" },
                    { time: "2050", probability: "30%" },
                    { time: "2060", probability: "60%" },
                    { time: "2065", probability: "80%" },
                ],
            },
        ],
    },

    // P(doom) and P(misalignment) assessment based on AI 2027 scenario
    doomAssessmentCard: {
        title: "P(doom) and P(misalignment) Assessment",
        content: `
            <div class="info-card">
                <h4>AI 2027 Scenario Context</h4>
                <p>Suppose we are in <a href="https://ai-2027.com/#narrative-2027-09-30" target="_blank">September 2027 as outline in AI 2027</a>, and the observations about capabilities, alignment, compute, governance, etc. are as they are in the scenario.</p>
                
                <h4>Assessment Question</h4>
                <p><strong>If humanity were to burn its lead for X amount of time</strong> (working on alignment and other safety measures without advancing the frontier), what are your probability assessments for the following outcomes? (Assume that conditions are such that work on alignment can proceed smoothly, with resources normally devoted to advancing capabilities being dedicated to safety and inference. This could be as a result of a unilateral pause from the leading lab, a bilateral treaty, or an international regulator.)</p>
                
                <h4>Definitions</h4>
                <p><strong>P(doom):</strong> Probability that humanity faces existential catastrophe or permanent disempowerment due to AI.</p>
                
                <p><strong>P(misalignment):</strong> Probability that we end up in a world where AIs are pretending to be aligned but are actually growing in power and subverting the system, while humans mistakenly believe they are in control.</p>
                            </div>
        `,
        showMultipleTables: true,
        commentBox: {
            enabled: true,
            prompt:
                "Please share any assumptions, reasoning, or additional context that influenced your P(doom) and P(misalignment) assessments:",
        },
        tables: [
            {
                id: "doom-assessment",
                title: "P(doom)",
                titleEditable: false,
                probabilityType: "survival",
                defaultData: [
                    { time: "1 month", probability: "60%" },
                    { time: "6 months", probability: "35%" },
                    { time: "2 years", probability: "15%" },
                    { time: "10 years", probability: "5%" },
                ],
            },
            {
                id: "misalignment-assessment",
                title: "P(misalignment)",
                titleEditable: false,
                probabilityType: "survival",
                defaultData: [
                    { time: "1 month", probability: "80%" },
                    { time: "6 months", probability: "60%" },
                    { time: "2 years", probability: "35%" },
                    { time: "10 years", probability: "15%" },
                ],
            },
        ],
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
            <p>Here are all your responses visualized together.</p>

            <p>You can click on any approach or intervention name below to go back and adjust your responses, or click 'Complete Survey' to finish.</p>
        `,
    },

    predefinedApproaches: [
        {
            id: "prosaic",
            title: "Prosaic alignment",
            description:
                "Alignment techniques that work with current AI paradigms and scaling",
            maxProb: 0.7,
            steepness: 0.5,
            inflection: 0.6, // Will be converted to normalized time
        },
        {
            id: "human-uplift",
            title: "Human uplift",
            description:
                "Enhancing human intelligence and capabilities to keep pace with AI",
            maxProb: 0.6,
            steepness: 0.3,
            inflection: 0.7,
        },
        {
            id: "alignment-theory",
            title: "Alignment theory",
            description:
                "Developing theoretical foundations for AI alignment before implementation",
            maxProb: 0.8,
            steepness: 0.4,
            inflection: 0.5,
        },
    ],

    predefinedInterventions: [
        {
            id: "leading-lab-pauses",
            title: "Leading lab pauses",
            description:
                "Major AI labs voluntarily pausing development at critical capability thresholds",
            mean: 0.4,
            std: 0.2,
        },
        {
            id: "maiming",
            title: "MAIMing",
            description:
                "Mutually Assured Information Mining - information sharing agreements between AI labs",
            mean: 0.3,
            std: 0.15,
        },
        {
            id: "bilateral-treaty",
            title: "Bilateral treaty",
            description:
                "Government-to-government agreements on AI development and deployment",
            mean: 0.6,
            std: 0.25,
        },
        {
            id: "iaea-ai",
            title: "IAEA for AI",
            description:
                "International regulatory body for AI development similar to nuclear oversight",
            mean: 0.8,
            std: 0.3,
        },
    ],

    // Page-table mapping: defines which tables belong to which survey page
    pageTableMapping: {
        "aiTimelines": [
            "sc-timeline",
            "sar-timeline",
            "siar-timeline",
            "asi-timeline",
        ],
        "doomAssessment": ["doom-assessment", "misalignment-assessment"],
        "review": "all", // Special case: show all tables
    },
};
