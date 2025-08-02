// Survey Configuration Constants
const SURVEY_CONFIG = {
    approachesHeight: 0.8,
    interventionsHeight: 0.10,
    textSize: 12,

    introCard: {
        title: "Welcome to the AI Alignment Difficulty Survey",
        content: `
            <p>This survey assesses opinions on: </p>
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
            
            <p>You'll use sliders to shape these curves based on your judgment. No controls are shown here - this is just to demonstrate the visualization.</p>
        `,
    },

    metalogTestCard: {
        title: "Metalog Distribution Test",
        content: `
            <p>This slide demonstrates the new table-based input system for metalog distributions.</p>
            
            <p>Enter time/probability pairs in the table below. The metalog will automatically update as you modify the values.</p>
        `,
        showTable: true,
        defaultData: [
            { time: "1 year", probability: "25%" },
            { time: "10 years", probability: "50%" },
            { time: "50 years", probability: "75%" }
        ]
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
            description: "Alignment techniques that work with current AI paradigms and scaling",
            maxProb: 0.7,
            steepness: 0.5,
            inflection: 0.6 // Will be converted to normalized time
        },
        {
            id: "human-uplift", 
            title: "Human uplift",
            description: "Enhancing human intelligence and capabilities to keep pace with AI",
            maxProb: 0.6,
            steepness: 0.3,
            inflection: 0.7
        },
        {
            id: "alignment-theory",
            title: "Alignment theory", 
            description: "Developing theoretical foundations for AI alignment before implementation",
            maxProb: 0.8,
            steepness: 0.4,
            inflection: 0.5
        },
    ],

    predefinedInterventions: [
        {
            id: "leading-lab-pauses",
            title: "Leading lab pauses",
            description: "Major AI labs voluntarily pausing development at critical capability thresholds",
            mean: 0.4,
            std: 0.2
        },
        {
            id: "maiming",
            title: "MAIMing",
            description: "Mutually Assured Information Mining - information sharing agreements between AI labs",
            mean: 0.3,
            std: 0.15
        },
        {
            id: "bilateral-treaty",
            title: "Bilateral treaty",
            description: "Government-to-government agreements on AI development and deployment",
            mean: 0.6,
            std: 0.25
        },
        {
            id: "iaea-ai",
            title: "IAEA for AI",
            description: "International regulatory body for AI development similar to nuclear oversight",
            mean: 0.8,
            std: 0.3
        },
    ],
};